import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Dialog,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import FlipCameraIosRoundedIcon from '@mui/icons-material/FlipCameraIosRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import { useChatStore } from '../../store/useChatStore.js';
import type { CallType } from '../../types/index.js';

interface RemoteVideoViewProps {
  stream: MediaStream | null;
  displayName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  callType: CallType | null;
}

const RemoteVideoView: React.FC<RemoteVideoViewProps> = ({
  stream,
  displayName,
  isMuted,
  isCameraOff,
  callType,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasLiveVideoTrack, setHasLiveVideoTrack] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;
    video.autoplay = true;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) {
      setHasLiveVideoTrack(false);
      return;
    }

    const updateTrackState = () => {
      const vTracks = stream.getVideoTracks();
      const live = vTracks.some((t) => t.readyState === 'live' && t.enabled);
      setHasLiveVideoTrack(live);
    };

    updateTrackState();
    stream.addEventListener('addtrack', updateTrackState);
    stream.addEventListener('removetrack', updateTrackState);

    return () => {
      stream.removeEventListener('addtrack', updateTrackState);
      stream.removeEventListener('removetrack', updateTrackState);
    };
  }, [stream]);

  const shouldRenderVideo =
    callType === 'video' && !isCameraOff && Boolean(stream) && hasLiveVideoTrack;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0f1d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Remote Video Stream Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: shouldRenderVideo ? 'block' : 'none',
        }}
      />

      {/* Fallback Display if video is off or audio call */}
      {!shouldRenderVideo && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
                animation: 'pulseGlow 2.5s infinite ease-in-out',
                '@keyframes pulseGlow': {
                  '0%': { transform: 'scale(0.9)', opacity: 0.5 },
                  '50%': { transform: 'scale(1.25)', opacity: 1 },
                  '100%': { transform: 'scale(0.9)', opacity: 0.5 },
                },
              }}
            />
            <Avatar
              sx={{
                width: { xs: 90, sm: 110 },
                height: { xs: 90, sm: 110 },
                bgcolor: '#4f46e5',
                color: '#ffffff',
                fontSize: { xs: '2.5rem', sm: '3rem' },
                fontWeight: 700,
                boxShadow: '0 8px 32px rgba(79, 70, 229, 0.45)',
                border: '3px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
          </Box>

          <Typography variant="h6" fontWeight={700} sx={{ color: '#f8fafc', mt: 1 }}>
            {displayName}
          </Typography>

          {callType === 'video' && isCameraOff && (
            <Chip
              icon={<VideocamOffRoundedIcon sx={{ fontSize: 14 }} />}
              label="Camera is off"
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(8px)',
              }}
            />
          )}
        </Box>
      )}

      {/* Mute badge for remote peer */}
      {isMuted && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            px: 1.2,
            py: 0.5,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <MicOffRoundedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" fontWeight={600}>
            {displayName} is muted
          </Typography>
        </Box>
      )}
    </Box>
  );
};

interface LocalPipPreviewProps {
  stream: MediaStream | null;
  displayName: string;
  isCameraOff: boolean;
  callType: CallType | null;
}

