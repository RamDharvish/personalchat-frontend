/**
 * Type definitions for PersonalChat Client
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type RoomCapacity = number;

export type CallType = 'voice' | 'video' | 'data';

export type P2PConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected';

export type FileTransferState =
  | 'offered'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'preparing'
  | 'sending'
  | 'receiving'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface SanitizedMember {
  socketId: string;
  displayName: string;
  isHost: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  roomCode: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system';
  fileTransferId?: string;
  isVoiceNote?: boolean;
  duration?: number;
  isEdited?: boolean;
  editedAt?: number;
  isDeleted?: boolean;
}

export interface FileTransferItem {
  id: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress: number; // 0 to 100
  state: FileTransferState;
  blobUrl?: string;
  isSelf: boolean;
  timestamp: number;
  error?: string;
  isVoiceNote?: boolean;
  duration?: number;
}

export interface DownloadRequest {
  transferId: string;
  fileId: string;
  requesterSocketId: string;
  requesterName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  receivedAt: number;
}

export interface TypingEvent {
  socketId: string;
  displayName: string;
  isTyping: boolean;
}

export interface CallerInfo {
  socketId: string;
  displayName: string;
  callType: CallType;
}

export interface PeerMediaState {
  isMuted: boolean;
  isCameraOff: boolean;
}

export interface RoomInfoResponse {
  internalId: string;
  publicCode: string;
  maxCapacity: RoomCapacity;
  isHost: boolean;
  isLocked: boolean;
  members: SanitizedMember[];
  selfSocketId: string;
}

export interface SocketAckResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ChatSessionState {
  displayName: string;
  selfSocketId: string | null;
  internalId: string | null;
  roomCode: string | null;
  roomCapacity: RoomCapacity;
  isHost: boolean;
  isLocked: boolean;
  members: SanitizedMember[];
  messages: ChatMessage[];
  fileTransfers: { [fileId: string]: FileTransferItem };
  pendingDownloadRequests: DownloadRequest[];
  typingUsers: { [socketId: string]: string }; // socketId -> displayName
  connectionStatus: ConnectionStatus;
  p2pStatus: P2PConnectionStatus;
  errorMessage: string | null;
  isLoading: boolean;
  
  // WebRTC Call State
  callStatus: CallStatus;
  callType: CallType | null;
  callerInfo: CallerInfo | null;
  isMuted: boolean;
  isCameraOff: boolean;
  facingMode: 'user' | 'environment';
  isCallMinimized: boolean;
  localStream: MediaStream | null;
  remoteStreams: { [socketId: string]: MediaStream };
  peerMediaStates: { [socketId: string]: PeerMediaState };
  
  // Real-time Room & Chat Actions
  createRoom: (displayName: string, capacity: RoomCapacity) => Promise<string>;
  joinRoom: (displayName: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  toggleLock: () => Promise<boolean>;
  sendMessage: (text: string) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  
  // WebRTC Call Actions
  startCall: (callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
  setCallMinimized: (minimized: boolean) => void;
  
  // P2P File Transfer & Approval Actions
  sendFile: (file: File) => Promise<void>;
  sendVoiceNote: (blob: Blob, duration: number, mimeType: string, fileName: string) => Promise<void>;
  cancelFileTransfer: (fileId: string) => void;
  requestFileDownload: (fileId: string) => Promise<void>;
  respondToDownloadRequest: (transferId: string, approved: boolean) => void;
  downloadFile: (fileId: string) => void;
  
  clearError: () => void;
  resetSession: () => void;
  initSocketAndWebRTCListeners: () => void;
}
