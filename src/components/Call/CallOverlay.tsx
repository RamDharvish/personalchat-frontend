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

/**
 * Dedicated Audio Stream Player for WebRTC remote audio.
 * Plays each remote participant's audio cleanly through a single HTMLAudioElement
 * without duplicate Web Audio hardware output to prevent robotic echo / phasing.
 */
export const RemoteAudioPlayer: React.FC<{ stream: MediaStream | null; socketId?: string }> = ({
  stream,
  socketId,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!stream) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = false;
    audio.defaultMuted = false;
    audio.volume = 1.0;
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');

    if (audio.srcObject !== stream) {
      console.log(`[AUDIO] Attaching stream ${stream.id} to audio element for ${socketId || 'peer'}`);
      audio.srcObject = stream;
    }

    const tryPlayAudio = () => {
      if (audio) {
        audio.play().catch((err) => {
          console.warn(`[AUDIO] HTML audio autoplay for ${socketId || 'peer'} pending gesture:`, err);
        });
      }
    };

    tryPlayAudio();
    audio.onloadedmetadata = tryPlayAudio;
    audio.oncanplay = tryPlayAudio;

    const tracks = stream.getAudioTracks();
    tracks.forEach((t) => {
      t.addEventListener('unmute', tryPlayAudio);
    });

    const unlockAutoplay = () => {
      if (audio && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    window.addEventListener('click', unlockAutoplay);
    window.addEventListener('touchstart', unlockAutoplay);
    window.addEventListener('keydown', unlockAutoplay);
    window.addEventListener('pointerdown', unlockAutoplay);

    return () => {
      window.removeEventListener('click', unlockAutoplay);
      window.removeEventListener('touchstart', unlockAutoplay);
      window.removeEventListener('keydown', unlockAutoplay);
      window.removeEventListener('pointerdown', unlockAutoplay);
      tracks.forEach((t) => {
        t.removeEventListener('unmute', tryPlayAudio);
      });
    };
  }, [stream, socketId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

/**
 * Component rendering audio tags for all active remote streams.
 * Always renders audio players for all connected peers regardless of callType or minimization.
 */
export const RemoteAudioStreams: React.FC = () => {
  const remoteStreams = useChatStore((state) => state.remoteStreams);
  const streamEntries = Object.entries(remoteStreams);

  if (streamEntries.length === 0) return null;

  return (
    <>
      {streamEntries.map(([socketId, stream]) => (
        <RemoteAudioPlayer key={socketId} stream={stream} socketId={socketId} />
      ))}
    </>
  );
};

interface CallParticipantTileProps {
  stream: MediaStream | null;
  displayName: string;
  isSelf?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  callType: CallType | null;
  facingMode?: 'user' | 'environment';
}

/**
 * Flexible, responsive participant tile for both video and audio calls.
 * Safely plays video with muted={true} so autoplay is never blocked,
 * while audio playback is handled by RemoteAudioStreams.
 */
export const CallParticipantTile: React.FC<CallParticipantTileProps> = ({
  stream,
  displayName,
  isSelf = false,
  isMuted = false,
  isCameraOff = false,
  callType = 'video',
  facingMode = 'user',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasLiveVideoTrack, setHasLiveVideoTrack] = useState<boolean>(() => {
    if (!stream) return false;
    return stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
  });

  // Attach stream to video DOM element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;
    video.autoplay = true;
    video.muted = true; // Always muted: prevents feedback for self, prevents double audio for remote
    video.defaultMuted = true;

    if (stream) {
      if (video.srcObject !== stream) {
        console.log(`[VIDEO] CallParticipantTile attaching stream ${stream.id} for ${displayName}`);
        video.srcObject = stream;
      }
      video.play().catch((err) => {
        console.warn(`[VIDEO] Video playback note for ${displayName}:`, err);
      });
    } else {
      video.srcObject = null;
    }
  }, [stream, displayName]);

  // Monitor video track presence and status
  useEffect(() => {
    if (!stream) {
      setHasLiveVideoTrack(false);
      return;
    }

    const checkTrackState = () => {
      const vTracks = stream.getVideoTracks();
      const live = vTracks.some((t) => t.readyState === 'live' && t.enabled);
      setHasLiveVideoTrack(live);

      const video = videoRef.current;
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    };

    checkTrackState();

    const vTracks = stream.getVideoTracks();
    vTracks.forEach((t) => {
      t.addEventListener('unmute', checkTrackState);
      t.addEventListener('mute', checkTrackState);
      t.addEventListener('ended', checkTrackState);
    });

    return () => {
      vTracks.forEach((t) => {
        t.removeEventListener('unmute', checkTrackState);
        t.removeEventListener('mute', checkTrackState);
        t.removeEventListener('ended', checkTrackState);
      });
    };
  }, [stream, displayName]);

  const showVideo =
    callType === 'video' && !isCameraOff && Boolean(stream) && hasLiveVideoTrack;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        backgroundColor: '#0a0f1d',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isSelf && facingMode !== 'environment' ? 'scaleX(-1)' : 'none',
          opacity: showVideo ? 1 : 0,
          transition: 'opacity 0.25s ease-in-out',
          zIndex: 1,
        }}
      />

      {/* Fallback Display if video is off, audio call, or loading */}
      {!showVideo && (
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            p: 2,
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
                width: { xs: 80, sm: 110, md: 130 },
                height: { xs: 80, sm: 110, md: 130 },
                borderRadius: '50%',
                background: isMuted
                  ? 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
                animation: isMuted ? 'none' : 'pulseGlow 2.5s infinite ease-in-out',
                '@keyframes pulseGlow': {
                  '0%': { transform: 'scale(0.9)', opacity: 0.5 },
                  '50%': { transform: 'scale(1.25)', opacity: 1 },
                  '100%': { transform: 'scale(0.9)', opacity: 0.5 },
                },
              }}
            />
            <Avatar
              sx={{
                width: { xs: 56, sm: 76, md: 90 },
                height: { xs: 56, sm: 76, md: 90 },
                bgcolor: isSelf ? '#6366f1' : '#0891b2',
                color: '#ffffff',
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                fontWeight: 700,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                border: '3px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
          </Box>

          <Typography
            variant="subtitle1"
            fontWeight={700}
            noWrap
            sx={{
              color: '#f8fafc',
              fontSize: { xs: '0.85rem', sm: '1rem' },
              maxWidth: 180,
              textAlign: 'center',
            }}
          >
            {displayName} {isSelf ? '(You)' : ''}
          </Typography>

          {callType === 'video' && isCameraOff && (
            <Chip
              icon={<VideocamOffRoundedIcon sx={{ fontSize: 13 }} />}
              label="Camera off"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(8px)',
              }}
            />
          )}
        </Box>
      )}

      {/* Floating Bottom-Left Name & Mute Overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: { xs: 8, sm: 12 },
          left: { xs: 8, sm: 12 },
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 0.8,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          px: 1.2,
          py: 0.4,
          borderRadius: 2,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: '#ffffff', fontSize: '0.78rem' }}>
          {displayName} {isSelf ? '(You)' : ''}
        </Typography>

        {isMuted && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              backgroundColor: 'rgba(239, 68, 68, 0.25)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              px: 0.6,
              py: 0.1,
              borderRadius: 1,
            }}
          >
            <MicOffRoundedIcon sx={{ fontSize: 12 }} />
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
              Muted
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * Local Floating Picture-in-Picture Preview (used for 1-on-1 calls)
 */
const LocalPipPreview: React.FC<{
  stream: MediaStream | null;
  displayName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  callType: CallType | null;
  facingMode: 'user' | 'environment';
}> = ({ stream, displayName, isMuted, isCameraOff, callType, facingMode }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: { xs: 70, sm: 80 },
        right: { xs: 16, sm: 24 },
        width: { xs: 110, sm: 140, md: 160 },
        height: { xs: 150, sm: 190, md: 210 },
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
        zIndex: 20,
      }}
    >
      <CallParticipantTile
        stream={stream}
        displayName={displayName}
        isSelf
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        callType={callType}
        facingMode={facingMode}
      />
    </Box>
  );
};

