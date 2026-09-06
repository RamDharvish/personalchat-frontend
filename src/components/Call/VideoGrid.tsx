import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Avatar, Grid, Chip } from '@mui/material';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import { useChatStore } from '../../store/useChatStore.js';
import type { CallType } from '../../types/index.js';

interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isSelf?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  callType?: CallType | null;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  displayName,
  isSelf = false,
  isMuted = false,
  isCameraOff = false,
  callType = 'video',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoTrackCount, setVideoTrackCount] = useState<number>(() => stream?.getVideoTracks().length || 0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Synchronize stream attachment and playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Direct DOM property configuration for reliable autoplay
    video.muted = isSelf;
    video.defaultMuted = isSelf;
    video.playsInline = true;
    video.autoplay = true;

    if (stream) {
      if (video.srcObject !== stream) {
        console.log(
          `[VIDEO] Assigning stream to <video> for ${displayName} (streamId: ${stream.id}, tracks: ${stream.getTracks().length})`
        );
        video.srcObject = stream;
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[VIDEO] Playback active for ${displayName} (${video.videoWidth}x${video.videoHeight})`);
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setDimensions({ width: video.videoWidth, height: video.videoHeight });
            }
          })
          .catch((err) => {
            console.warn(`[VIDEO] Autoplay failed for ${displayName}:`, err);
          });
      }
    } else {
      video.srcObject = null;
      setDimensions({ width: 0, height: 0 });
    }
  }, [stream, isSelf, displayName]);

  // Synchronize track events and state updates
  useEffect(() => {
    if (!stream) {
      setVideoTrackCount(0);
      return;
    }

    const checkTracks = () => {
      const vTracks = stream.getVideoTracks();
      const liveTracks = vTracks.filter((t) => t.readyState === 'live');
      console.log(
        `[VIDEO] VideoTile (${displayName}) videoTracks=${vTracks.length}, liveTracks=${liveTracks.length}`
      );
      setVideoTrackCount(vTracks.length);

      const video = videoRef.current;
      if (video && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    };

    checkTracks();
    stream.addEventListener('addtrack', checkTracks);
    stream.addEventListener('removetrack', checkTracks);

    const vTracks = stream.getVideoTracks();
    vTracks.forEach((track) => {
      track.addEventListener('unmute', checkTracks);
      track.addEventListener('mute', checkTracks);
      track.addEventListener('ended', checkTracks);
    });

    return () => {
      stream.removeEventListener('addtrack', checkTracks);
      stream.removeEventListener('removetrack', checkTracks);
      vTracks.forEach((track) => {
        track.removeEventListener('unmute', checkTracks);
        track.removeEventListener('mute', checkTracks);
        track.removeEventListener('ended', checkTracks);
      });
    };
  }, [stream, displayName]);

  const showVideo = callType === 'video' && !isCameraOff && Boolean(stream) && videoTrackCount > 0;

  const handleMetadataLoaded = () => {
    const video = videoRef.current;
    if (video) {
      console.log(`[VIDEO] onLoadedMetadata for ${displayName}: ${video.videoWidth}x${video.videoHeight}`);
      if (isSelf) {
        video.muted = true;
      }
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setDimensions({ width: video.videoWidth, height: video.videoHeight });
      }
      video.play().catch(() => {});
    }
  };

  const handleCanPlay = () => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setDimensions({ width: video.videoWidth, height: video.videoHeight });
      }
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: { xs: 100, sm: 120, md: 140 },
        maxHeight: { xs: 160, sm: 190, md: 220 },
        aspectRatio: '16/9',
        borderRadius: 2.5,
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Video Stream Element (Positioned Absolute to guarantee full layout fill) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        onLoadedMetadata={handleMetadataLoaded}
        onCanPlay={handleCanPlay}
        onPlaying={() => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            setDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: showVideo ? 1 : 0,
          pointerEvents: showVideo ? 'auto' : 'none',
          transition: 'opacity 0.25s ease-in-out',
          transform: isSelf ? 'scaleX(-1)' : 'none',
          zIndex: 1,
        }}
      />

      {/* Camera Off / Voice Call Avatar Fallback */}
      {!showVideo && (
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Avatar
            sx={{
              width: { xs: 48, sm: 60 },
              height: { xs: 48, sm: 60 },
              bgcolor: isSelf ? '#6366f1' : '#0891b2',
              fontSize: { xs: '1.3rem', sm: '1.7rem' },
              fontWeight: 700,
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.35)',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          {isCameraOff && callType === 'video' && (
            <Chip
              icon={<VideocamOffRoundedIcon sx={{ fontSize: 13 }} />}
              label="Camera off"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: 'text.secondary',
              }}
            />
          )}
        </Box>
      )}

      {/* Overlay Details: Name, Diagnostics & Mute Badge */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: 1.2,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
          }}
        >
          <Typography variant="caption" fontWeight={600} color="#ffffff" sx={{ fontSize: '0.75rem' }}>
            {displayName} {isSelf ? '(You)' : ''}
          </Typography>
          {showVideo && dimensions.width > 0 && (
            <Typography variant="caption" sx={{ color: '#4ade80', fontSize: '0.62rem', opacity: 0.9 }}>
              • {dimensions.width}x{dimensions.height}
            </Typography>
          )}
        </Box>

        {isMuted && (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
            }}
          >
            <MicOffRoundedIcon sx={{ color: '#ffffff', fontSize: 13 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const VideoGrid: React.FC = () => {
  const localStream = useChatStore((state) => state.localStream);
  const remoteStreams = useChatStore((state) => state.remoteStreams);
  const peerMediaStates = useChatStore((state) => state.peerMediaStates);
  const members = useChatStore((state) => state.members);
  const displayName = useChatStore((state) => state.displayName);
  const isMuted = useChatStore((state) => state.isMuted);
  const isCameraOff = useChatStore((state) => state.isCameraOff);
  const callType = useChatStore((state) => state.callType);

  const remoteSocketIds = Object.keys(remoteStreams);
  const totalParticipants = 1 + remoteSocketIds.length;

  const getGridItemSize = () => {
    if (totalParticipants === 1) return { xs: 12, sm: 10, md: 8, lg: 6 };
    if (totalParticipants === 2) return { xs: 12, sm: 6, md: 6 };
    if (totalParticipants <= 4) return { xs: 12, sm: 6, md: 6 };
    if (totalParticipants <= 6) return { xs: 12, sm: 6, md: 4 };
    return { xs: 12, sm: 6, md: 4, lg: 3 };
  };

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.5 },
        backgroundColor: 'rgba(11, 15, 25, 0.98)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
      }}
    >
      <Grid container spacing={1.5} justifyContent="center" alignItems="center">
        {/* Local Stream Tile */}
        <Grid item {...getGridItemSize()}>
          <VideoTile
            stream={localStream}
            displayName={displayName}
            isSelf
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            callType={callType}
          />
        </Grid>

        {/* Remote Streams */}
        {remoteSocketIds.map((socketId) => {
          const stream = remoteStreams[socketId] || null;
          const member = members.find((m) => m.socketId === socketId);
          const peerName = member ? member.displayName : 'Remote Peer';
          const peerState = peerMediaStates[socketId] || { isMuted: false, isCameraOff: false };

          return (
            <Grid item key={socketId} {...getGridItemSize()}>
              <VideoTile
                stream={stream}
                displayName={peerName}
                isMuted={peerState.isMuted}
                isCameraOff={peerState.isCameraOff}
                callType={callType}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
