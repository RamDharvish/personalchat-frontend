import type { CallType } from '../types/index.js';
import { fileTransferManager } from './fileTransfer.js';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private remoteStreams = new Map<string, MediaStream>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private channelOpenListeners = new Set<(socketId: string) => void>();

  public onIceCandidate?: (toSocketId: string, candidate: RTCIceCandidateInit) => void;
  public onRemoteStream?: (socketId: string, stream: MediaStream) => void;
  public onRemoteStreamRemoved?: (socketId: string) => void;
  public onConnectionStateChange?: (socketId: string, state: RTCPeerConnectionState) => void;
  public onDataChannelStateChange?: (socketId: string, state: RTCDataChannelState) => void;

  /**
   * Request local microphone / camera access with graceful error handling.
   */
  public async getMediaStream(callType: CallType): Promise<MediaStream> {
    if (callType === 'data') {
      throw new Error('Data connections do not require media access');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support WebRTC media access.');
    }

    try {
      console.log(`[VIDEO] getUserMedia requested for callType: ${callType}`);
      let stream: MediaStream;

      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video:
            callType === 'video'
              ? {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }
              : false,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintErr: unknown) {
        if (callType === 'video') {
          console.warn('[VIDEO] Retrying getUserMedia with standard video: true constraints due to:', constraintErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } else {
          throw constraintErr;
        }
      }

      this.localStream = stream;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      console.log(
        `[VIDEO] getUserMedia SUCCESS | stream id: ${stream.id} | video tracks: ${videoTracks.length} | audio tracks: ${audioTracks.length}`
      );
      videoTracks.forEach((vt, i) => {
        console.log(
          `[VIDEO] video track #${i}: kind=${vt.kind}, label="${vt.label}", enabled=${vt.enabled}, muted=${vt.muted}, readyState=${vt.readyState}`
        );
        try {
          console.log(`[VIDEO] video track #${i} settings:`, vt.getSettings());
        } catch {
          // ignore
        }
      });

      // Attach tracks safely to all existing peer connections
      this.peerConnections.forEach((pc, remoteSocketId) => {
        this.attachStreamToPeerConnection(pc, stream);
        console.log(`[VIDEO] Attached media tracks to existing peer ${remoteSocketId}`);
      });

      return stream;
    } catch (err: unknown) {
      console.error('[VIDEO] getUserMedia failed:', err);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error(
            `Camera/microphone access was denied. Please allow camera access in your browser settings.`
          );
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error(
            `No ${callType === 'video' ? 'camera/microphone' : 'microphone'} device found on your system.`
          );
        }
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          throw new Error('Audio/Video hardware is currently in use by another application.');
        }
        if (err.name === 'OverconstrainedError') {
          throw new Error('Camera constraints could not be satisfied by your video device.');
        }
        if (err.name === 'SecurityError') {
          throw new Error('Media access blocked due to browser security restrictions.');
        }
        if (err.name === 'AbortError') {
          throw new Error('Media device access was aborted.');
        }
      }
      throw new Error(`Failed to access media devices: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(socketId: string): MediaStream | undefined {
    return this.remoteStreams.get(socketId);
  }

  /**
   * Safely attach media tracks from a stream to a peer connection.
   * If a sender/transceiver for the track kind already exists, replaceTrack is used to prevent duplicate senders.
   */
  public attachStreamToPeerConnection(pc: RTCPeerConnection, stream: MediaStream): void {
    const currentSenders = pc.getSenders();
    const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];

    stream.getTracks().forEach((track) => {
      // 1. Existing sender with matching track or track kind
      const existingSender = currentSenders.find(
        (s) => s.track === track || (s.track && s.track.kind === track.kind)
      );
      if (existingSender) {
        if (existingSender.track !== track) {
          existingSender.replaceTrack(track).catch((err) => {
            console.warn('[WebRTC] replaceTrack error:', err);
          });
        }
        return;
      }

      // 2. Existing transceiver with matching receiver track kind or sender without track
      const existingTransceiver = transceivers.find(
        (t) =>
          (t.receiver && t.receiver.track && t.receiver.track.kind === track.kind) ||
          (t.sender && !t.sender.track)
      );
      if (existingTransceiver && existingTransceiver.sender) {
        if (existingTransceiver.direction === 'recvonly') {
          existingTransceiver.direction = 'sendrecv';
        }
        existingTransceiver.sender.replaceTrack(track).catch((err) => {
          console.warn('[WebRTC] transceiver replaceTrack error:', err);
        });
        return;
      }

      // 3. Fallback to addTrack
      try {
        pc.addTrack(track, stream);
      } catch (err) {
        console.warn('[WebRTC] addTrack error:', err);
      }
    });
  }

  /**
   * Clears active media tracks on senders without closing DataChannels.
   */
  public clearMediaSenders(): void {
    this.peerConnections.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.replaceTrack(null).catch(() => {});
        }
      });
    });
  }

  /**
   * Stop local stream tracks and clean up media senders.
   */
  public stopLocalStream(): void {
    if (this.localStream) {
      console.log('[VIDEO] Stopping local media stream');
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.clearMediaSenders();
    this.remoteStreams.clear();
  }

  /**
   * Returns all currently open DataChannels.
   */
  public getDataChannels(): RTCDataChannel[] {
    return Array.from(this.dataChannels.values()).filter((dc) => dc.readyState === 'open');
  }

  /**
   * Checks if any DataChannel is currently in 'open' state.
   */
  public hasOpenDataChannel(): boolean {
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === 'open') return true;
    }
    return false;
  }

  /**
   * Wait for at least one DataChannel to become 'open', with a configurable timeout.
   */
  public async waitForOpenDataChannels(timeoutMs = 5000): Promise<RTCDataChannel[]> {
    const existing = this.getDataChannels();
    if (existing.length > 0) {
      return existing;
    }

    if (this.peerConnections.size === 0) {
      return [];
    }

    return new Promise((resolve) => {
      let resolved = false;

      const onOpen = () => {
        const channels = this.getDataChannels();
        if (channels.length > 0 && !resolved) {
          resolved = true;
          this.channelOpenListeners.delete(onOpen);
          clearTimeout(timer);
          resolve(channels);
        }
      };

      this.channelOpenListeners.add(onOpen);

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.channelOpenListeners.delete(onOpen);
          resolve(this.getDataChannels());
        }
      }, timeoutMs);
    });
  }

  /**
   * Synchronize mesh connections with the current room peer list.
   * Returns an array of peer socketIds for which this client is the designated initiator
   * and needs to create and emit an offer.
   */
  public syncMeshConnections(remoteSocketIds: string[], selfSocketId: string): string[] {
    const remoteSet = new Set(remoteSocketIds);
    const peersToOffer: string[] = [];

    // Clean up stale peer connections for peers that left
    for (const existingId of Array.from(this.peerConnections.keys())) {
      if (!remoteSet.has(existingId)) {
        console.log(`[WebRTC] Removing disconnected peer: ${existingId}`);
        this.closePeerConnection(existingId);
      }
    }

    // Ensure connection objects exist for current peers
    for (const remoteId of remoteSocketIds) {
      if (!this.peerConnections.has(remoteId)) {
        const isInitiator = selfSocketId < remoteId;
        console.log(
          `[WebRTC] Creating peer connection for ${remoteId} (isInitiator: ${isInitiator}, self: ${selfSocketId})`
        );
        this.getOrCreatePeerConnection(remoteId, isInitiator);

        if (isInitiator) {
          peersToOffer.push(remoteId);
        }
      }
    }

    return peersToOffer;
  }

  /**
   * Initialize or retrieve an RTCPeerConnection for a remote peer.
   */
  public getOrCreatePeerConnection(remoteSocketId: string, isInitiator = false): RTCPeerConnection {
    const existing = this.peerConnections.get(remoteSocketId);
    if (existing) {
      return existing;
    }

    console.log(`[WebRTC] Initializing RTCPeerConnection for peer ${remoteSocketId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // If initiator, create the DataChannel
    if (isInitiator) {
      console.log(`[DataChannel] Creating DataChannel 'fileTransfer' for peer ${remoteSocketId}`);
      const dc = pc.createDataChannel('fileTransfer', {
        ordered: true,
      });
      this.setupDataChannel(remoteSocketId, dc);
    } else {
      // Receiver listens for incoming DataChannel
      pc.ondatachannel = (event) => {
        console.log(`[DataChannel] Received incoming DataChannel from peer ${remoteSocketId}`);
        this.setupDataChannel(remoteSocketId, event.channel);
      };
    }

    // Attach local media tracks if active call is in progress
    if (this.localStream) {
      this.attachStreamToPeerConnection(pc, this.localStream);
    }

    // ICE candidate discovery
    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        console.log(`[WebRTC] Discovered ICE candidate for ${remoteSocketId}`);
        this.onIceCandidate(remoteSocketId, event.candidate.toJSON());
      }
    };

    // Remote media track listener
    pc.ontrack = (event) => {
      console.log(
        `[VIDEO] Remote ontrack fired from ${remoteSocketId}: kind=${event.track.kind}, readyState=${event.track.readyState}, enabled=${event.track.enabled}`
      );
      let stream = event.streams[0];
      if (!stream) {
        let existingStream = this.remoteStreams.get(remoteSocketId);
        if (!existingStream) {
          existingStream = new MediaStream();
          this.remoteStreams.set(remoteSocketId, existingStream);
        }
        existingStream.addTrack(event.track);
        stream = existingStream;
      } else {
        this.remoteStreams.set(remoteSocketId, stream);
      }

      console.log(
        `[VIDEO] Remote stream assigned for ${remoteSocketId}: streamId=${stream.id}, tracks=${stream.getTracks().length}`
      );

      if (this.onRemoteStream) {
        this.onRemoteStream(remoteSocketId, stream);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteSocketId} changed to: ${pc.connectionState}`);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(remoteSocketId, pc.connectionState);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (this.onRemoteStreamRemoved) {
          this.onRemoteStreamRemoved(remoteSocketId);
        }
        this.remoteStreams.delete(remoteSocketId);
        this.dataChannels.delete(remoteSocketId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${remoteSocketId}: ${pc.iceConnectionState}`);
    };

    this.peerConnections.set(remoteSocketId, pc);

    // Drain queued ICE candidates
    const pending = this.pendingCandidates.get(remoteSocketId) || [];
    if (pending.length > 0) {
      console.log(`[WebRTC] Applying ${pending.length} queued ICE candidates for ${remoteSocketId}`);
      pending.forEach((candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => {
          console.warn(`[WebRTC] Failed to add queued ICE candidate for ${remoteSocketId}:`, e);
        });
      });
      this.pendingCandidates.delete(remoteSocketId);
    }

    return pc;
  }

  private setupDataChannel(socketId: string, dc: RTCDataChannel): void {
    dc.binaryType = 'arraybuffer';

    dc.onmessage = (event) => {
      fileTransferManager.handleIncomingData(event.data, dc);
    };

    dc.onopen = () => {
      console.log(`[DataChannel] DataChannel with peer ${socketId} is now OPEN`);
      this.dataChannels.set(socketId, dc);
      if (this.onDataChannelStateChange) {
        this.onDataChannelStateChange(socketId, 'open');
      }
      this.channelOpenListeners.forEach((fn) => fn(socketId));
    };

    dc.onclose = () => {
      console.log(`[DataChannel] DataChannel with peer ${socketId} is now CLOSED`);
      this.dataChannels.delete(socketId);
      if (this.onDataChannelStateChange) {
        this.onDataChannelStateChange(socketId, 'closed');
      }
    };

    dc.onerror = (err) => {
      console.error(`[DataChannel] DataChannel error with peer ${socketId}:`, err);
      this.dataChannels.delete(socketId);
      if (this.onDataChannelStateChange) {
        this.onDataChannelStateChange(socketId, 'closed');
      }
    };

    if (dc.readyState === 'open') {
      this.dataChannels.set(socketId, dc);
      if (this.onDataChannelStateChange) {
        this.onDataChannelStateChange(socketId, 'open');
      }
      this.channelOpenListeners.forEach((fn) => fn(socketId));
    }
  }

  /**
   * Create and set local offer description.
   */
  public async createOffer(remoteSocketId: string, callType: CallType = 'data'): Promise<RTCSessionDescriptionInit> {
    const pc = this.getOrCreatePeerConnection(remoteSocketId, true);

    if (this.localStream) {
      this.attachStreamToPeerConnection(pc, this.localStream);
    }

    console.log(`[VIDEO] VIDEO_OFFER_SENT Creating offer for peer ${remoteSocketId} [type: ${callType}]`);
    const offer = await pc.createOffer(
      callType === 'data' ? { offerToReceiveAudio: false, offerToReceiveVideo: false } : undefined
    );
    await pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Receive offer, set remote description, and create answer.
   */
  public async handleOffer(
    remoteSocketId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    console.log(`[VIDEO] VIDEO_OFFER_RECEIVED from peer ${remoteSocketId}`);
    const pc = this.getOrCreatePeerConnection(remoteSocketId, false);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Attach local media tracks to the transceivers created by setRemoteDescription
    if (this.localStream) {
      this.attachStreamToPeerConnection(pc, this.localStream);
    }

    // Drain queued ICE candidates
    const pending = this.pendingCandidates.get(remoteSocketId) || [];
    if (pending.length > 0) {
      console.log(`[WebRTC] Applying ${pending.length} queued ICE candidates after setting remote offer`);
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // Ignore
        }
      }
      this.pendingCandidates.delete(remoteSocketId);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log(`[VIDEO] VIDEO_ANSWER_SENT Created local answer for peer ${remoteSocketId}`);
    return answer;
  }

  /**
   * Receive and apply remote answer.
   */
  public async handleAnswer(
    remoteSocketId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log(`[VIDEO] VIDEO_ANSWER_RECEIVED from peer ${remoteSocketId}`);
    const pc = this.peerConnections.get(remoteSocketId);
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Drain queued candidates
      const pending = this.pendingCandidates.get(remoteSocketId) || [];
      if (pending.length > 0) {
        console.log(`[WebRTC] Applying ${pending.length} queued ICE candidates after setting remote answer`);
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {
            // Ignore
          }
        }
        this.pendingCandidates.delete(remoteSocketId);
      }
    }
  }

  /**
   * Add ICE candidate from remote peer.
   */
  public async handleIceCandidate(
    remoteSocketId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.peerConnections.get(remoteSocketId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC] Error adding ICE candidate from ${remoteSocketId}:`, err);
      }
    } else {
      console.log(`[WebRTC] Queuing ICE candidate from ${remoteSocketId} until remote description is set`);
      const queue = this.pendingCandidates.get(remoteSocketId) || [];
      queue.push(candidate);
      this.pendingCandidates.set(remoteSocketId, queue);
    }
  }

  /**
   * Toggle local microphone mute.
   */
  public setMute(isMuted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
        console.log(`[VIDEO] Audio track enabled set to: ${track.enabled}`);
      });
    }
  }

  /**
   * Toggle local camera stream.
   */
  public setCameraOff(isCameraOff: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOff;
        console.log(`[VIDEO] Video track enabled set to: ${track.enabled}`);
      });
    }
  }

  /**
   * Close connection for a specific peer.
   */
  public closePeerConnection(remoteSocketId: string): void {
    const pc = this.peerConnections.get(remoteSocketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteSocketId);
    }
    const dc = this.dataChannels.get(remoteSocketId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(remoteSocketId);
    }
    this.remoteStreams.delete(remoteSocketId);
    this.pendingCandidates.delete(remoteSocketId);
    if (this.onRemoteStreamRemoved) {
      this.onRemoteStreamRemoved(remoteSocketId);
    }
  }

  /**
   * Stop all local media tracks and close all peer connections.
   */
  public stopAll(): void {
    this.stopLocalStream();
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.forEach((dc) => dc.close());
    this.dataChannels.clear();
    this.pendingCandidates.clear();
    this.channelOpenListeners.clear();
  }
}

export const webrtcManager = new WebRTCManager();