/**
 * Floating Minimized Call Bar
 */
export const FloatingCallBar: React.FC = () => {
  const callStatus = useChatStore((state) => state.callStatus);
  const callType = useChatStore((state) => state.callType);
  const isCallMinimized = useChatStore((state) => state.isCallMinimized);
  const isMuted = useChatStore((state) => state.isMuted);
  const toggleMute = useChatStore((state) => state.toggleMute);
  const endCall = useChatStore((state) => state.endCall);
  const setCallMinimized = useChatStore((state) => state.setCallMinimized);
  const remoteStreams = useChatStore((state) => state.remoteStreams);

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

  const totalParticipants = 1 + Object.keys(remoteStreams).length;

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
          {callStatus === 'calling'
            ? 'Calling...'
            : `In Call (${totalParticipants}) • ${formatTimer(callDuration)}`}
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
 * Main Full-Screen Call Overlay
 * Handles 1-on-1 calls (with PIP preview) and multi-participant mesh calls (3 or 4 participants)
 * in a responsive, unified grid layout where every participant is visible and audible.
 */
export const CallOverlay: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const callStatus = useChatStore((state) => state.callStatus);
  const callType = useChatStore((state) => state.callType);
  const isCallMinimized = useChatStore((state) => state.isCallMinimized);
  const isMuted = useChatStore((state) => state.isMuted);
  const isCameraOff = useChatStore((state) => state.isCameraOff);
  const facingMode = useChatStore((state) => state.facingMode);
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

  const totalParticipants = 1 + remoteSocketIds.length;
  const isMultiParticipant = remoteSocketIds.length > 1;

  const handleSwitchCamera = async () => {
    if (switchingCamera) return;
    setSwitchingCamera(true);
    try {
      await switchCamera();
    } catch {
      // Handled
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
          background: 'linear-gradient(to bottom, rgba(7, 11, 20, 0.92) 0%, transparent 100%)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
              px: 1.5,
              py: 0.5,
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            <ShieldRoundedIcon sx={{ color: '#10b981', fontSize: 16 }} />
            <Typography variant="caption" fontWeight={700} sx={{ color: '#e2e8f0', letterSpacing: '0.04em' }}>
              P2P Call
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {callStatus === 'calling' ? (
              <span style={{ color: '#fbbf24' }}>
                {isMultiParticipant ? `Calling ${otherMembers.length} participants...` : `Calling ${primaryPeerName}...`}
              </span>
            ) : (
              <span style={{ color: '#4ade80' }}>
                Connected • {totalParticipants} in Call • {formatTimer(callDuration)}
              </span>
            )}
          </Typography>

          {/* Any muted peer badges */}
          {remoteSocketIds.map((id) => {
            const pState = peerMediaStates[id];
            if (!pState?.isMuted) return null;
            const m = members.find((mem) => mem.socketId === id);
            return (
              <Chip
                key={`muted-${id}`}
                icon={<MicOffRoundedIcon sx={{ fontSize: 13, color: '#f87171 !important' }} />}
                label={`${m?.displayName || 'Peer'} muted`}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  backdropFilter: 'blur(8px)',
                }}
              />
            );
          })}
        </Stack>

        <Tooltip title="Minimize to Chat">
          <IconButton
            id="call-minimize-btn"
            onClick={() => setCallMinimized(true)}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              flexShrink: 0,
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
            }}
          >
            <CloseFullscreenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Call Viewport */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          pt: { xs: 7, sm: 8 },
          pb: { xs: 11, sm: 12 },
          px: { xs: 1, sm: 2 },
          overflow: 'hidden',
        }}
      >
        {isMultiParticipant ? (
          /* Multi-Participant Grid (3 or 4 participants) */
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'grid',
              gap: { xs: 1, sm: 1.5 },
              gridTemplateColumns: totalParticipants <= 2 ? '1fr' : 'repeat(2, 1fr)',
              gridTemplateRows: totalParticipants <= 2 ? '1fr' : 'repeat(2, 1fr)',
              justifyContent: 'center',
              alignItems: 'center',
              maxHeight: '100%',
            }}
          >
            {/* Local Participant Tile */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                minHeight: 0,
                ...(totalParticipants === 3
                  ? {
                      gridColumn: { xs: 'span 2', sm: 'span 2', md: 'span 1' },
                    }
                  : {}),
              }}
            >
              <CallParticipantTile
                stream={localStream}
                displayName={displayName}
                isSelf
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                callType={callType}
                facingMode={facingMode}
              />
            </Box>

            {/* Remote Participants Tiles */}
            {remoteSocketIds.map((socketId) => {
              const stream = remoteStreams[socketId] || null;
              const member = members.find((m) => m.socketId === socketId);
              const peerName = member ? member.displayName : 'Remote Peer';
              const peerState = peerMediaStates[socketId] || { isMuted: false, isCameraOff: false };

              return (
                <Box key={socketId} sx={{ width: '100%', height: '100%', minHeight: 0 }}>
                  <CallParticipantTile
                    stream={stream}
                    displayName={peerName}
                    isMuted={peerState.isMuted}
                    isCameraOff={peerState.isCameraOff}
                    callType={callType}
                  />
                </Box>
              );
            })}
          </Box>
        ) : (
          /* 1-on-1 Call Layout (Local PIP + Primary Remote Full Screen) */
          <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
            <CallParticipantTile
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
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              callType={callType}
              facingMode={facingMode}
            />
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
          pb: { xs: 'max(16px, env(safe-area-inset-bottom))', sm: 2.5 },
          pt: 1.5,
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
