import type { FileTransferItem, DownloadRequest } from '../types/index.js';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB limit
export const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
export const REQUEST_TIMEOUT_MS = 30 * 1000; // 30 seconds expiration
const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB backpressure threshold

interface FileOfferMessage {
  type: 'file_offer';
  fileId: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  isVoiceNote?: boolean;
  duration?: number;
}

interface DownloadRequestMessage {
  type: 'download_request';
  transferId: string;
  fileId: string;
  requesterSocketId: string;
  requesterName: string;
}

interface DownloadResponseMessage {
  type: 'download_response';
  transferId: string;
  fileId: string;
  approved: boolean;
  reason?: 'rejected' | 'expired';
}

interface FileEndMessage {
  type: 'file_end';
  fileId: string;
}

interface FileCancelMessage {
  type: 'file_cancel';
  fileId: string;
}

interface IncomingTransferSession {
  fileId: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: ArrayBuffer[];
  receivedBytes: number;
  isVoiceNote?: boolean;
  duration?: number;
}

interface PendingSenderRequest {
  request: DownloadRequest;
  dataChannel: RTCDataChannel;
  timer: ReturnType<typeof setTimeout>;
}

export class FileTransferManager {
  // Sender-side stored local files/blobs: fileId -> File | Blob
  private localFiles = new Map<string, File | Blob>();
  // Sender-side pending download requests: transferId -> PendingSenderRequest
  private pendingSenderRequests = new Map<string, PendingSenderRequest>();
  // Receiver-side pending request timers: transferId -> timer
  private pendingReceiverTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Receiver-side active incoming downloads: fileId -> IncomingTransferSession
  private activeDownloads = new Map<string, IncomingTransferSession>();
  // Active upload fileIds being streamed
  private activeUploads = new Set<string>();
  // Known file transfer items cache
  private transferItems = new Map<string, FileTransferItem>();

  public onTransferUpdate?: (item: FileTransferItem) => void;
  public onDownloadRequest?: (req: DownloadRequest) => void;
  public onDownloadRequestExpired?: (transferId: string) => void;

  /**
   * Sender offers a file metadata to connected peers via DataChannel.
   * Binary chunks are NOT sent until a peer requests download and sender approves.
   */
  public async sendFile(
    file: File,
    senderId: string,
    senderName: string,
    dataChannels: RTCDataChannel[]
  ): Promise<FileTransferItem> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const openChannels = dataChannels.filter((dc) => dc.readyState === 'open');
    if (openChannels.length === 0) {
      throw new Error('Unable to connect to peers for file transfer. Please make sure peers are connected.');
    }

    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const blobUrl = URL.createObjectURL(file);

    // Cache local file in memory for on-demand chunk streaming upon approval
    this.localFiles.set(fileId, file);

    const initialItem: FileTransferItem = {
      id: fileId,
      senderId,
      senderName,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      progress: 100,
      state: 'completed', // For sender, file is already available locally
      blobUrl,
      isSelf: true,
      timestamp: Date.now(),
      isVoiceNote: false,
    };

    this.transferItems.set(fileId, initialItem);

    if (this.onTransferUpdate) {
      this.onTransferUpdate(initialItem);
    }

    // Broadcast file offer (metadata only) to open peer DataChannels
    const offerMsg: FileOfferMessage = {
      type: 'file_offer',
      fileId,
      senderId,
      senderName,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      isVoiceNote: false,
    };

    const offerJson = JSON.stringify(offerMsg);
    openChannels.forEach((dc) => {
      try {
        if (dc.readyState === 'open') {
          dc.send(offerJson);
        }
      } catch (err) {
        console.warn('[FileTransfer] Error sending file offer header:', err);
      }
    });

