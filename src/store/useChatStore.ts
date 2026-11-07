import { create } from 'zustand';
import type {
  ChatSessionState,
  RoomCapacity,
  SanitizedMember,
  ChatMessage,
  TypingEvent,
  CallType,
  FileTransferItem,
} from '../types/index.js';
import {
  createRoomSocket,
  joinRoomSocket,
  leaveRoomSocket,
  toggleLockSocket,
  sendMessageSocket,
  editMessageSocket,
  deleteMessageSocket,
  sendTypingSocket,
  emitCallStart,
  emitCallAccept,
  emitCallReject,
  emitCallEnd,
  emitOffer,
  emitAnswer,
  emitIceCandidate,
  emitMediaToggle,
  registerRoomSocketEvents,
  disconnectSocket,
} from '../services/socket.js';
import { webrtcManager } from '../services/webrtc.js';
import { fileTransferManager } from '../services/fileTransfer.js';

let cleanupSocketListeners: (() => void) | null = null;
const typingTimers: { [socketId: string]: ReturnType<typeof setTimeout> } = {};

const pendingMediaOffers: { [socketId: string]: { offer: RTCSessionDescriptionInit; callType: CallType } } = {};

/**
 * Ephemeral in-memory Zustand store for PersonalChat.
 * Strictly zero localStorage or persistence for messages, files, calls, or user data.
 */
