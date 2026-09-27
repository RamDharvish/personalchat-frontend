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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/useChatStore.js';
import { Header } from '../components/Layout/Header.js';
import { CallOverlay, FloatingCallBar, RemoteAudioStreams } from '../components/Call/CallOverlay.js';
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
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [actionSnackbar, setActionSnackbar] = useState<string | null>(null);

  // Mobile Top Menu State
  const [roomMenuAnchorEl, setRoomMenuAnchorEl] = useState<null | HTMLElement>(null);

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
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup microphone and leave room session on unmount
  useEffect(() => {
    return () => {
      voiceRecorder.cancelRecording();
      leaveRoom().catch(() => {});
    };
  }, [leaveRoom]);

  // Auto-redirect if not in an active room
  useEffect(() => {
    if (!selfSocketId || !roomCode) {
      if (routeRoomCode && routeRoomCode !== '----') {
        navigate(`/join?code=${routeRoomCode}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [selfSocketId, roomCode, routeRoomCode, navigate]);

  // Isolate auto-scroll strictly to the chat timeline container without moving page header
  const scrollToBottom = (smooth = true) => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
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
    setLeaveConfirmOpen(false);
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

  // Render members sidebar content for desktop
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
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#0b0f19',
      }}
    >
      {/* Desktop Header Only */}
      {!isMobile && <Header />}

      {/* Main Container */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          p: { xs: 0, md: 2 },
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
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
            borderRadius: { xs: 0, md: 3 },
            border: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.08)' },
            backgroundColor: '#0f172a',
          }}
        >
          {/* Connection Error Banner */}
          {connectionStatus === 'disconnected' && (
            <Alert
              severity="warning"
              icon={<WifiOffRoundedIcon />}
              sx={{ borderRadius: 0, py: 0.5, flexShrink: 0 }}
            >
              Connection lost. Attempting to reconnect...
            </Alert>
          )}

          {/* ======================================================
              TOP APP BAR: COMPACT MOBILE & FULL DESKTOP
             ====================================================== */}
          {isMobile ? (
            /* COMPACT MOBILE HEADER (WhatsApp-like) */
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                height: 56,
                minHeight: 56,
                maxHeight: 56,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0,
              }}
            >
              {/* Left: Avatar & Room Info */}
              <Box
                onClick={() => setRoomInfoOpen(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: isLocked ? '#f87171' : '#10b981',
                      boxShadow: '0 0 0 2px #0f172a',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 38,
                      height: 38,
                      bgcolor: '#6366f1',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  >
                    #
                  </Avatar>
                </Badge>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={800}
                    noWrap
                    sx={{
                      color: '#f8fafc',
                      fontSize: '0.95rem',
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Room #{activeCode}
                  </Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      color: typingNames.length > 0 ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.72rem',
                      display: 'block',
                      fontStyle: typingNames.length > 0 ? 'italic' : 'normal',
                    }}
                  >
                    {typingNames.length > 0
                      ? `${typingNames[0]} typing...`
                      : `${members.length} online • Tap for info`}
                  </Typography>
                </Box>
              </Box>

              {/* Right: Compact Action Buttons */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                {!isCallActive && (
                  <>
                    <Tooltip title="Voice Call">
                      <IconButton
                        id="mobile-voice-call-btn"
                        size="medium"
                        onClick={() => handleStartCall('voice')}
                        sx={{
                          color: '#a5b4fc',
                          p: 1,
                          '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.15)' },
                        }}
                      >
                        <CallRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Video Call">
                      <IconButton
                        id="mobile-video-call-btn"
                        size="medium"
                        onClick={() => handleStartCall('video')}
                        sx={{
                          color: '#22d3ee',
                          p: 1,
                          '&:hover': { backgroundColor: 'rgba(6, 182, 212, 0.15)' },
                        }}
                      >
                        <VideocamRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}

                <IconButton
                  id="mobile-room-menu-btn"
                  size="medium"
                  onClick={(e) => setRoomMenuAnchorEl(e.currentTarget)}
                  sx={{ color: '#cbd5e1', p: 1 }}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ) : (
            /* DESKTOP ROOM TOP BAR */
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                flexShrink: 0,
                gap: 1.5,
              }}
            >
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

                {members.length > 1 && (
                  <Tooltip title="P2P DataChannel mesh is active for peer-to-peer file transfer">
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
                        fontWeight: 600,
                      }}
                    />
                  </Tooltip>
                )}
              </Stack>

              {/* Desktop Actions */}
              <Stack direction="row" spacing={1} alignItems="center">
                {!isCallActive && (
                  <>
                    <Tooltip title="Start Voice Call">
                      <Button
                        id="voice-call-start-btn"
                        variant="outlined"
                        size="small"
                        startIcon={<CallRoundedIcon />}
                        onClick={() => handleStartCall('voice')}
                        sx={{
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          color: '#a5b4fc',
                          backgroundColor: 'rgba(99, 102, 241, 0.08)',
                          '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
                        }}
                      >
                        Voice Call
                      </Button>
                    </Tooltip>

                    <Tooltip title="Start Video Call">
                      <Button
                        id="video-call-start-btn"
                        variant="outlined"
                        size="small"
                        startIcon={<VideocamRoundedIcon />}
                        onClick={() => handleStartCall('video')}
                        sx={{
                          borderColor: 'rgba(6, 182, 212, 0.4)',
                          color: '#22d3ee',
                          backgroundColor: 'rgba(6, 182, 212, 0.08)',
                          '&:hover': { backgroundColor: 'rgba(6, 182, 212, 0.2)' },
                        }}
                      >
                        Video Call
                      </Button>
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
                  onClick={() => setLeaveConfirmOpen(true)}
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
          )}

          {/* Floating Minimized Call Bar (when in call and minimized) */}
          <FloatingCallBar />

          {/* ======================================================
              MAIN BODY: SIDEBAR + CHAT WORKSPACE
             ====================================================== */}
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {/* Desktop Members Sidebar */}
            {!isMobile && (
              <Box
                sx={{
                  width: { md: 250, lg: 270 },
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {membersContent}
              </Box>
            )}

            {/* Chat Messages Timeline & Composer */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: '#0a0f1d',
              }}
            >
              {/* Message Timeline List */}
              <Box
                ref={chatScrollContainerRef}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  p: { xs: 1.5, sm: 2 },
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
                        maxWidth: 380,
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
                        Send messages, start audio/video calls, or share files. All content is ephemeral and direct P2P.
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  messages.map((msg) => {
                    if (msg.type === 'system') {
                      return (
                        <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'center', my: 0.8 }}>
                          <Chip
                            label={msg.text}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: '#94a3b8',
                              fontSize: '0.72rem',
                              height: 'auto',
                              py: 0.4,
                              px: 1.2,
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              borderRadius: 3,
                              '& .MuiChip-label': { whiteSpace: 'normal', textAlign: 'center' },
                            }}
                          />
                        </Box>
                      );
                    }

                    const isSelf = msg.senderId === selfSocketId;
                    const fileItem = msg.fileTransferId ? fileTransfers[msg.fileTransferId] : undefined;

                    if (fileItem) {
                      return (
                        <Box
                          key={msg.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isSelf ? 'flex-end' : 'flex-start',
                            maxWidth: '100%',
                            mb: 0.5,
                          }}
                        >
                          {!isSelf && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#38bdf8',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                mb: 0.3,
                                px: 1,
                              }}
                            >
                              {msg.senderName}
                            </Typography>
                          )}
                          <FileCard item={fileItem} />
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#94a3b8',
                              fontSize: '0.68rem',
                              fontFamily: '"JetBrains Mono", monospace',
                              mt: 0.3,
                              px: 1,
                            }}
                          >
                            {formatTimestamp(msg.timestamp)}
                          </Typography>
                        </Box>
                      );
                    }

                    const isEditing = editingMessageId === msg.id;

                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isSelf ? 'flex-end' : 'flex-start',
                          position: 'relative',
                          maxWidth: '100%',
                          mb: 0.5,
                        }}
                      >
                        {!isSelf && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#38bdf8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              mb: 0.3,
                              px: 1,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {msg.senderName}
                          </Typography>
                        )}

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
                              borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
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
                              maxWidth: { xs: '90%', sm: '75%', md: '65%' },
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
                                p: '10px 14px 6px 14px',
                                borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: isSelf
                                  ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
                                  : 'rgba(30, 41, 59, 0.85)',
                                backdropFilter: !isSelf ? 'blur(10px)' : undefined,
                                border: isSelf
                                  ? '1px solid rgba(255, 255, 255, 0.15)'
                                  : '1px solid rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                boxShadow: isSelf
                                  ? '0 3px 12px rgba(79, 70, 229, 0.32)'
                                  : '0 3px 12px rgba(0, 0, 0, 0.25)',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                position: 'relative',
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  lineHeight: 1.5,
                                  fontSize: '0.92rem',
                                  color: '#f8fafc',
                                  letterSpacing: '0.01em',
                                }}
                              >
                                {msg.text}
                              </Typography>

                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: 0.5,
                                  mt: 0.3,
                                  userSelect: 'none',
                                }}
                              >
                                {msg.isEdited && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isSelf ? 'rgba(255, 255, 255, 0.65)' : '#94a3b8',
                                      fontSize: '0.65rem',
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    edited
                                  </Typography>
                                )}
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isSelf ? 'rgba(255, 255, 255, 0.7)' : '#94a3b8',
                                    fontSize: '0.68rem',
                                    fontFamily: '"JetBrains Mono", monospace',
                                  }}
                                >
                                  {formatTimestamp(msg.timestamp)}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {typingNames.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#38bdf8',
                        fontStyle: 'italic',
                        fontSize: '0.75rem',
                      }}
                    >
                      {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing...
                    </Typography>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              {/* Hidden File Picker */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {/* ======================================================
                  MESSAGE COMPOSER (WhatsApp-like & Responsive)
                 ====================================================== */}
              {isRecordingVoice ? (
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25 },
                    pb: { xs: 'max(8px, env(safe-area-inset-bottom))', sm: 1.25 },
                    borderTop: '1px solid rgba(239, 68, 68, 0.25)',
                    backgroundColor: 'rgba(15, 23, 42, 0.98)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexShrink: 0,
                    zIndex: 10,
                  }}
                >
                  {/* Left: Recording Dot + Timer Pill */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 0 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 10px #ef4444',
                        animation: 'pulse 1.2s infinite',
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{
                        color: '#ef4444',
                        fontSize: { xs: '0.78rem', sm: '0.85rem' },
                        display: { xs: 'none', sm: 'inline' },
                        flexShrink: 0,
                      }}
                    >
                      Recording
                    </Typography>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        px: 1,
                        py: 0.3,
                        borderRadius: 2,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#fca5a5',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {formatRecordingTime(recordingDuration)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Center Waveform Animation */}
                  <Box
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      gap: 0.4,
                      flex: 1,
                      justifyContent: 'center',
                      px: 1,
                      maxWidth: 120,
                    }}
                  >
                    {[12, 20, 8, 24, 16, 10, 18, 14].map((h, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 3,
                          height: `${h}px`,
                          backgroundColor: '#ef4444',
                          borderRadius: 1,
                          opacity: 0.7,
                          animation: `pulse ${0.6 + (i % 4) * 0.2}s infinite alternate ease-in-out`,
                        }}
                      />
                    ))}
                  </Box>

                  {/* Right: Cancel & Send Action Buttons */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Tooltip title="Cancel recording">
                      <IconButton
                        id="cancel-voice-record-btn"
                        size="small"
                        onClick={handleCancelRecordingVoice}
                        sx={{
                          color: '#94a3b8',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          p: 0.8,
                          '&:hover': {
                            color: '#f87171',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          },
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Send Voice Message">
                      <Button
                        id="stop-and-send-voice-btn"
                        variant="contained"
                        size="small"
                        endIcon={<SendRoundedIcon sx={{ fontSize: '0.95rem !important' }} />}
                        onClick={handleStopAndSendVoice}
                        sx={{
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          borderRadius: 2.5,
                          px: 1.5,
                          py: 0.6,
                          minWidth: 'auto',
                          boxShadow: '0 2px 10px rgba(239, 68, 68, 0.35)',
                          '&:hover': { backgroundColor: '#dc2626' },
                        }}
                      >
                        Send
                      </Button>
                    </Tooltip>
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
                    p: { xs: 1, sm: 1.5 },
                    pb: { xs: 'max(10px, env(safe-area-inset-bottom))', sm: 1.5 },
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(15, 23, 42, 0.98)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexShrink: 0,
                    zIndex: 10,
                  }}
                >
                  {/* Attachment Button */}
                  <Tooltip title="Attach File (Max 100 MB)">
                    <IconButton
                      id="attachment-btn"
                      onClick={handleFileButtonClick}
                      sx={{
                        color: '#94a3b8',
                        p: { xs: 0.8, sm: 1 },
                        '&:hover': { color: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.12)' },
                      }}
                    >
                      <AttachFileRoundedIcon />
                    </IconButton>
                  </Tooltip>

                  {/* Rounded Message Input Field */}
                  <TextField
                    id="chat-message-input"
                    fullWidth
                    multiline
                    maxRows={4}
                    size="small"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        fontSize: '0.92rem',
                        py: 0.8,
                        px: 1.5,
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        },
                      },
                    }}
                  />

                  {/* Dynamic Action Button: Send or Voice Recording */}
                  {messageInput.trim() ? (
                    <Tooltip title="Send Message">
                      <IconButton
                        id="send-message-btn"
                        type="submit"
                        color="primary"
                        sx={{
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          p: { xs: 1, sm: 1.2 },
                          transition: 'all 0.2s',
                          '&:hover': { backgroundColor: '#4338ca', transform: 'scale(1.05)' },
                        }}
                      >
                        <SendRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Hold or Tap to Record Voice Note">
                      <IconButton
                        id="voice-note-record-btn"
                        onClick={handleStartRecordingVoice}
                        sx={{
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          color: '#f87171',
                          p: { xs: 1, sm: 1.2 },
                          transition: 'all 0.2s',
                          '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.25)', transform: 'scale(1.05)' },
                        }}
                      >
                        <MicRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Persistent Audio Stream Renderer for all active remote WebRTC audio */}
      <RemoteAudioStreams />

      {/* ======================================================
          STANDALONE IN-ROOM CALL OVERLAY (AUDIO & VIDEO)
         ====================================================== */}
      <CallOverlay />

      {/* Incoming Call Notification Dialog */}
      <IncomingCallDialog />

      {/* Mobile Room Menu */}
      <Menu
        anchorEl={roomMenuAnchorEl}
        open={Boolean(roomMenuAnchorEl)}
        onClose={() => setRoomMenuAnchorEl(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            minWidth: 170,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <MenuItem
          id="menu-room-info-item"
          onClick={() => {
            setRoomMenuAnchorEl(null);
            setRoomInfoOpen(true);
          }}
          sx={{ gap: 1.2, fontSize: '0.85rem' }}
        >
          <InfoOutlinedIcon fontSize="small" sx={{ color: '#818cf8' }} />
          Room Info & Members
        </MenuItem>

        <MenuItem
          id="menu-copy-code-item"
          onClick={() => {
            setRoomMenuAnchorEl(null);
            handleCopyCode();
            setActionSnackbar(`Copied Room Code #${activeCode}`);
          }}
          sx={{ gap: 1.2, fontSize: '0.85rem' }}
        >
          <ContentCopyRoundedIcon fontSize="small" sx={{ color: '#34d399' }} />
          Copy Room Code
        </MenuItem>

        {isHost && (
          <MenuItem
            id="menu-toggle-lock-item"
            onClick={() => {
              setRoomMenuAnchorEl(null);
              handleToggleLock();
            }}
            sx={{ gap: 1.2, fontSize: '0.85rem' }}
          >
            {isLocked ? (
              <LockOpenRoundedIcon fontSize="small" sx={{ color: '#34d399' }} />
            ) : (
              <LockOutlinedIcon fontSize="small" sx={{ color: '#f87171' }} />
            )}
            {isLocked ? 'Unlock Room' : 'Lock Room'}
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        <MenuItem
          id="menu-leave-room-item"
          onClick={() => {
            setRoomMenuAnchorEl(null);
            setLeaveConfirmOpen(true);
          }}
          sx={{ gap: 1.2, fontSize: '0.85rem', color: '#f87171' }}
        >
          <ExitToAppRoundedIcon fontSize="small" />
          Leave Room
        </MenuItem>
      </Menu>

      {/* Secondary Room Information Bottom Sheet / Dialog */}
      <Dialog
        open={roomInfoOpen}
        onClose={() => setRoomInfoOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            backgroundColor: '#0f172a',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#f8fafc' }}>
            Room Details
          </Typography>
          <IconButton size="small" onClick={() => setRoomInfoOpen(false)} sx={{ color: '#94a3b8' }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, pt: 1 }}>
          {/* Room Code Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 600 }}>
                ROOM CODE
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.15em',
                }}
              >
                #{activeCode}
              </Typography>
            </Box>
            <Button
              id="dialog-copy-code-btn"
              variant="contained"
              size="small"
              startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
              onClick={handleCopyCode}
              sx={{
                backgroundColor: copied ? '#10b981' : '#6366f1',
                borderRadius: 2,
                fontWeight: 700,
                fontSize: '0.75rem',
                '&:hover': { backgroundColor: copied ? '#059669' : '#4f46e5' },
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Box>

          {/* Members List */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#cbd5e1', mb: 1 }}>
            Members ({members.length} / {roomCapacity})
          </Typography>
          <List sx={{ p: 0, mb: 2, maxHeight: 220, overflowY: 'auto' }}>
            {members.map((m) => {
              const isSelf = m.socketId === selfSocketId;
              return (
                <ListItem
                  key={m.socketId}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: isSelf ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isSelf ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                    mb: 1,
                    py: 0.8,
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: isSelf ? '#6366f1' : '#0891b2',
                        width: 32,
                        height: 32,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                      }}
                    >
                      {m.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#ffffff' }}>
                        {m.displayName} {isSelf && '(You)'}
                      </Typography>
                    }
                    secondary={
                      <Chip
                        label={m.isHost ? 'Host' : 'Member'}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          backgroundColor: m.isHost ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                          color: m.isHost ? '#a5b4fc' : '#94a3b8',
                          mt: 0.2,
                        }}
                      />
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {/* Privacy Note */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <ShieldRoundedIcon sx={{ color: '#34d399', fontSize: 18, mt: 0.2 }} />
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#34d399', display: 'block' }}>
                End-to-End P2P Privacy
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                All audio, video, messages, and files are temporary and stream directly between connected peers.
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
          <Button
            id="dialog-leave-room-btn"
            variant="text"
            color="error"
            startIcon={<ExitToAppRoundedIcon />}
            onClick={() => {
              setRoomInfoOpen(false);
              setLeaveConfirmOpen(true);
            }}
            sx={{ fontSize: '0.8rem' }}
          >
            Leave Room
          </Button>

          <Button
            variant="outlined"
            onClick={() => setRoomInfoOpen(false)}
            sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#cbd5e1', fontSize: '0.8rem' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leave Room Confirmation Dialog */}
      <Dialog
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
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
          Leave Room #{activeCode}?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Are you sure you want to leave? All ephemeral session data and active calls will end.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button
            id="cancel-leave-btn"
            variant="outlined"
            size="small"
            onClick={() => setLeaveConfirmOpen(false)}
            sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#cbd5e1' }}
          >
            Stay in Room
          </Button>
          <Button
            id="confirm-leave-btn"
            variant="contained"
            color="error"
            size="small"
            onClick={handleLeaveRoom}
            sx={{ fontWeight: 700, backgroundColor: '#ef4444', '&:hover': { backgroundColor: '#dc2626' } }}
          >
            Leave Room
          </Button>
        </DialogActions>
      </Dialog>

      {/* Message Action Menu (Edit / Delete) */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e293b',
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