    return initialItem;
  }

  /**
   * Sender streams a voice note directly to connected peers via WebRTC DataChannels.
   * Voice notes stream binary chunks automatically without requiring download approval.
   */
  public async sendVoiceNote(
    blob: Blob,
    duration: number,
    mimeType: string,
    fileName: string,
    senderId: string,
    senderName: string,
    dataChannels: RTCDataChannel[]
  ): Promise<FileTransferItem> {
    const openChannels = dataChannels.filter((dc) => dc.readyState === 'open');
    if (openChannels.length === 0) {
      throw new Error('Unable to connect to peers for voice message transfer. Please make sure peers are connected.');
    }

    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const blobUrl = URL.createObjectURL(blob);

    // Cache local blob
    this.localFiles.set(fileId, blob);

    const initialItem: FileTransferItem = {
      id: fileId,
      senderId,
      senderName,
      fileName,
      fileSize: blob.size,
      mimeType,
      progress: 100,
      state: 'completed',
      blobUrl,
      isSelf: true,
      timestamp: Date.now(),
      isVoiceNote: true,
      duration,
    };

    this.transferItems.set(fileId, initialItem);

    if (this.onTransferUpdate) {
      this.onTransferUpdate(initialItem);
    }

    // Broadcast voice note metadata header
    const offerMsg: FileOfferMessage = {
      type: 'file_offer',
      fileId,
      senderId,
      senderName,
      fileName,
      fileSize: blob.size,
      mimeType,
      totalChunks,
      isVoiceNote: true,
      duration,
    };

    const offerJson = JSON.stringify(offerMsg);
    openChannels.forEach((dc) => {
      try {
        if (dc.readyState === 'open') {
          dc.send(offerJson);
        }
      } catch (err) {
        console.warn('[FileTransfer] Error sending voice note offer header:', err);
      }
    });

    // Stream binary chunks across all open peer DataChannels
    for (const dc of openChannels) {
      this.streamFileToDataChannel(fileId, blob, fileName, dc);
    }

    return initialItem;
  }

  /**
   * Receiver requests download permission from the sender.
   */
  public requestDownload(
    fileId: string,
    requesterSocketId: string,
    requesterName: string,
    dataChannels: RTCDataChannel[]
  ): string {
    const item = this.transferItems.get(fileId);
    if (!item) {
      throw new Error('File transfer record not found.');
    }

    const openChannels = dataChannels.filter((dc) => dc.readyState === 'open');
    if (openChannels.length === 0) {
      throw new Error('No open peer connection to request file download.');
    }

    const transferId = crypto.randomUUID();

    // Update receiver state to pending approval
    const updatedItem: FileTransferItem = {
      ...item,
      state: 'pending_approval',
      error: undefined,
    };
    this.transferItems.set(fileId, updatedItem);
    if (this.onTransferUpdate) {
      this.onTransferUpdate(updatedItem);
    }

    const requestMsg: DownloadRequestMessage = {
      type: 'download_request',
      transferId,
      fileId,
      requesterSocketId,
      requesterName,
    };

    const requestJson = JSON.stringify(requestMsg);
    openChannels.forEach((dc) => {
      try {
        if (dc.readyState === 'open') {
          dc.send(requestJson);
        }
      } catch (err) {
        console.warn('[FileTransfer] Error sending download request:', err);
      }
    });

    // Start 30-second receiver timeout
    const timeout = setTimeout(() => {
      this.pendingReceiverTimers.delete(transferId);
      const current = this.transferItems.get(fileId);
      if (current && current.state === 'pending_approval') {
        const expiredItem: FileTransferItem = {
          ...current,
          state: 'expired',
          error: 'Download request expired.',
        };
        this.transferItems.set(fileId, expiredItem);
        if (this.onTransferUpdate) {
          this.onTransferUpdate(expiredItem);
        }
      }
    }, REQUEST_TIMEOUT_MS);

    this.pendingReceiverTimers.set(transferId, timeout);
    return transferId;
  }

  /**
   * Sender responds to an incoming download request (Approve or Reject).
   */
  public respondToDownloadRequest(
    transferId: string,
    approved: boolean,
    reason?: 'rejected' | 'expired'
  ): void {
    const pending = this.pendingSenderRequests.get(transferId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingSenderRequests.delete(transferId);

    const { request, dataChannel } = pending;
    const file = this.localFiles.get(request.fileId);

    const responseMsg: DownloadResponseMessage = {
      type: 'download_response',
      transferId,
      fileId: request.fileId,
      approved,
      reason: approved ? undefined : reason || 'rejected',
    };

    try {
      if (dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(responseMsg));
      }
    } catch (err) {
      console.warn('[FileTransfer] Error sending download response:', err);
    }

    if (approved && file && dataChannel.readyState === 'open') {
      // Start streaming binary chunks strictly to the approved requester's DataChannel
      this.streamFileToDataChannel(request.fileId, file, request.fileName, dataChannel);
    }
  }

  /**
   * Streams 64 KB binary chunks across a specific WebRTC DataChannel.
   */
  private async streamFileToDataChannel(
    fileId: string,
    file: File | Blob,
    fileName: string,
    dataChannel: RTCDataChannel
  ): Promise<void> {
    this.activeUploads.add(fileId);
    console.log(`[FileTransfer] Streaming file "${fileName}" to peer...`);

    try {
      let offset = 0;
      let chunkIndex = 0;

      while (offset < file.size) {
        if (!this.activeUploads.has(fileId) || dataChannel.readyState !== 'open') {
          console.log(`[FileTransfer] Streaming cancelled or channel closed for ${fileId}`);
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        await this.waitForBufferLow(dataChannel);

        const payload = this.wrapChunk(fileId, chunkIndex, buffer);
        dataChannel.send(payload);

        offset += buffer.byteLength;
        chunkIndex++;
      }

      // Send completion header
      if (dataChannel.readyState === 'open') {
        const endMsg: FileEndMessage = { type: 'file_end', fileId };
        dataChannel.send(JSON.stringify(endMsg));
      }
      console.log(`[FileTransfer] File streaming completed for "${fileName}"`);
    } catch (err) {
      console.error(`[FileTransfer] Error streaming file ${fileId}:`, err);
    } finally {
      this.activeUploads.delete(fileId);
    }
  }

  /**
   * Handle incoming raw message (JSON text header or binary chunk) from a peer DataChannel.
   */
  public handleIncomingData(data: string | ArrayBuffer, dataChannel: RTCDataChannel): void {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);

        // 1. File Offer (Metadata received by Receiver)
        if (parsed.type === 'file_offer') {
          const msg = parsed as FileOfferMessage;

          if (msg.isVoiceNote) {
            // Voice note: immediately initialize download session and begin receiving chunks
            this.activeDownloads.set(msg.fileId, {
              fileId: msg.fileId,
              senderId: msg.senderId,
              senderName: msg.senderName,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              mimeType: msg.mimeType,
              totalChunks: msg.totalChunks,
              receivedChunks: [],
              receivedBytes: 0,
              isVoiceNote: true,
              duration: msg.duration,
            });

            const item: FileTransferItem = {
              id: msg.fileId,
              senderId: msg.senderId,
              senderName: msg.senderName,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              mimeType: msg.mimeType,
              progress: 0,
              state: 'receiving',
              isSelf: false,
              timestamp: Date.now(),
              isVoiceNote: true,
              duration: msg.duration,
            };

            this.transferItems.set(msg.fileId, item);
            if (this.onTransferUpdate) {
              this.onTransferUpdate(item);
            }
          } else {
            // Standard file offer: wait for user approval to download
            const item: FileTransferItem = {
              id: msg.fileId,
              senderId: msg.senderId,
              senderName: msg.senderName,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              mimeType: msg.mimeType,
              progress: 0,
              state: 'offered',
              isSelf: false,
              timestamp: Date.now(),
              isVoiceNote: false,
            };

            this.transferItems.set(msg.fileId, item);
            if (this.onTransferUpdate) {
              this.onTransferUpdate(item);
            }
          }
        }
        // 2. Download Request (Received by Sender)
        else if (parsed.type === 'download_request') {
          const msg = parsed as DownloadRequestMessage;
          const file = this.localFiles.get(msg.fileId);
          if (!file) {
            // File no longer exists locally -> reject
            const resp: DownloadResponseMessage = {
              type: 'download_response',
              transferId: msg.transferId,
              fileId: msg.fileId,
              approved: false,
              reason: 'rejected',
            };
            try {
              if (dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify(resp));
              }
            } catch {
              // Ignore
            }
            return;
          }

          const fileName = file instanceof File ? file.name : 'voice-note.webm';
          const fileType = file.type || 'application/octet-stream';

          const request: DownloadRequest = {
            transferId: msg.transferId,
            fileId: msg.fileId,
            requesterSocketId: msg.requesterSocketId,
            requesterName: msg.requesterName,
            fileName,
            fileSize: file.size,
            mimeType: fileType,
            receivedAt: Date.now(),
          };

          // Set 30s auto-expiry timer on sender
          const timer = setTimeout(() => {
            if (this.pendingSenderRequests.has(msg.transferId)) {
              this.respondToDownloadRequest(msg.transferId, false, 'expired');
              if (this.onDownloadRequestExpired) {
                this.onDownloadRequestExpired(msg.transferId);
              }
            }
          }, REQUEST_TIMEOUT_MS);

          this.pendingSenderRequests.set(msg.transferId, {
            request,
            dataChannel,
            timer,
          });

          if (this.onDownloadRequest) {
            this.onDownloadRequest(request);
          }
        }
        // 3. Download Response (Received by Receiver)
        else if (parsed.type === 'download_response') {
          const msg = parsed as DownloadResponseMessage;

          // Clear receiver timer
          const timer = this.pendingReceiverTimers.get(msg.transferId);
          if (timer) {
            clearTimeout(timer);
            this.pendingReceiverTimers.delete(msg.transferId);
          }

          const currentItem = this.transferItems.get(msg.fileId);
          if (!currentItem) return;

          if (msg.approved) {
            // Sender allowed download -> prepare reception session
            this.activeDownloads.set(msg.fileId, {
              fileId: msg.fileId,
              senderId: currentItem.senderId,
              senderName: currentItem.senderName,
              fileName: currentItem.fileName,
              fileSize: currentItem.fileSize,
              mimeType: currentItem.mimeType,
              totalChunks: Math.ceil(currentItem.fileSize / CHUNK_SIZE),
              receivedChunks: [],
              receivedBytes: 0,
              isVoiceNote: currentItem.isVoiceNote,
              duration: currentItem.duration,
            });

            const updatedItem: FileTransferItem = {
              ...currentItem,
              state: 'receiving',
              progress: 0,
              error: undefined,
            };
            this.transferItems.set(msg.fileId, updatedItem);
            if (this.onTransferUpdate) {
              this.onTransferUpdate(updatedItem);
            }
          } else {
            // Sender rejected or request expired
            const isExpired = msg.reason === 'expired';
            const updatedItem: FileTransferItem = {
              ...currentItem,
              state: isExpired ? 'expired' : 'rejected',
              error: isExpired ? 'Download request expired.' : 'Sender rejected the download request.',
            };
            this.transferItems.set(msg.fileId, updatedItem);
            if (this.onTransferUpdate) {
              this.onTransferUpdate(updatedItem);
            }
          }
        }
        // 4. File End (Received by Receiver after all chunks arrive)
        else if (parsed.type === 'file_end') {
          const msg = parsed as FileEndMessage;
          const session = this.activeDownloads.get(msg.fileId);
          if (!session) return;

          const blob = new Blob(session.receivedChunks, { type: session.mimeType });
          const blobUrl = URL.createObjectURL(blob);

          const completedItem: FileTransferItem = {
            id: session.fileId,
            senderId: session.senderId,
            senderName: session.senderName,
            fileName: session.fileName,
            fileSize: session.fileSize,
            mimeType: session.mimeType,
            progress: 100,
            state: 'completed',
            blobUrl,
            isSelf: false,
            timestamp: Date.now(),
            isVoiceNote: session.isVoiceNote,
            duration: session.duration,
          };

          this.transferItems.set(msg.fileId, completedItem);
          this.activeDownloads.delete(msg.fileId);

          if (this.onTransferUpdate) {
            this.onTransferUpdate(completedItem);
          }
        }
        // 5. File Cancel
        else if (parsed.type === 'file_cancel') {
          const msg = parsed as FileCancelMessage;
          const current = this.transferItems.get(msg.fileId);
          if (current) {
            const cancelledItem: FileTransferItem = {
              ...current,
              state: 'cancelled',
              error: 'Transfer cancelled by sender.',
            };
            this.transferItems.set(msg.fileId, cancelledItem);
            this.activeDownloads.delete(msg.fileId);
            if (this.onTransferUpdate) {
              this.onTransferUpdate(cancelledItem);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    } else if (data instanceof ArrayBuffer) {
      // Binary chunk: extract 36-char fileId + chunk payload
      const { fileId, chunkBuffer } = this.unwrapChunk(data);
      const session = this.activeDownloads.get(fileId);
      if (!session) return;

      session.receivedChunks.push(chunkBuffer);
      session.receivedBytes += chunkBuffer.byteLength;

      const progress = Math.min(100, Math.round((session.receivedBytes / session.fileSize) * 100));

      const updatedItem: FileTransferItem = {
        id: session.fileId,
        senderId: session.senderId,
        senderName: session.senderName,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        progress,
        state: 'receiving',
        isSelf: false,
        timestamp: Date.now(),
        isVoiceNote: session.isVoiceNote,
        duration: session.duration,
      };

      this.transferItems.set(fileId, updatedItem);
      if (this.onTransferUpdate) {
        this.onTransferUpdate(updatedItem);
      }
    }
  }

  /**
   * Cancel an ongoing transfer by fileId.
   */
  public cancelTransfer(fileId: string): void {
    this.activeUploads.delete(fileId);
    this.activeDownloads.delete(fileId);
    const item = this.transferItems.get(fileId);
    if (item) {
      const cancelledItem: FileTransferItem = { ...item, state: 'cancelled' };
      this.transferItems.set(fileId, cancelledItem);
      if (this.onTransferUpdate) {
        this.onTransferUpdate(cancelledItem);
      }
    }
  }

  /**
   * Clean up all state, cached files, timers and object URLs on room exit.
   */
  public cleanup(): void {
    for (const pending of this.pendingSenderRequests.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingSenderRequests.clear();

    for (const timer of this.pendingReceiverTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingReceiverTimers.clear();

    for (const item of this.transferItems.values()) {
      if (item.blobUrl) {
        URL.revokeObjectURL(item.blobUrl);
      }
    }
    this.localFiles.clear();
    this.activeDownloads.clear();
    this.activeUploads.clear();
    this.transferItems.clear();
  }

  private wrapChunk(fileId: string, _chunkIndex: number, buffer: ArrayBuffer): ArrayBuffer {
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(fileId.padEnd(36, ' '));
    const combined = new Uint8Array(idBytes.byteLength + buffer.byteLength);
    combined.set(idBytes, 0);
    combined.set(new Uint8Array(buffer), idBytes.byteLength);
    return combined.buffer;
  }

  private unwrapChunk(buffer: ArrayBuffer): { fileId: string; chunkBuffer: ArrayBuffer } {
    const idBytes = new Uint8Array(buffer, 0, 36);
    const decoder = new TextDecoder();
    const fileId = decoder.decode(idBytes).trim();
    const chunkBuffer = buffer.slice(36);
    return { fileId, chunkBuffer };
  }

  private waitForBufferLow(dc: RTCDataChannel): Promise<void> {
    if (dc.bufferedAmount < BUFFER_THRESHOLD) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      dc.bufferedAmountLowThreshold = BUFFER_THRESHOLD / 2;
      const onLow = () => {
        dc.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      dc.addEventListener('bufferedamountlow', onLow);
    });
  }
}

export const fileTransferManager = new FileTransferManager();

