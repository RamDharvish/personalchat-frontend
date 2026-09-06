import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Stack,
  Chip,
  IconButton,
  TextField,
  Avatar,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme,
  Drawer,
  CircularProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/useChatStore.js';
import { Header } from '../components/Layout/Header.js';
import { VideoGrid } from '../components/Call/VideoGrid.js';
import { CallControls } from '../components/Call/CallControls.js';
import { IncomingCallDialog } from '../components/Call/IncomingCallDialog.js';
import { FileCard } from '../components/Chat/FileCard.js';
import { DownloadApprovalDialog } from '../components/Chat/DownloadApprovalDialog.js';
import { MAX_FILE_SIZE_BYTES } from '../services/fileTransfer.js';
import { voiceRecorder } from '../services/voiceRecorder.js';
import type { CallType, ChatMessage } from '../types/index.js';

export const RoomPage: React.FC = () => {
  const { roomCode: routeRoomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const selfSocketId = useChatStore((state) => state.selfSocketId);
  const roomCode = useChatStore((state) => state.roomCode);
  const isHost = useChatStore((state) => state.isHost);
  const isLocked = useChatStore((state) => state.isLocked);
  const roomCapacity = useChatStore((state) => state.roomCapacity);
  const members = useChatStore((state) => state.members);
  const messages = useChatStore((state) => state.messages);
  const fileTransfers = useChatStore((state) => state.fileTransfers);
  const typingUsers = useChatStore((state) => state.typingUsers);
  const connectionStatus = useChatStore((state) => state.connectionStatus);
  const p2pStatus = useChatStore((state) => state.p2pStatus);

  // WebRTC Call State
  const callStatus = useChatStore((state) => state.callStatus);
  const callType = useChatStore((state) => state.callType);
  const startCall = useChatStore((state) => state.startCall);

  const leaveRoom = useChatStore((state) => state.leaveRoom);
  const toggleLock = useChatStore((state) => state.toggleLock);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const sendTyping = useChatStore((state) => state.sendTyping);
  const sendFile = useChatStore((state) => state.sendFile);
  const sendVoiceNote = useChatStore((state) => state.sendVoiceNote);

  const [messageInput, setMessageInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);
  const [actionSnackbar, setActionSnackbar] = useState<string | null>(null);

  // Voice Note Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Message Edit and Delete States
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenuMessage, setActiveMenuMessage] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup microphone on unmount if actively recording
  useEffect(() => {
    return () => {
      voiceRecorder.cancelRecording();
    };
  }, []);

  // Auto-redirect if not in an active room
  useEffect(() => {
    if (!selfSocketId || !roomCode) {
      navigate('/join');
    }
  }, [selfSocketId, roomCode, navigate]);

  // Auto-scroll to bottom on new messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, fileTransfers, typingUsers, callStatus]);

  const activeCode = roomCode || routeRoomCode || '----';

  const handleCopyCode = () => {
    if (activeCode && activeCode !== '----') {
      navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, message: ChatMessage) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setActiveMenuMessage(message);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setActiveMenuMessage(null);
  };

  const handleStartEdit = () => {
    if (activeMenuMessage) {
      setEditingMessageId(activeMenuMessage.id);
      setEditingText(activeMenuMessage.text);
    }
    handleCloseMenu();
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      await editMessage(messageId, trimmed);
      setEditingMessageId(null);
      setEditingText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to edit message';
      setActionSnackbar(msg);
    }
  };

  const handleOpenDeleteConfirm = () => {
    if (activeMenuMessage) {
      setDeleteConfirmMessageId(activeMenuMessage.id);
    }
    handleCloseMenu();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmMessageId) return;
    const idToDelete = deleteConfirmMessageId;
    setDeleteConfirmMessageId(null);
    try {
      await deleteMessage(idToDelete);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete message';
      setActionSnackbar(msg);
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    navigate('/');
  };

  const handleToggleLock = async () => {
    try {
      const newLockState = await toggleLock();
      setActionSnackbar(`Room is now ${newLockState ? 'Locked' : 'Unlocked'}.`);
    } catch {
      setActionSnackbar('Only the host can toggle room lock.');
    }
  };

  const handleStartCall = async (type: CallType) => {
    if (members.length < 2) {
      setActionSnackbar('Waiting for other members to join before starting a call.');
      return;
    }
    try {
      await startCall(type);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      setActionSnackbar(msg);
    }
  };

  const handleFileButtonClick = () => {
    if (members.length < 2) {
      setActionSnackbar('Waiting for peers to join before sending files.');
      return;
    }
    if (p2pStatus === 'connecting') {
      setActionSnackbar('Connecting P2P DataChannel... File will transfer as soon as connected.');
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setActionSnackbar(`File size exceeds 100 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      e.target.value = '';
      return;
    }

    try {
      setActionSnackbar(`Preparing P2P transfer for ${file.name}...`);
      await sendFile(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate file transfer';
      setActionSnackbar(msg);
    }

    e.target.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    sendTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!text) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(false);

    setMessageInput('');
    try {
      await sendMessage(text);
    } catch {
      setActionSnackbar('Failed to send message.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartRecordingVoice = async () => {
    if (members.length < 2) {
      setActionSnackbar('Waiting for other members to join before sending voice notes.');
      return;
    }

    try {
      await voiceRecorder.startRecording(
        (durationSec) => {
          setRecordingDuration(durationSec);
        },
        async () => {
          // Auto-stopped at max duration (5 min)
          setActionSnackbar('Maximum recording duration reached (5 min). Sending voice message...');
          await handleStopAndSendVoice();
        }
      );
      setIsRecordingVoice(true);
      setRecordingDuration(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied or unavailable.';
      setActionSnackbar(msg);
      setIsRecordingVoice(false);
    }
  };

  const handleCancelRecordingVoice = () => {
    voiceRecorder.cancelRecording();
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  const handleStopAndSendVoice = async () => {
    try {
      const result = await voiceRecorder.stopRecording();
      setIsRecordingVoice(false);
      setRecordingDuration(0);

      if (!result) return;

      setActionSnackbar('Preparing voice message...');
      await sendVoiceNote(result.blob, result.durationSeconds, result.mimeType, result.fileName);
      setActionSnackbar('Voice message sent.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send voice message';
      setActionSnackbar(msg);
    }
  };

  const formatRecordingTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const typingNames = Object.values(typingUsers);
  const isCallActive = callStatus === 'calling' || callStatus === 'connected';

  // Render members sidebar content
  const membersContent = (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleOutlineRoundedIcon fontSize="small" sx={{ color: '#818cf8' }} />
          Room Members
        </Typography>
        <Chip
          label={`${members.length} / ${roomCapacity} Connected`}
          size="small"
          variant="outlined"
          sx={{
            borderColor: 'rgba(99, 102, 241, 0.4)',
            color: '#a5b4fc',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      <List sx={{ flex: 1, p: 1.5, overflowY: 'auto' }}>
        {/* Connected Members */}
        {members.map((member) => {
          const isSelf = member.socketId === selfSocketId;
          return (
            <ListItem
              key={member.socketId}
              sx={{
                borderRadius: 2,
                backgroundColor: isSelf ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isSelf ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                mb: 1,
                py: 1,
              }}
            >
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 0 2px #111726',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: isSelf ? '#6366f1' : '#0891b2',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      width: 36,
                      height: 36,
                    }}
                  >
                    {member.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {member.displayName}
                    </Typography>
                    {isSelf && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        (You)
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  <Chip
                    label={member.isHost ? 'Host' : 'Member'}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: member.isHost ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      color: member.isHost ? '#a5b4fc' : 'text.secondary',
                      mt: 0.5,
                    }}
                  />
                }
              />
            </ListItem>
          );
        })}

        {/* Empty slots placeholders */}
        {Array.from({ length: Math.max(0, roomCapacity - members.length) }).map((_, index) => (
          <ListItem
            key={`empty-${index}`}
            sx={{
              borderRadius: 2,
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              mb: 1,
              py: 1,
              opacity: 0.5,
            }}
          >
            <ListItemAvatar>
              <Avatar
                sx={{
                  bgcolor: 'transparent',
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  color: 'text.secondary',
                  width: 36,
                  height: 36,
                }}
              >
                <PersonOutlineRoundedIcon fontSize="small" />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  Waiting for Peer #{members.length + index + 1}...
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary">
                  Share code {activeCode} to join
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>

      {/* Privacy note */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#34d399' }}>
          <ShieldRoundedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" fontWeight={600}>
            Direct P2P DataChannel
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
          Files stream directly peer-to-peer without server storage.
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ height: '100dvh', maxHeight: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />

      <Box sx={{ flex: 1, minHeight: 0, p: { xs: 1, sm: 2 }, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <Card
          sx={{
            width: '100%',
            maxWidth: 1200,
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Connection Error / Lost Banner */}
          {connectionStatus === 'disconnected' && (
            <Alert
              severity="warning"
              icon={<WifiOffRoundedIcon />}
              sx={{ borderRadius: 0, py: 0.5, flexShrink: 0 }}
            >
              Connection lost. Attempting to reconnect...
            </Alert>
          )}

          {/* Room Top Bar */}
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(17, 23, 38, 0.95)',
              flexShrink: 0,
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            {/* Room Code & Lock Status */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                  ROOM CODE
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 800,
                      letterSpacing: '0.15em',
                      color: '#a5b4fc',
                    }}
                  >
                    #{activeCode}
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy Room Code'}>
                    <IconButton
                      id="copy-room-code-btn"
                      size="small"
                      onClick={handleCopyCode}
                      sx={{
                        color: copied ? '#10b981' : 'text.secondary',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.15)' },
                      }}
                    >
                      {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              {/* Lock Badge / Toggle */}
              {isHost ? (
                <Tooltip title={isLocked ? 'Click to Unlock Room' : 'Click to Lock Room'}>
                  <Chip
                    id="host-lock-toggle-btn"
                    icon={isLocked ? <LockOutlinedIcon /> : <LockOpenRoundedIcon />}
                    label={isLocked ? 'Locked' : 'Open'}
                    size="small"
                    onClick={handleToggleLock}
                    clickable
                    sx={{
                      backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isLocked ? '#f87171' : '#34d399',
                      borderColor: isLocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                      fontWeight: 600,
                    }}
                  />
                </Tooltip>
              ) : (
                <Chip
                  icon={isLocked ? <LockOutlinedIcon /> : <LockOpenRoundedIcon />}
                  label={isLocked ? 'Locked' : 'Open'}
                  size="small"
                  sx={{
                    backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isLocked ? '#f87171' : '#34d399',
                    fontWeight: 600,
                  }}
                />
              )}

              {/* P2P Mesh Connection Status */}
              {members.length > 1 && (
                <Tooltip
                  title={
                    p2pStatus === 'connected'
                      ? 'P2P DataChannel mesh is active (Direct peer-to-peer file transfer ready)'
                      : 'Establishing direct P2P mesh connection...'
                  }
                >
                  <Chip
                    id="p2p-status-chip"
                    icon={
                      p2pStatus === 'connected' ? (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            display: 'inline-block',
                            marginLeft: 8,
                          }}
                        />
                      ) : (
                        <CircularProgress size={10} color="inherit" sx={{ ml: 1 }} />
                      )
                    }
                    label={p2pStatus === 'connected' ? 'P2P Ready' : 'Connecting P2P...'}
                    size="small"
                    sx={{
                      backgroundColor:
                        p2pStatus === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      color: p2pStatus === 'connected' ? '#34d399' : '#fbbf24',
                      borderColor:
                        p2pStatus === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                      fontWeight: 600,
                    }}
                  />
                </Tooltip>
              )}

              {/* Active Call Status Pill */}
              {isCallActive && (
                <Chip
                  icon={
                    callStatus === 'calling' ? (
                      <CircularProgress size={12} color="inherit" />
                    ) : callType === 'video' ? (
                      <VideocamRoundedIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <CallRoundedIcon sx={{ fontSize: 14 }} />
                    )
                  }
                  label={
                    callStatus === 'calling'
                      ? 'Calling peers...'
                      : `In ${callType === 'video' ? 'Video' : 'Voice'} Call`
                  }
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    color: '#a5b4fc',
                    borderColor: '#6366f1',
                    fontWeight: 700,
                    animation: callStatus === 'calling' ? 'pulse 1.5s infinite' : 'none',
                  }}
                />
              )}

              {isMobile && (
                <Button
                  id="mobile-members-toggle-btn"
                  variant="outlined"
                  size="small"
                  startIcon={<PeopleOutlineRoundedIcon />}
                  onClick={() => setMobileMembersOpen(true)}
                  sx={{ borderColor: 'rgba(255, 255, 255, 0.15)', ml: 1 }}
                >
                  Members ({members.length}/{roomCapacity})
                </Button>
              )}
            </Stack>

            {/* Room Actions */}
            <Stack direction="row" spacing={1} alignItems="center">
              {!isCallActive && (
                <>
                  <Tooltip title="Start Voice Call">
                    <IconButton
                      id="voice-call-start-btn"
                      color="primary"
                      onClick={() => handleStartCall('voice')}
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.25)' },
                      }}
                    >
                      <CallRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Start Video Call">
                    <IconButton
                      id="video-call-start-btn"
                      color="secondary"
                      onClick={() => handleStartCall('video')}
                      sx={{
                        backgroundColor: 'rgba(6, 182, 212, 0.12)',
                        '&:hover': { backgroundColor: 'rgba(6, 182, 212, 0.25)' },
                      }}
                    >
                      <VideocamRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

              <Button
                id="leave-room-btn"
                variant="outlined"
                color="error"
                size="small"
                startIcon={<ExitToAppRoundedIcon />}
                onClick={handleLeaveRoom}
                sx={{
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: '#ef4444',
                  },
                }}
              >
                Leave
              </Button>
            </Stack>
          </Box>

          {/* WebRTC Video Call Area (When Active) */}
          {isCallActive && (
            <Box
              sx={{
                flexShrink: 0,
                maxHeight: { xs: '36vh', sm: '40vh', md: '44vh' },
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <VideoGrid />
              <CallControls />
            </Box>
          )}

          {/* Main Content: Split Sidebar + Chat Area */}
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {/* Desktop Members Sidebar */}
            {!isMobile && (
              <Box
                sx={{
                  width: { md: 250, lg: 270 },
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(15, 21, 35, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {membersContent}
              </Box>
            )}

            {/* Mobile Drawer for Members */}
            {isMobile && (
              <Drawer
                anchor="left"
                open={mobileMembersOpen}
                onClose={() => setMobileMembersOpen(false)}
                PaperProps={{
                  sx: {
                    width: 280,
                    backgroundColor: '#111726',
                    backgroundImage: 'none',
                  },
                }}
              >
                {membersContent}
              </Drawer>
            )}

            {/* Chat Workspace */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              {/* Ephemeral Privacy Notice */}
              <Alert
                icon={<LockOutlinedIcon fontSize="inherit" />}
                severity="info"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  color: '#cbd5e1',
                  borderRadius: 0,
                  borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
                  py: 0.4,
                  px: 1.5,
                  flexShrink: 0,
                  '& .MuiAlert-icon': { color: '#818cf8' },
                  fontSize: '0.78rem',
                }}
              >
                Ephemeral conversation. Messages, calls, and files stream directly between peers and are wiped on exit.
              </Alert>

              {/* Chat Message Timeline Area */}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  p: { xs: 1.2, sm: 2 },
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                {messages.length === 0 ? (
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      p: 3,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: 420,
                        p: 3,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom color="#a5b4fc">
                        Room #{activeCode} is Ready
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Send a message, start a call, or attach files. No data is stored on server disk.
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  messages.map((msg) => {
                    if (msg.type === 'system') {
                      return (
                        <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                          <Chip
                            label={msg.text}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#94a3b8',
                              fontSize: '0.75rem',
                              height: 'auto',
                              py: 0.5,
                              px: 1,
                              '& .MuiChip-label': { whiteSpace: 'normal' },
                            }}
                          />
                        </Box>
                      );
                    }

                    const isSelf = msg.senderId === selfSocketId;
                    const fileItem = msg.fileTransferId ? fileTransfers[msg.fileTransferId] : undefined;

                    // If message is a file transfer card
                    if (fileItem) {
                      return (
                        <Box
                          key={msg.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isSelf ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: isSelf ? '#a5b4fc' : '#94a3b8',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              mb: 0.3,
                              px: 1,
                            }}
                          >
                            {isSelf ? 'You' : msg.senderName} • {formatTimestamp(msg.timestamp)}
                          </Typography>
                          <FileCard item={fileItem} />
                        </Box>
                      );
                    }

                    // Standard text message bubble
                    const isEditing = editingMessageId === msg.id;

                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isSelf ? 'flex-end' : 'flex-start',
                          position: 'relative',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3, px: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isSelf ? '#a5b4fc' : '#94a3b8',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                            }}
                          >
                            {isSelf ? 'You' : msg.senderName} • {formatTimestamp(msg.timestamp)}
                          </Typography>
                          {msg.isEdited && !msg.isDeleted && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#94a3b8',
                                fontSize: '0.68rem',
                                fontStyle: 'italic',
                              }}
                            >
                              (edited)
                            </Typography>
                          )}
                        </Box>

                        {isEditing ? (
                          <Box
                            sx={{
                              width: '100%',
                              minWidth: { xs: 240, sm: 320 },
                              maxWidth: { xs: '90%', sm: '75%' },
                              p: 1.5,
                              borderRadius: 3,
                              backgroundColor: 'rgba(30, 41, 59, 0.95)',
                              border: '1px solid #6366f1',
                              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                            }}
                          >
                            <TextField
                              fullWidth
                              multiline
                              size="small"
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEdit(msg.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: 2,
                                  color: '#ffffff',
                                  fontSize: '0.9rem',
                                },
                              }}
                            />
                            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
                              <Button
                                size="small"
                                variant="text"
                                onClick={handleCancelEdit}
                                sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem' }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={!editingText.trim()}
                                onClick={() => handleSaveEdit(msg.id)}
                                sx={{
                                  backgroundColor: '#6366f1',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  '&:hover': { backgroundColor: '#4f46e5' },
                                }}
                              >
                                Save
                              </Button>
                            </Stack>
                          </Box>
                        ) : msg.isDeleted ? (
                          <Box
                            sx={{
                              maxWidth: { xs: '85%', sm: '70%' },
                              p: 1.2,
                              px: 1.8,
                              borderRadius: 3,
                              borderTopRightRadius: isSelf ? 0 : 12,
                              borderTopLeftRadius: isSelf ? 12 : 0,
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px dashed rgba(255, 255, 255, 0.12)',
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontStyle: 'italic',
                                color: 'rgba(255, 255, 255, 0.45)',
                                fontSize: '0.85rem',
                              }}
                            >
                              This message was deleted
                            </Typography>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              flexDirection: isSelf ? 'row' : 'row-reverse',
                              maxWidth: { xs: '90%', sm: '75%' },
                              '&:hover .message-action-btn': {
                                opacity: 1,
                              },
                            }}
                          >
                            {isSelf && (
                              <IconButton
                                className="message-action-btn"
                                size="small"
                                onClick={(e) => handleOpenMenu(e, msg)}
                                sx={{
                                  color: 'rgba(255, 255, 255, 0.4)',
                                  opacity: { xs: 0.7, sm: 0 },
                                  transition: 'opacity 0.2s',
                                  p: 0.5,
                                  '&:hover': {
                                    color: '#ffffff',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  },
                                }}
                              >
                                <MoreVertRoundedIcon fontSize="small" />
                              </IconButton>
                            )}

                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 3,
                                borderTopRightRadius: isSelf ? 0 : 12,
                                borderTopLeftRadius: isSelf ? 12 : 0,
                                backgroundColor: isSelf ? '#4f46e5' : 'rgba(30, 41, 59, 0.9)',
                                color: '#ffffff',
                                boxShadow: isSelf
                                  ? '0 4px 14px rgba(79, 70, 229, 0.3)'
                                  : '0 4px 14px rgba(0, 0, 0, 0.2)',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                                {msg.text}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })
                )}

                {/* Typing Indicator Display */}
                {typingNames.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#38bdf8',
                        fontStyle: 'italic',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing...
                    </Typography>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              {/* Hidden File Input for P2P File Sharing */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {/* Message Input Bar or Voice Recording Interface */}
              {isRecordingVoice ? (
                <Box
                  sx={{
                    p: { xs: 1.2, sm: 1.5 },
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(17, 23, 38, 0.98)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    flexWrap: 'wrap',
                    flexShrink: 0,
                    zIndex: 10,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 10px #ef4444',
                      }}
                    />
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#f87171' }}>
                      Recording Voice Note...
                    </Typography>
                    <Chip
                      label={`${formatRecordingTime(recordingDuration)} / 05:00`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#fca5a5',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1.5}>
                    <Button
                      id="cancel-voice-record-btn"
                      variant="outlined"
                      color="inherit"
                      size="small"
                      startIcon={<CloseRoundedIcon />}
                      onClick={handleCancelRecordingVoice}
                      sx={{
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: '#cbd5e1',
                        '&:hover': { borderColor: '#f87171', color: '#f87171' },
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      id="stop-and-send-voice-btn"
                      variant="contained"
                      size="small"
                      startIcon={<SendRoundedIcon />}
                      onClick={handleStopAndSendVoice}
                      sx={{
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        fontWeight: 700,
                        '&:hover': { backgroundColor: '#dc2626' },
                      }}
                    >
                      Send Voice Note
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box
                  component="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  sx={{
                    p: { xs: 1.2, sm: 1.5 },
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(17, 23, 38, 0.98)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexShrink: 0,
                    zIndex: 10,
                  }}
                >
                  <Tooltip title="Direct P2P File Transfer (Max 100 MB)">
                    <IconButton
                      id="attachment-btn"
                      onClick={handleFileButtonClick}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': { color: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)' },
                      }}
                    >
                      <AttachFileRoundedIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Record P2P Voice Note (Max 5 min)">
                    <IconButton
                      id="voice-note-record-btn"
                      onClick={handleStartRecordingVoice}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': { color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                      }}
                    >
                      <MicRoundedIcon />
                    </IconButton>
                  </Tooltip>

                  <TextField
                    id="chat-message-input"
                    fullWidth
                    multiline
                    maxRows={4}
                    size="small"
                    placeholder="Type a message (Enter to send, Shift+Enter for newline)..."
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      },
                    }}
                  />

                  <Tooltip title="Send Message">
                    <span>
                      <IconButton
                        id="send-message-btn"
                        type="submit"
                        color="primary"
                        disabled={!messageInput.trim()}
                        sx={{
                          backgroundColor: messageInput.trim() ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                          color: '#ffffff',
                          '&:hover': { backgroundColor: '#4f46e5' },
                          '&.Mui-disabled': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'rgba(255, 255, 255, 0.2)',
                          },
                        }}
                      >
                        <SendRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Incoming Call Notification Dialog */}
      <IncomingCallDialog />

      {/* Message Action Menu (Edit / Delete) */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e293b',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            minWidth: 130,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <MenuItem
          id="message-edit-menu-item"
          onClick={handleStartEdit}
          sx={{ gap: 1.2, fontSize: '0.85rem' }}
        >
          <EditRoundedIcon fontSize="small" sx={{ color: '#818cf8' }} />
          Edit
        </MenuItem>
        <MenuItem
          id="message-delete-menu-item"
          onClick={handleOpenDeleteConfirm}
          sx={{ gap: 1.2, fontSize: '0.85rem', color: '#f87171' }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmMessageId)}
        onClose={() => setDeleteConfirmMessageId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundColor: '#0f172a',
            backgroundImage: 'none',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#f8fafc', fontWeight: 700, pb: 1 }}>
          Delete this message?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            This message will be removed for everyone in the room. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button
            id="cancel-delete-message-btn"
            variant="outlined"
            size="small"
            onClick={() => setDeleteConfirmMessageId(null)}
            sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#cbd5e1' }}
          >
            Cancel
          </Button>
          <Button
            id="confirm-delete-message-btn"
            variant="contained"
            color="error"
            size="small"
            onClick={handleConfirmDelete}
            sx={{ fontWeight: 700, backgroundColor: '#ef4444', '&:hover': { backgroundColor: '#dc2626' } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Download Approval Dialog for Sender */}
      <DownloadApprovalDialog />

      {/* Action Notification Snackbar */}
      <Snackbar
        open={Boolean(actionSnackbar)}
        autoHideDuration={3000}
        onClose={() => setActionSnackbar(null)}
        message={actionSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
