import React from 'react';
import { Box, IconButton, Tooltip, Stack } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import { useChatStore } from '../../store/useChatStore.js';

export const CallControls: React.FC = () => {
  const isMuted = useChatStore((state) => state.isMuted);
  const isCameraOff = useChatStore((state) => state.isCameraOff);
  const callType = useChatStore((state) => state.callType);
  const toggleMute = useChatStore((state) => state.toggleMute);
  const toggleCamera = useChatStore((state) => state.toggleCamera);
  const endCall = useChatStore((state) => state.endCall);

  return (
    <Box
      sx={{
        py: 1,
        px: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        {/* Mute Toggle Button */}
        <Tooltip title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}>
          <IconButton
            id="call-mute-toggle-btn"
            onClick={toggleMute}
            sx={{
              backgroundColor: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              p: 1.5,
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: isMuted ? '#dc2626' : 'rgba(255, 255, 255, 0.15)',
                transform: 'scale(1.05)',
              },
            }}
          >
            {isMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
          </IconButton>
        </Tooltip>

        {/* Camera Toggle Button (Available for video calls or upgrading) */}
        {callType === 'video' && (
          <Tooltip title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
            <IconButton
              id="call-camera-toggle-btn"
              onClick={toggleCamera}
              sx={{
                backgroundColor: isCameraOff ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                p: 1.5,
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: isCameraOff ? '#dc2626' : 'rgba(255, 255, 255, 0.15)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              {isCameraOff ? <VideocamOffRoundedIcon /> : <VideocamRoundedIcon />}
            </IconButton>
          </Tooltip>
        )}

        {/* End Call Button */}
        <Tooltip title="End Call">
          <IconButton
            id="call-end-btn"
            onClick={endCall}
            sx={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              p: 1.5,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: '#dc2626',
                transform: 'scale(1.05)',
              },
            }}
          >
            <CallEndRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
