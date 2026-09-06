import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  LinearProgress,
  Stack,
} from '@mui/material';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import AudioFileRoundedIcon from '@mui/icons-material/AudioFileRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useChatStore } from '../../store/useChatStore.js';
import { REQUEST_TIMEOUT_MS } from '../../services/fileTransfer.js';

export const DownloadApprovalDialog: React.FC = () => {
  const pendingRequests = useChatStore((state) => state.pendingDownloadRequests);
  const respondToDownloadRequest = useChatStore((state) => state.respondToDownloadRequest);

  const currentRequest = pendingRequests[0];
  const [timeLeftMs, setTimeLeftMs] = useState(REQUEST_TIMEOUT_MS);

  useEffect(() => {
    if (!currentRequest) {
      setTimeLeftMs(REQUEST_TIMEOUT_MS);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - currentRequest.receivedAt;
      const remaining = Math.max(0, REQUEST_TIMEOUT_MS - elapsed);
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        respondToDownloadRequest(currentRequest.transferId, false);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentRequest, respondToDownloadRequest]);

  if (!currentRequest) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = currentRequest.mimeType.startsWith('image/');
  const isVideo = currentRequest.mimeType.startsWith('video/');
  const isAudio = currentRequest.mimeType.startsWith('audio/');
  const isPdf =
    currentRequest.mimeType === 'application/pdf' ||
    currentRequest.fileName.toLowerCase().endsWith('.pdf');

  const getFileIcon = () => {
    if (isImage) return <ImageRoundedIcon sx={{ color: '#818cf8', fontSize: 32 }} />;
    if (isVideo) return <VideoFileRoundedIcon sx={{ color: '#22d3ee', fontSize: 32 }} />;
    if (isAudio) return <AudioFileRoundedIcon sx={{ color: '#f59e0b', fontSize: 32 }} />;
    if (isPdf) return <PictureAsPdfRoundedIcon sx={{ color: '#ef4444', fontSize: 32 }} />;
    return <InsertDriveFileRoundedIcon sx={{ color: '#94a3b8', fontSize: 32 }} />;
  };

  const progressPercent = (timeLeftMs / REQUEST_TIMEOUT_MS) * 100;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  const handleAllow = () => {
    respondToDownloadRequest(currentRequest.transferId, true);
  };

  const handleReject = () => {
    respondToDownloadRequest(currentRequest.transferId, false);
  };

  return (
    <Dialog
      open={Boolean(currentRequest)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: '#0f172a',
          backgroundImage: 'none',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SecurityRoundedIcon sx={{ color: '#818cf8', fontSize: 24 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: '#f8fafc' }}>
            File Download Request
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
          <strong style={{ color: '#a5b4fc' }}>{currentRequest.requesterName}</strong> wants to download:
        </Typography>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getFileIcon()}
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ color: '#f8fafc' }}>
              {currentRequest.fileName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {formatFileSize(currentRequest.fileSize)}
            </Typography>
          </Box>
        </Box>

        {/* Timeout indicator */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Auto-declines in {secondsLeft}s
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#6366f1',
                borderRadius: 2,
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
        <Button
          id="download-reject-btn"
          variant="outlined"
          color="error"
          fullWidth
          startIcon={<CloseRoundedIcon />}
          onClick={handleReject}
          sx={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: '#ef4444',
            },
          }}
        >
          Reject
        </Button>

        <Button
          id="download-allow-btn"
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<CheckRoundedIcon />}
          onClick={handleAllow}
          sx={{
            backgroundColor: '#6366f1',
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#4f46e5' },
          }}
        >
          Allow
        </Button>
      </DialogActions>
    </Dialog>
  );
};
