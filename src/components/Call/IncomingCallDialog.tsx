import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Avatar,
  Chip,
} from '@mui/material';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { useChatStore } from '../../store/useChatStore.js';

export const IncomingCallDialog: React.FC = () => {
  const callStatus = useChatStore((state) => state.callStatus);
  const callerInfo = useChatStore((state) => state.callerInfo);
  const acceptCall = useChatStore((state) => state.acceptCall);
  const rejectCall = useChatStore((state) => state.rejectCall);

  const open = callStatus === 'incoming' && Boolean(callerInfo);

  if (!open || !callerInfo) {
    return null;
  }

  const isVideo = callerInfo.callType === 'video';

  return (
    <Dialog
      open={open}
      PaperProps={{
        sx: {
          borderRadius: 4,
          backgroundColor: '#111726',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: 2,
          minWidth: { xs: 280, sm: 340 },
          textAlign: 'center',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" color="text.secondary" letterSpacing="0.1em">
          Incoming P2P Call
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: isVideo ? '#0891b2' : '#6366f1',
              fontSize: '2rem',
              fontWeight: 700,
              mb: 2,
              boxShadow: '0 0 24px rgba(99, 102, 241, 0.4)',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.06)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          >
            {callerInfo.displayName.charAt(0).toUpperCase()}
          </Avatar>

          <Typography variant="h6" fontWeight={700} gutterBottom>
            {callerInfo.displayName}
          </Typography>

          <Chip
            icon={isVideo ? <VideocamRoundedIcon /> : <CallRoundedIcon />}
            label={isVideo ? 'Video Call' : 'Voice Call'}
            size="small"
            sx={{
              backgroundColor: isVideo ? 'rgba(6, 182, 212, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: isVideo ? '#22d3ee' : '#a5b4fc',
              fontWeight: 600,
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 2 }}>
        <Button
          id="incoming-call-reject-btn"
          variant="outlined"
          color="error"
          startIcon={<CallEndRoundedIcon />}
          onClick={() => rejectCall('Call declined')}
          sx={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            borderRadius: 3,
            px: 3,
          }}
        >
          Decline
        </Button>

        <Button
          id="incoming-call-accept-btn"
          variant="contained"
          color="success"
          startIcon={isVideo ? <VideocamRoundedIcon /> : <CallRoundedIcon />}
          onClick={acceptCall}
          sx={{
            backgroundColor: '#10b981',
            borderRadius: 3,
            px: 3,
            '&:hover': { backgroundColor: '#059669' },
          }}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};
