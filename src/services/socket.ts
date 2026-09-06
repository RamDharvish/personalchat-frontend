import { io, type Socket } from 'socket.io-client';
import type {
  RoomInfoResponse,
  RoomCapacity,
  SocketAckResponse,
  SanitizedMember,
  ChatMessage,
  TypingEvent,
  CallType,
} from '../types/index.js';

import { BACKEND_URL } from '../config.js';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      withCredentials: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const connectSocket = (): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (s.connected) {
      return resolve(s);
    }

    const onConnect = () => {
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      resolve(s);
    };

    const onError = (err: Error) => {
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      reject(err);
    };

    s.on('connect', onConnect);
    s.on('connect_error', onError);
    s.connect();
  });
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

/**
 * Socket.IO Room Engine API Handlers
 */

export const createRoomSocket = async (
  displayName: string,
  capacity: RoomCapacity
): Promise<RoomInfoResponse> => {
  const s = await connectSocket();
  return new Promise((resolve, reject) => {
    s.emit(
      'room:create',
      { displayName, capacity },
      (res: SocketAckResponse<RoomInfoResponse>) => {
        if (res.success && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.error || 'Failed to create room'));
        }
      }
    );
  });
};

export const joinRoomSocket = async (
  displayName: string,
  roomCode: string
): Promise<RoomInfoResponse> => {
  const s = await connectSocket();
  return new Promise((resolve, reject) => {
    s.emit(
      'room:join',
      { displayName, roomCode },
      (res: SocketAckResponse<RoomInfoResponse>) => {
        if (res.success && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.error || 'Failed to join room'));
        }
      }
    );
  });
};

export const leaveRoomSocket = async (): Promise<{ left: boolean }> => {
  if (!socket || !socket.connected) {
    return { left: true };
  }
  return new Promise((resolve) => {
    socket?.emit('room:leave', (res: SocketAckResponse<{ left: boolean }>) => {
      resolve(res?.data || { left: true });
    });
  });
};

export const toggleLockSocket = async (): Promise<{ isLocked: boolean }> => {
  if (!socket || !socket.connected) {
    throw new Error('Socket not connected');
  }
  return new Promise((resolve, reject) => {
    socket?.emit('room:toggle-lock', (res: SocketAckResponse<{ isLocked: boolean }>) => {
      if (res.success && res.data) {
        resolve(res.data);
      } else {
        reject(new Error(res.error || 'Failed to toggle room lock'));
      }
    });
  });
};

/**
 * Live Text Messaging & Typing Socket Handlers
 */

export const sendMessageSocket = async (text: string): Promise<ChatMessage> => {
  if (!socket || !socket.connected) {
    throw new Error('Socket not connected');
  }
  return new Promise((resolve, reject) => {
    socket?.emit('chat:message', { text }, (res: SocketAckResponse<ChatMessage>) => {
      if (res.success && res.data) {
        resolve(res.data);
      } else {
        reject(new Error(res.error || 'Failed to send message'));
      }
    });
  });
};

export const editMessageSocket = async (messageId: string, text: string): Promise<ChatMessage> => {
  if (!socket || !socket.connected) {
    throw new Error('Socket not connected');
  }
  return new Promise((resolve, reject) => {
    socket?.emit(
      'chat:edit-message',
      { messageId, text },
      (res: SocketAckResponse<ChatMessage>) => {
        if (res.success && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.error || 'Failed to edit message'));
        }
      }
    );
  });
};

export const deleteMessageSocket = async (messageId: string): Promise<{ messageId: string }> => {
  if (!socket || !socket.connected) {
    throw new Error('Socket not connected');
  }
  return new Promise((resolve, reject) => {
    socket?.emit(
      'chat:delete-message',
      { messageId },
      (res: SocketAckResponse<{ messageId: string }>) => {
        if (res.success && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.error || 'Failed to delete message'));
        }
      }
    );
  });
};

export const sendTypingSocket = (isTyping: boolean): void => {
  if (socket && socket.connected) {
    socket.emit('chat:typing', { isTyping });
  }
};

/**
 * WebRTC Signaling Socket Handlers
 */

export const emitCallStart = (callType: CallType): void => {
  if (socket && socket.connected) {
    socket.emit('signal:call-start', { callType });
  }
};

export const emitCallAccept = (toSocketId?: string): void => {
  if (socket && socket.connected) {
    socket.emit('signal:call-accept', { toSocketId });
  }
};

export const emitCallReject = (toSocketId?: string, reason?: string): void => {
  if (socket && socket.connected) {
    socket.emit('signal:call-reject', { toSocketId, reason });
  }
};

export const emitCallEnd = (): void => {
  if (socket && socket.connected) {
    socket.emit('signal:call-end');
  }
};

export const emitOffer = (
  toSocketId: string,
  offer: RTCSessionDescriptionInit,
  callType: CallType
): void => {
  if (socket && socket.connected) {
    socket.emit('signal:offer', { toSocketId, offer, callType });
  }
};

export const emitAnswer = (toSocketId: string, answer: RTCSessionDescriptionInit): void => {
  if (socket && socket.connected) {
    socket.emit('signal:answer', { toSocketId, answer });
  }
};

export const emitIceCandidate = (toSocketId: string, candidate: RTCIceCandidateInit): void => {
  if (socket && socket.connected) {
    socket.emit('signal:ice-candidate', { toSocketId, candidate });
  }
};