const LocalPipPreview: React.FC<LocalPipPreviewProps> = ({
  stream,
  displayName,
  isCameraOff,
  callType,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const showVideo = callType === 'video' && !isCameraOff && Boolean(stream);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: { xs: 70, sm: 80 },
        right: { xs: 16, sm: 24 },
        width: { xs: 100, sm: 130, md: 150 },
        height: { xs: 140, sm: 180, md: 200 },
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: '#111726',
        border: '2px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // Mirrored selfie preview
          display: showVideo ? 'block' : 'none',
        }}
      />

      {!showVideo && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#6366f1',
              fontWeight: 700,
              fontSize: '1.2rem',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>
            You (Camera off)
          </Typography>
        </Box>
      )}

      {/* "You" Pill Indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          px: 0.8,
          py: 0.2,
          borderRadius: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: '#ffffff', fontSize: '0.65rem', fontWeight: 600 }}>
          You
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * Minimized Call Bar displayed at the top of the chat timeline
 */
export const FloatingCallBar: React.FC = () => {
  const callStatus = useChatStore((state) => state.callStatus);
  const callType = useChatStore((state) => state.callType);
  const isCallMinimized = useChatStore((state) => state.isCallMinimized);
  const isMuted = useChatStore((state) => state.isMuted);
  const toggleMute = useChatStore((state) => state.toggleMute);
  const endCall = useChatStore((state) => state.endCall);
  const setCallMinimized = useChatStore((state) => state.setCallMinimized);

  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (callStatus !== 'connected') {
      setCallDuration(0);
      return;
    }
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  if (!isCallMinimized || (callStatus !== 'calling' && callStatus !== 'connected')) {
    return null;
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Box
      sx={{
        mx: { xs: 1, sm: 2 },
        my: 1,
        p: 1,
        px: 2,
        borderRadius: 3,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
        backdropFilter: 'blur(12px)',
        animation: 'slideDown 0.3s ease-out',
        '@keyframes slideDown': {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        onClick={() => setCallMinimized(false)}
        sx={{ cursor: 'pointer', flex: 1 }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse 1.5s infinite',
          }}
        />
        {callType === 'video' ? (
          <VideocamRoundedIcon sx={{ color: '#22d3ee', fontSize: 18 }} />
        ) : (
          <CallRoundedIcon sx={{ color: '#a5b4fc', fontSize: 18 }} />
        )}
        <Typography variant="body2" fontWeight={700} sx={{ color: '#f8fafc' }}>
          {callStatus === 'calling' ? 'Calling...' : `In Call • ${formatTimer(callDuration)}`}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
          <IconButton
            id="minimized-call-mute-btn"
            size="small"
            onClick={toggleMute}
            sx={{
              backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: isMuted ? '#f87171' : '#ffffff',
            }}
          >
            {isMuted ? <MicOffRoundedIcon fontSize="small" /> : <MicRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Expand Call">
          <IconButton
            id="minimized-call-expand-btn"
            size="small"
            onClick={() => setCallMinimized(false)}
            sx={{
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
            }}
          >
            <OpenInFullRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="End Call">
          <IconButton
            id="minimized-call-end-btn"
            size="small"
            onClick={endCall}
            sx={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            <CallEndRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

/**
 * Main In-Room Call Overlay (Audio & Video)
 */
export const CallOverlay: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const callStatus = useChatStore((state) => state.callStatus);
  const callType = useChatStore((state) => state.callType);
  const isCallMinimized = useChatStore((state) => state.isCallMinimized);
  const isMuted = useChatStore((state) => state.isMuted);
  const isCameraOff = useChatStore((state) => state.isCameraOff);
  const localStream = useChatStore((state) => state.localStream);
  const remoteStreams = useChatStore((state) => state.remoteStreams);
  const peerMediaStates = useChatStore((state) => state.peerMediaStates);
  const members = useChatStore((state) => state.members);
  const displayName = useChatStore((state) => state.displayName);
  const selfSocketId = useChatStore((state) => state.selfSocketId);

  const toggleMute = useChatStore((state) => state.toggleMute);
  const toggleCamera = useChatStore((state) => state.toggleCamera);
  const switchCamera = useChatStore((state) => state.switchCamera);
  const endCall = useChatStore((state) => state.endCall);
  const setCallMinimized = useChatStore((state) => state.setCallMinimized);

  const [callDuration, setCallDuration] = useState(0);
  const [switchingCamera, setSwitchingCamera] = useState(false);

  // Live duration timer
  useEffect(() => {
    if (callStatus !== 'connected') {
      setCallDuration(0);
      return;
    }
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const isCallActive = callStatus === 'calling' || callStatus === 'connected';

  if (!isCallActive || isCallMinimized) {
    return null;
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remoteSocketIds = Object.keys(remoteStreams);
  const otherMembers = members.filter((m) => m.socketId !== selfSocketId);
  const primaryRemoteSocketId = remoteSocketIds[0] || otherMembers[0]?.socketId;
  const primaryMember = members.find((m) => m.socketId === primaryRemoteSocketId);
  const primaryPeerName = primaryMember?.displayName || 'Peer';
  const primaryRemoteStream = primaryRemoteSocketId ? (remoteStreams[primaryRemoteSocketId] || null) : null;
  const primaryPeerMediaState = primaryRemoteSocketId
    ? peerMediaStates[primaryRemoteSocketId] || { isMuted: false, isCameraOff: false }
    : { isMuted: false, isCameraOff: false };

  const handleSwitchCamera = async () => {
    if (switchingCamera) return;
    setSwitchingCamera(true);
    try {
      await switchCamera();
    } catch {
      // Ignored / fallback notification
    } finally {
      setSwitchingCamera(false);
    }
  };

  return (
    <Dialog
      fullScreen
      open={isCallActive}
      PaperProps={{
        sx: {
          backgroundColor: '#070b14',
          backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(30, 41, 59, 0.6) 0%, #070b14 80%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Top Header Bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          p: { xs: 1.5, sm: 2 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
          background: 'linear-gradient(to bottom, rgba(7, 11, 20, 0.9) 0%, transparent 100%)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
              px: 1.5,
              py: 0.5,
              borderRadius: 3,
            }}
          >
            <ShieldRoundedIcon sx={{ color: '#10b981', fontSize: 16 }} />
            <Typography variant="caption" fontWeight={700} sx={{ color: '#e2e8f0', letterSpacing: '0.04em' }}>
              P2P Call
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
            {callStatus === 'calling' ? (
              <span style={{ color: '#fbbf24' }}>Calling {primaryPeerName}...</span>
            ) : (
              <span style={{ color: '#4ade80' }}>Connected • {formatTimer(callDuration)}</span>
            )}
          </Typography>
        </Stack>

        <Tooltip title="Minimize to Chat">
          <IconButton
            id="call-minimize-btn"
            onClick={() => setCallMinimized(true)}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
            }}
          >
            <CloseFullscreenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Call Body */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        {callType === 'video' ? (
          <>
            {/* Primary Remote Video View */}
            <RemoteVideoView
              stream={primaryRemoteStream}
              displayName={primaryPeerName}
              isMuted={primaryPeerMediaState.isMuted}
              isCameraOff={primaryPeerMediaState.isCameraOff}
              callType={callType}
            />

            {/* Local Picture-in-Picture Floating Preview */}
            <LocalPipPreview
              stream={localStream}
              displayName={displayName}
              isCameraOff={isCameraOff}
              callType={callType}
            />
          </>
        ) : (
          /* Audio Call Dedicated Central UI */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              p: 3,
            }}
          >
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box
                sx={{
                  position: 'absolute',
                  width: { xs: 180, sm: 240 },
                  height: { xs: 180, sm: 240 },
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
                  animation: 'pulseGlow 2.5s infinite ease-in-out',
                }}
              />
              <Avatar
                sx={{
                  width: { xs: 110, sm: 140 },
                  height: { xs: 110, sm: 140 },
                  bgcolor: '#6366f1',
                  color: '#ffffff',
                  fontSize: { xs: '3rem', sm: '4rem' },
                  fontWeight: 700,
                  boxShadow: '0 12px 40px rgba(99, 102, 241, 0.5)',
                  border: '4px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {primaryPeerName.charAt(0).toUpperCase()}
              </Avatar>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#ffffff', mb: 0.5 }}>
                {primaryPeerName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', letterSpacing: '0.02em' }}>
                {callStatus === 'calling'
                  ? 'Calling peer...'
                  : `Voice Call Active • ${formatTimer(callDuration)}`}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Floating Call Control Bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          pb: { xs: 'max(20px, env(safe-area-inset-bottom))', sm: 3 },
          pt: 2,
          px: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 30,
          background: 'linear-gradient(to top, rgba(7, 11, 20, 0.95) 0%, transparent 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 2, sm: 3 },
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            p: { xs: 1.2, sm: 1.5 },
            px: { xs: 2.5, sm: 3.5 },
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Mute Microphone Button */}
          <Tooltip title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}>
            <IconButton
              id="call-overlay-mute-btn"
              onClick={toggleMute}
              sx={{
                width: { xs: 50, sm: 54 },
                height: { xs: 50, sm: 54 },
                backgroundColor: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: isMuted ? '#dc2626' : 'rgba(255, 255, 255, 0.16)',
                  transform: 'scale(1.06)',
                },
              }}
            >
              {isMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
            </IconButton>
          </Tooltip>

          {/* Camera Toggle Button (For Video Calls) */}
          {callType === 'video' && (
            <Tooltip title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
              <IconButton
                id="call-overlay-camera-btn"
                onClick={toggleCamera}
                sx={{
                  width: { xs: 50, sm: 54 },
                  height: { xs: 50, sm: 54 },
                  backgroundColor: isCameraOff ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: isCameraOff ? '#dc2626' : 'rgba(255, 255, 255, 0.16)',
                    transform: 'scale(1.06)',
                  },
                }}
              >
                {isCameraOff ? <VideocamOffRoundedIcon /> : <VideocamRoundedIcon />}
              </IconButton>
            </Tooltip>
          )}

          {/* Flip / Switch Camera Button (For Video Calls on Mobile) */}
          {callType === 'video' && isMobile && (
            <Tooltip title="Switch Camera (Front/Back)">
              <IconButton
                id="call-overlay-switch-camera-btn"
                onClick={handleSwitchCamera}
                disabled={switchingCamera}
                sx={{
                  width: { xs: 50, sm: 54 },
                  height: { xs: 50, sm: 54 },
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    transform: 'scale(1.06)',
                  },
                }}
              >
                <FlipCameraIosRoundedIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* End Call Button */}
          <Tooltip title="End Call">
            <IconButton
              id="call-overlay-end-btn"
              onClick={endCall}
              sx={{
                width: { xs: 54, sm: 60 },
                height: { xs: 54, sm: 60 },
                backgroundColor: '#ef4444',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#dc2626',
                  transform: 'scale(1.08)',
                },
              }}
            >
              <CallEndRoundedIcon sx={{ fontSize: { xs: 26, sm: 28 } }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Dialog>
  );
};