export const useChatStore = create<ChatSessionState>((set, get) => {
  const syncMeshPeers = async () => {
    const selfId = get().selfSocketId;
    if (!selfId) return;
    webrtcManager.setSelfSocketId(selfId);

    const members = get().members;
    const remoteSocketIds = members.filter((m) => m.socketId !== selfId).map((m) => m.socketId);

    if (remoteSocketIds.length === 0) {
      set({ p2pStatus: 'disconnected' });
      return;
    }

    set({ p2pStatus: webrtcManager.hasOpenDataChannel() ? 'connected' : 'connecting' });

    const peersToOffer = webrtcManager.syncMeshConnections(remoteSocketIds, selfId);

    const isMediaCallActive =
      (get().callStatus === 'connected' || get().callStatus === 'calling') && Boolean(get().localStream);
    const activeCallType = get().callType || 'data';

    for (const peerSocketId of peersToOffer) {
      try {
        const offerType = isMediaCallActive ? activeCallType : 'data';
        console.log(`[WebRTC] Initiating P2P mesh offer to ${peerSocketId} [type: ${offerType}]...`);
        const offer = await webrtcManager.createOffer(peerSocketId, offerType);
        emitOffer(peerSocketId, offer, offerType);
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for peer ${peerSocketId}:`, err);
      }
    }
  };

  return {
    displayName: '',
    selfSocketId: null,
    internalId: null,
    roomCode: null,
    roomCapacity: 2,
    isHost: false,
    isLocked: false,
    members: [],
    messages: [],
    fileTransfers: {},
    pendingDownloadRequests: [],
    typingUsers: {},
    connectionStatus: 'disconnected',
    p2pStatus: 'disconnected',
    errorMessage: null,
    isLoading: false,

    // WebRTC Call State
    callStatus: 'idle',
    callType: null,
    callerInfo: null,
    activeRoomCall: null,
    isMuted: false,
    isCameraOff: false,
    facingMode: 'user',
    isCallMinimized: false,
    localStream: null,
    remoteStreams: {},
    peerMediaStates: {},

    createRoom: async (displayName: string, capacity: RoomCapacity): Promise<string> => {
      set({ isLoading: true, errorMessage: null });
      try {
        get().initSocketAndWebRTCListeners();
        const roomInfo = await createRoomSocket(displayName, capacity);

        set({
          displayName,
          selfSocketId: roomInfo.selfSocketId,
          internalId: roomInfo.internalId,
          roomCode: roomInfo.publicCode,
          roomCapacity: roomInfo.maxCapacity,
          isHost: roomInfo.isHost,
          isLocked: roomInfo.isLocked,
          members: roomInfo.members,
          messages: [],
          fileTransfers: {},
          pendingDownloadRequests: [],
          typingUsers: {},
          connectionStatus: 'connected',
          p2pStatus: 'disconnected',
          isLoading: false,
        });

        await syncMeshPeers();
        return roomInfo.publicCode;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        set({ isLoading: false, errorMessage: msg, connectionStatus: 'error' });
        throw err;
      }
    },

    joinRoom: async (displayName: string, roomCode: string): Promise<void> => {
      set({ isLoading: true, errorMessage: null });
      try {
        get().initSocketAndWebRTCListeners();
        const roomInfo = await joinRoomSocket(displayName, roomCode);

        set({
          displayName,
          selfSocketId: roomInfo.selfSocketId,
          internalId: roomInfo.internalId,
          roomCode: roomInfo.publicCode,
          roomCapacity: roomInfo.maxCapacity,
          isHost: roomInfo.isHost,
          isLocked: roomInfo.isLocked,
          members: roomInfo.members,
          activeRoomCall: roomInfo.activeCall || null,
          messages: [],
          fileTransfers: {},
          pendingDownloadRequests: [],
          typingUsers: {},
          connectionStatus: 'connected',
          p2pStatus: 'connecting',
          isLoading: false,
        });

        await syncMeshPeers();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join room';
        set({ isLoading: false, errorMessage: msg, connectionStatus: 'error' });
        throw err;
      }
    },

    sendMessage: async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      try {
        await sendMessageSocket(trimmed);
        get().sendTyping(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send message';
        set({ errorMessage: msg });
        throw err;
      }
    },

    editMessage: async (messageId: string, text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      try {
        await editMessageSocket(messageId, trimmed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to edit message';
        set({ errorMessage: msg });
        throw err;
      }
    },

    deleteMessage: async (messageId: string): Promise<void> => {
      try {
        await deleteMessageSocket(messageId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete message';
        set({ errorMessage: msg });
        throw err;
      }
    },

    sendTyping: (isTyping: boolean): void => {
      sendTypingSocket(isTyping);
    },

    /**
     * P2P File Transfer Actions
     */
    sendFile: async (file: File): Promise<void> => {
      const selfId = get().selfSocketId || 'self';
      const name = get().displayName || 'You';
      const peers = get().members.filter((m) => m.socketId !== selfId);

      if (peers.length === 0) {
        throw new Error('Waiting for other participants to join before sending files.');
      }

      // Ensure mesh connections and offers are synchronized
      await syncMeshPeers();

      // Check if open channels already exist
      let dataChannels = webrtcManager.getDataChannels();
      if (dataChannels.length === 0) {
        console.log('[FileTransfer] DataChannels currently connecting, waiting up to 5s...');
        dataChannels = await webrtcManager.waitForOpenDataChannels(5000);
      }

      if (dataChannels.length === 0) {
        throw new Error('Unable to connect to peers for file transfer. Please check network connectivity.');
      }

      try {
        await fileTransferManager.sendFile(file, selfId, name, dataChannels);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send file';
        set({ errorMessage: msg });
        throw err;
      }
    },

    sendVoiceNote: async (blob: Blob, duration: number, mimeType: string, fileName: string): Promise<void> => {
      const selfId = get().selfSocketId || 'self';
      const name = get().displayName || 'You';
      const peers = get().members.filter((m) => m.socketId !== selfId);

      if (peers.length === 0) {
        throw new Error('Waiting for other participants to join before sending voice notes.');
      }

      // Ensure mesh connections and offers are synchronized
      await syncMeshPeers();

      // Check if open channels already exist
      let dataChannels = webrtcManager.getDataChannels();
      if (dataChannels.length === 0) {
        console.log('[VoiceNote] DataChannels currently connecting, waiting up to 5s...');
        dataChannels = await webrtcManager.waitForOpenDataChannels(5000);
      }

      if (dataChannels.length === 0) {
        throw new Error('Unable to connect to peers for voice message transfer. Please check network connectivity.');
      }

      try {
        await fileTransferManager.sendVoiceNote(blob, duration, mimeType, fileName, selfId, name, dataChannels);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send voice message';
        set({ errorMessage: msg });
        throw err;
      }
    },

    cancelFileTransfer: (fileId: string): void => {
      fileTransferManager.cancelTransfer(fileId);
      set((state) => {
        const item = state.fileTransfers[fileId];
        if (!item) return state;
        return {
          fileTransfers: {
            ...state.fileTransfers,
            [fileId]: { ...item, state: 'cancelled' },
          },
        };
      });
    },

    requestFileDownload: async (fileId: string): Promise<void> => {
      const selfId = get().selfSocketId || 'self';
      const name = get().displayName || 'You';
      const channels = webrtcManager.getDataChannels();
      if (channels.length === 0) {
        throw new Error('No active P2P channel connected. Please wait for peer connection.');
      }

      try {
        fileTransferManager.requestDownload(fileId, selfId, name, channels);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to request download';
        set({ errorMessage: msg });
        throw err;
      }
    },

    respondToDownloadRequest: (transferId: string, approved: boolean): void => {
      fileTransferManager.respondToDownloadRequest(transferId, approved);
      set((state) => ({
        pendingDownloadRequests: state.pendingDownloadRequests.filter((r) => r.transferId !== transferId),
      }));
    },

    downloadFile: (fileId: string): void => {
      const item = get().fileTransfers[fileId];
      if (item && item.blobUrl) {
        const a = document.createElement('a');
        a.href = item.blobUrl;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },

    /**
     * WebRTC Call Methods
     */
    startCall: async (callType: CallType): Promise<void> => {
      set({ errorMessage: null });
      try {
        const stream = await webrtcManager.getMediaStream(callType);
        const selfId = get().selfSocketId;
        webrtcManager.setSelfSocketId(selfId);

        set({
          callStatus: 'calling',
          callType,
          localStream: stream,
          isMuted: false,
          isCameraOff: false,
          facingMode: 'user',
          isCallMinimized: false,
          activeRoomCall: selfId ? { callType, startedBy: selfId, participantCount: 1 } : null,
        });

        emitCallStart(callType);

        const peers = get().members.filter((m) => m.socketId !== selfId);

        for (const peer of peers) {
          if (selfId && selfId < peer.socketId) {
            try {
              console.log(`[WebRTC] Initiating offer to peer ${peer.socketId} [type: ${callType}]`);
              const offer = await webrtcManager.createOffer(peer.socketId, callType);
              emitOffer(peer.socketId, offer, callType);
            } catch (err) {
              console.warn(`[WebRTC] Failed to create initial offer for peer ${peer.socketId}:`, err);
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not start call';
        webrtcManager.stopLocalStream();
        set({
          errorMessage: msg,
          callStatus: 'idle',
          callType: null,
          localStream: null,
          isCallMinimized: false,
        });
        throw err;
      }
    },

    acceptCall: async (): Promise<void> => {
      const caller = get().callerInfo;
      const callType = caller?.callType || get().callType || get().activeRoomCall?.callType || 'video';
      const selfId = get().selfSocketId;
      webrtcManager.setSelfSocketId(selfId);

      set({ errorMessage: null });
      try {
        const stream = await webrtcManager.getMediaStream(callType);

        set({
          callStatus: 'connected',
          callType,
          localStream: stream,
          callerInfo: null,
          isMuted: false,
          isCameraOff: false,
          facingMode: 'user',
          isCallMinimized: false,
        });

        // Broadcast to all peers in the room that this user joined the call
        emitCallAccept();

        const peers = get().members.filter((m) => m.socketId !== selfId);

        for (const peer of peers) {
          const pending = pendingMediaOffers[peer.socketId];
          if (pending) {
            delete pendingMediaOffers[peer.socketId];
            try {
              console.log(`[WebRTC] Answering pending media offer from ${peer.socketId}`);
              const answer = await webrtcManager.handleOffer(peer.socketId, pending.offer);
              if (answer) {
                emitAnswer(peer.socketId, answer);
              }
            } catch (e) {
              console.error(`[WebRTC] Failed to handle pending offer for ${peer.socketId} on accept:`, e);
            }
          } else if (selfId && selfId < peer.socketId) {
            // Designated initiator creates offer to peer
            try {
              console.log(`[WebRTC] Designated offerer: creating offer to ${peer.socketId} [type: ${callType}]`);
              const offer = await webrtcManager.createOffer(peer.socketId, callType);
              emitOffer(peer.socketId, offer, callType);
            } catch (err) {
              console.warn(`[WebRTC] Failed to create offer to ${peer.socketId} on accept:`, err);
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not accept call';
        webrtcManager.stopLocalStream();
        set({
          errorMessage: msg,
          callStatus: 'idle',
          callerInfo: null,
          localStream: null,
          isCallMinimized: false,
        });
        if (caller) {
          emitCallReject(caller.socketId, 'Failed to acquire media devices');
        }
        throw err;
      }
    },

    rejectCall: (reason?: string): void => {
      const caller = get().callerInfo;
      if (caller) {
        delete pendingMediaOffers[caller.socketId];
        emitCallReject(caller.socketId, reason || 'User declined call');
      }
      webrtcManager.stopLocalStream();
      set({
        callStatus: 'idle',
        callerInfo: null,
        callType: null,
        localStream: null,
        isCallMinimized: false,
      });
    },

    endCall: (): void => {
      emitCallEnd();
      webrtcManager.stopLocalStream();
      webrtcManager.clearAllMediaSenders();
      for (const k in pendingMediaOffers) {
        delete pendingMediaOffers[k];
      }
      set({
        callStatus: 'idle',
        callType: null,
        callerInfo: null,
        localStream: null,
        remoteStreams: {},
        peerMediaStates: {},
        isMuted: false,
        isCameraOff: false,
        isCallMinimized: false,
        activeRoomCall: null,
      });
    },

    toggleMute: (): void => {
      const newMuted = !get().isMuted;
      webrtcManager.setMute(newMuted);
      set({ isMuted: newMuted });
      emitMediaToggle(newMuted, get().isCameraOff);
    },

    toggleCamera: (): void => {
      const newCameraOff = !get().isCameraOff;
      webrtcManager.setCameraOff(newCameraOff);
      set({ isCameraOff: newCameraOff });
      emitMediaToggle(get().isMuted, newCameraOff);
    },

    switchCamera: async (): Promise<void> => {
      try {
        const { facingMode, stream } = await webrtcManager.switchCamera();
        set({ facingMode, localStream: new MediaStream(stream.getTracks()) });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not switch camera';
        set({ errorMessage: msg });
        throw err;
      }
    },

    setCallMinimized: (minimized: boolean): void => {
      set({ isCallMinimized: minimized });
    },

    leaveRoom: async (): Promise<void> => {
      try {
        get().endCall();
        webrtcManager.stopAll();
        fileTransferManager.cleanup();
        await leaveRoomSocket();
      } catch {
        // Ignore leave errors
      } finally {
        if (cleanupSocketListeners) {
          cleanupSocketListeners();
          cleanupSocketListeners = null;
        }
        for (const timer of Object.values(typingTimers)) {
          clearTimeout(timer);
        }
        disconnectSocket();
        get().resetSession();
      }
    },

    toggleLock: async (): Promise<boolean> => {
      try {
        const res = await toggleLockSocket();
        set({ isLocked: res.isLocked });
        return res.isLocked;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to toggle room lock';
        set({ errorMessage: msg });
        throw err;
      }
    },

    clearError: () => set({ errorMessage: null }),

    resetSession: () => {
      fileTransferManager.cleanup();
      webrtcManager.stopLocalStream();
      for (const k in pendingMediaOffers) {
        delete pendingMediaOffers[k];
      }
      set({
        selfSocketId: null,
        internalId: null,
        roomCode: null,
        isHost: false,
        isLocked: false,
        roomCapacity: 2,
        members: [],
        messages: [],
        fileTransfers: {},
        pendingDownloadRequests: [],
        typingUsers: {},
        callStatus: 'idle',
        callType: null,
        callerInfo: null,
        activeRoomCall: null,
        facingMode: 'user',
        isCallMinimized: false,
        localStream: null,
        remoteStreams: {},
        peerMediaStates: {},
        connectionStatus: 'disconnected',
        p2pStatus: 'disconnected',
        isLoading: false,
        errorMessage: null,
      });
    },

    initSocketAndWebRTCListeners: () => {
      // Setup FileTransferManager callbacks
      fileTransferManager.onTransferUpdate = (item: FileTransferItem) => {
        set((state) => {
          const isNew = !state.fileTransfers[item.id];
          const updatedTransfers = { ...state.fileTransfers, [item.id]: item };

          if (isNew) {
            const chatMsg: ChatMessage = {
              id: `file-${item.id}`,
              senderId: item.senderId,
              senderName: item.senderName,
              roomCode: state.roomCode || '',
              text: item.isVoiceNote ? `[Voice Message: ${item.fileName}]` : `[File Attachment: ${item.fileName}]`,
              timestamp: item.timestamp,
              type: 'user',
              fileTransferId: item.id,
              isVoiceNote: item.isVoiceNote,
              duration: item.duration,
            };
            return {
              fileTransfers: updatedTransfers,
              messages: [...state.messages, chatMsg],
            };
          }

          return { fileTransfers: updatedTransfers };
        });
      };

      fileTransferManager.onDownloadRequest = (req) => {
        set((state) => {
          // Avoid duplicate requests
          if (state.pendingDownloadRequests.some((r) => r.transferId === req.transferId)) {
            return state;
          }
          return {
            pendingDownloadRequests: [...state.pendingDownloadRequests, req],
          };
        });
      };

      fileTransferManager.onDownloadRequestExpired = (transferId) => {
        set((state) => ({
          pendingDownloadRequests: state.pendingDownloadRequests.filter((r) => r.transferId !== transferId),
        }));
      };

      // Setup WebRTC manager callbacks
      webrtcManager.onIceCandidate = (toSocketId, candidate) => {
        emitIceCandidate(toSocketId, candidate);
      };

      webrtcManager.onRemoteStream = (socketId, stream) => {
        console.log(`[AUDIO/VIDEO] Store onRemoteStream updating state for ${socketId} (streamId: ${stream.id}, tracks: ${stream.getTracks().length})`);
        set((state) => ({
          remoteStreams: { ...state.remoteStreams, [socketId]: new MediaStream(stream.getTracks()) },
          callStatus: 'connected',
        }));
      };

      webrtcManager.onRemoteStreamRemoved = (socketId) => {
        delete pendingMediaOffers[socketId];
        set((state) => {
          const updated = { ...state.remoteStreams };
          delete updated[socketId];
          return { remoteStreams: updated };
        });
      };

      webrtcManager.onDataChannelStateChange = (_socketId, state) => {
        if (state === 'open') {
          set({ p2pStatus: 'connected' });
        } else {
          const hasAnyOpen = webrtcManager.hasOpenDataChannel();
          const remotePeers = get().members.filter((m) => m.socketId !== get().selfSocketId);
          if (hasAnyOpen) {
            set({ p2pStatus: 'connected' });
          } else if (remotePeers.length > 0) {
            set({ p2pStatus: 'connecting' });
          } else {
            set({ p2pStatus: 'disconnected' });
          }
        }
      };

      if (cleanupSocketListeners) {
        cleanupSocketListeners();
      }

      cleanupSocketListeners = registerRoomSocketEvents({
        onMemberJoined: (member: SanitizedMember) => {
          set((state) => {
            if (state.members.some((m) => m.socketId === member.socketId)) {
              return state;
            }
            return { members: [...state.members, member] };
          });
          syncMeshPeers();
        },
        onMemberLeft: (data: { socketId: string; displayName: string; newHostSocketId?: string }) => {
          delete pendingMediaOffers[data.socketId];
          webrtcManager.closePeerConnection(data.socketId);
          set((state) => {
            const updatedRemoteStreams = { ...state.remoteStreams };
            delete updatedRemoteStreams[data.socketId];
            const updatedMediaStates = { ...state.peerMediaStates };
            delete updatedMediaStates[data.socketId];

            const hasRemainingPeers = Object.keys(updatedRemoteStreams).length > 0;
            const remainingCallStatus =
              state.callStatus === 'connected' && !hasRemainingPeers ? 'idle' : state.callStatus;
            if (state.callStatus === 'connected' && !hasRemainingPeers) {
              webrtcManager.stopLocalStream();
            }

            return {
              members: state.members.filter((m) => m.socketId !== data.socketId),
              isHost: data.newHostSocketId ? data.newHostSocketId === state.selfSocketId : state.isHost,
              remoteStreams: updatedRemoteStreams,
              peerMediaStates: updatedMediaStates,
              callStatus: remainingCallStatus,
              localStream: remainingCallStatus === 'idle' ? null : state.localStream,
              callType: remainingCallStatus === 'idle' ? null : state.callType,
            };
          });
          syncMeshPeers();
        },
        onMemberListUpdated: (members: SanitizedMember[]) => {
          const selfId = get().selfSocketId;
          const currentMember = members.find((m) => m.socketId === selfId);
          set({
            members,
            isHost: currentMember ? currentMember.isHost : get().isHost,
          });

          // Re-sync WebRTC P2P DataChannel mesh
          syncMeshPeers();
        },
        onLockUpdated: (data: { isLocked: boolean }) => {
          set({ isLocked: data.isLocked });
        },
        onRoomClosed: () => {
          get().endCall();
          webrtcManager.stopAll();
          get().resetSession();
        },
        onChatMessage: (message: ChatMessage) => {
          set((state) => ({
            messages: [...state.messages, message],
          }));
        },
        onChatMessageEdited: (data: { messageId: string; text: string; editedAt: number }) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === data.messageId
                ? { ...m, text: data.text, isEdited: true, editedAt: data.editedAt }
                : m
            ),
          }));
        },
        onChatMessageDeleted: (data: { messageId: string }) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === data.messageId
                ? { ...m, text: 'This message was deleted', isDeleted: true }
                : m
            ),
          }));
        },
        onTyping: (data: TypingEvent) => {
          const selfId = get().selfSocketId;
          if (data.socketId === selfId) return;

          if (data.isTyping) {
            set((state) => ({
              typingUsers: { ...state.typingUsers, [data.socketId]: data.displayName },
            }));

            if (typingTimers[data.socketId]) {
              clearTimeout(typingTimers[data.socketId]);
            }

            typingTimers[data.socketId] = setTimeout(() => {
              set((state) => {
                const updated = { ...state.typingUsers };
                delete updated[data.socketId];
                return { typingUsers: updated };
              });
              delete typingTimers[data.socketId];
            }, 3000);
          } else {
            if (typingTimers[data.socketId]) {
              clearTimeout(typingTimers[data.socketId]);
              delete typingTimers[data.socketId];
            }
            set((state) => {
              const updated = { ...state.typingUsers };
              delete updated[data.socketId];
              return { typingUsers: updated };
            });
          }
        },
        onIncomingCall: (data: { fromSocketId: string; fromDisplayName: string; callType: CallType }) => {
          if (get().callStatus === 'idle') {
            set({
              callStatus: 'incoming',
              callerInfo: {
                socketId: data.fromSocketId,
                displayName: data.fromDisplayName,
                callType: data.callType,
              },
            });
          } else {
            emitCallReject(data.fromSocketId, 'Peer is currently in another call');
          }
        },
        onCallAccepted: async (data: { fromSocketId: string; callType?: CallType }) => {
          console.log(`[VIDEO] Call accepted by peer ${data?.fromSocketId}`);
          const selfId = get().selfSocketId;
          const isInCall =
            (get().callStatus === 'connected' || get().callStatus === 'calling') && Boolean(get().localStream);

          if (isInCall && selfId) {
            set({ callStatus: 'connected' });
            // If we are the designated offerer (selfId < fromSocketId), initiate the media offer
            if (selfId < data.fromSocketId) {
              try {
                const currentCallType = get().callType || data.callType || 'video';
                console.log(
                  `[WebRTC] Creating media offer to newly accepted peer ${data.fromSocketId} [type: ${currentCallType}]`
                );
                const offer = await webrtcManager.createOffer(data.fromSocketId, currentCallType);
                emitOffer(data.fromSocketId, offer, currentCallType);
              } catch (err) {
                console.error(`[WebRTC] Error offering to accepted peer ${data.fromSocketId}:`, err);
              }
            }
          }
        },
        onCallRejected: (data: { fromSocketId: string; reason?: string }) => {
          delete pendingMediaOffers[data.fromSocketId];
          webrtcManager.stopLocalStream();
          set({
            errorMessage: data.reason || 'Call was declined by peer',
            callStatus: 'idle',
            callType: null,
            callerInfo: null,
            localStream: null,
            isCallMinimized: false,
          });
        },
        onCallEnded: (data: { fromSocketId: string }) => {
          delete pendingMediaOffers[data.fromSocketId];
          webrtcManager.clearMediaSendersForPeer(data.fromSocketId);
          set((state) => {
            const updated = { ...state.remoteStreams };
            delete updated[data.fromSocketId];
            const updatedMediaStates = { ...state.peerMediaStates };
            delete updatedMediaStates[data.fromSocketId];

            const hasRemainingPeers = Object.keys(updated).length > 0;

            if (!hasRemainingPeers) {
              webrtcManager.stopLocalStream();
              return {
                remoteStreams: {},
                peerMediaStates: {},
                callStatus: 'idle',
                callType: null,
                callerInfo: null,
                localStream: null,
                isCallMinimized: false,
                activeRoomCall: null,
              };
            }
            return {
              remoteStreams: updated,
              peerMediaStates: updatedMediaStates,
            };
          });
        },
        onSignalOffer: async (data: {
          fromSocketId: string;
          fromDisplayName: string;
          offer: RTCSessionDescriptionInit;
          callType: CallType;
        }) => {
          try {
            console.log(
              `[VIDEO] Handling offer from ${data.fromDisplayName} (${data.fromSocketId}) [type: ${data.callType}]`
            );

            if (data.callType === 'data') {
              const answer = await webrtcManager.handleOffer(data.fromSocketId, data.offer);
              if (answer) {
                emitAnswer(data.fromSocketId, answer);
              }
              return;
            }

            // Media offer (voice / video)
            const isInCall =
              (get().callStatus === 'connected' || get().callStatus === 'calling') && Boolean(get().localStream);

            if (isInCall) {
              // Local media already acquired; answer immediately
              const answer = await webrtcManager.handleOffer(data.fromSocketId, data.offer);
              if (answer) {
                emitAnswer(data.fromSocketId, answer);
              }
            } else {
              // User has not accepted call yet; queue pending offer and ensure incoming call UI is shown
              console.log(`[VIDEO] Storing pending media offer from ${data.fromSocketId} until user accepts`);
              pendingMediaOffers[data.fromSocketId] = { offer: data.offer, callType: data.callType };
              if (get().callStatus === 'idle') {
                set({
                  callStatus: 'incoming',
                  callerInfo: {
                    socketId: data.fromSocketId,
                    displayName: data.fromDisplayName,
                    callType: data.callType,
                  },
                });
              }
            }
          } catch (err) {
            console.error(`[WebRTC] Failed to handle offer from ${data.fromSocketId}:`, err);
          }
        },
        onSignalAnswer: async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
          try {
            await webrtcManager.handleAnswer(data.fromSocketId, data.answer);
          } catch (err) {
            console.error(`[WebRTC] Failed to handle answer from ${data.fromSocketId}:`, err);
          }
        },
        onSignalIceCandidate: async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
          try {
            await webrtcManager.handleIceCandidate(data.fromSocketId, data.candidate);
          } catch (err) {
            console.error(`[WebRTC] Failed to handle ICE candidate from ${data.fromSocketId}:`, err);
          }
        },
        onSignalMediaToggle: (data: { socketId: string; isMuted: boolean; isCameraOff: boolean }) => {
          set((state) => ({
            peerMediaStates: {
              ...state.peerMediaStates,
              [data.socketId]: { isMuted: data.isMuted, isCameraOff: data.isCameraOff },
            },
          }));
        },
      });
    },
  };
});