export const emitMediaToggle = (isMuted: boolean, isCameraOff: boolean): void => {
  if (socket && socket.connected) {
    socket.emit('signal:media-toggle', { isMuted, isCameraOff });
  }
};

/**
 * Register global room and signaling event listeners
 */
export const registerRoomSocketEvents = (handlers: {
  onMemberJoined?: (member: SanitizedMember) => void;
  onMemberLeft?: (data: { socketId: string; displayName: string; newHostSocketId?: string }) => void;
  onMemberListUpdated?: (members: SanitizedMember[]) => void;
  onLockUpdated?: (data: { isLocked: boolean }) => void;
  onRoomClosed?: (data: { reason: string }) => void;
  onRoomError?: (data: { message: string }) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onChatMessageEdited?: (data: { messageId: string; text: string; editedAt: number }) => void;
  onChatMessageDeleted?: (data: { messageId: string }) => void;
  onTyping?: (data: TypingEvent) => void;
  // WebRTC
  onIncomingCall?: (data: { fromSocketId: string; fromDisplayName: string; callType: CallType }) => void;
  onCallAccepted?: (data: { fromSocketId: string }) => void;
  onCallRejected?: (data: { fromSocketId: string; reason?: string }) => void;
  onCallEnded?: (data: { fromSocketId: string }) => void;
  onSignalOffer?: (data: { fromSocketId: string; fromDisplayName: string; offer: RTCSessionDescriptionInit; callType: CallType }) => void;
  onSignalAnswer?: (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => void;
  onSignalIceCandidate?: (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => void;
  onSignalMediaToggle?: (data: { socketId: string; isMuted: boolean; isCameraOff: boolean }) => void;
}): (() => void) => {
  const s = getSocket();

  if (handlers.onMemberJoined) s.on('room:member-joined', handlers.onMemberJoined);
  if (handlers.onMemberLeft) s.on('room:member-left', handlers.onMemberLeft);
  if (handlers.onMemberListUpdated) s.on('room:member-list-updated', handlers.onMemberListUpdated);
  if (handlers.onLockUpdated) s.on('room:lock-updated', handlers.onLockUpdated);
  if (handlers.onRoomClosed) s.on('room:closed', handlers.onRoomClosed);
  if (handlers.onRoomError) s.on('room:error', handlers.onRoomError);
  if (handlers.onChatMessage) s.on('chat:message', handlers.onChatMessage);
  if (handlers.onChatMessageEdited) s.on('chat:message-edited', handlers.onChatMessageEdited);
  if (handlers.onChatMessageDeleted) s.on('chat:message-deleted', handlers.onChatMessageDeleted);
  if (handlers.onTyping) s.on('chat:typing', handlers.onTyping);

  // WebRTC events
  if (handlers.onIncomingCall) s.on('signal:incoming-call', handlers.onIncomingCall);
  if (handlers.onCallAccepted) s.on('signal:call-accepted', handlers.onCallAccepted);
  if (handlers.onCallRejected) s.on('signal:call-rejected', handlers.onCallRejected);
  if (handlers.onCallEnded) s.on('signal:call-ended', handlers.onCallEnded);
  if (handlers.onSignalOffer) s.on('signal:offer', handlers.onSignalOffer);
  if (handlers.onSignalAnswer) s.on('signal:answer', handlers.onSignalAnswer);
  if (handlers.onSignalIceCandidate) s.on('signal:ice-candidate', handlers.onSignalIceCandidate);
  if (handlers.onSignalMediaToggle) s.on('signal:media-toggle', handlers.onSignalMediaToggle);

  return () => {
    if (handlers.onMemberJoined) s.off('room:member-joined', handlers.onMemberJoined);
    if (handlers.onMemberLeft) s.off('room:member-left', handlers.onMemberLeft);
    if (handlers.onMemberListUpdated) s.off('room:member-list-updated', handlers.onMemberListUpdated);
    if (handlers.onLockUpdated) s.off('room:lock-updated', handlers.onLockUpdated);
    if (handlers.onRoomClosed) s.off('room:closed', handlers.onRoomClosed);
    if (handlers.onRoomError) s.off('room:error', handlers.onRoomError);
    if (handlers.onChatMessage) s.off('chat:message', handlers.onChatMessage);
    if (handlers.onChatMessageEdited) s.off('chat:message-edited', handlers.onChatMessageEdited);
    if (handlers.onChatMessageDeleted) s.off('chat:message-deleted', handlers.onChatMessageDeleted);
    if (handlers.onTyping) s.off('chat:typing', handlers.onTyping);

    if (handlers.onIncomingCall) s.off('signal:incoming-call', handlers.onIncomingCall);
    if (handlers.onCallAccepted) s.off('signal:call-accepted', handlers.onCallAccepted);
    if (handlers.onCallRejected) s.off('signal:call-rejected', handlers.onCallRejected);
    if (handlers.onCallEnded) s.off('signal:call-ended', handlers.onCallEnded);
    if (handlers.onSignalOffer) s.off('signal:offer', handlers.onSignalOffer);
    if (handlers.onSignalAnswer) s.off('signal:answer', handlers.onSignalAnswer);
    if (handlers.onSignalIceCandidate) s.off('signal:ice-candidate', handlers.onSignalIceCandidate);
    if (handlers.onSignalMediaToggle) s.off('signal:media-toggle', handlers.onSignalMediaToggle);
  };
};
