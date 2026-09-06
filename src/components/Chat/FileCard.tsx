import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  IconButton,
  Chip,
  Dialog,
  DialogContent,
  Tooltip,
  CircularProgress,
  Stack,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import AudioFileRoundedIcon from '@mui/icons-material/AudioFileRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { FileTransferItem } from '../../types/index.js';
import { useChatStore } from '../../store/useChatStore.js';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';

interface FileCardProps {
  item: FileTransferItem;
}

export const FileCard: React.FC<FileCardProps> = ({ item }) => {
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const cancelFileTransfer = useChatStore((state) => state.cancelFileTransfer);
  const downloadFile = useChatStore((state) => state.downloadFile);
  const requestFileDownload = useChatStore((state) => state.requestFileDownload);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = item.mimeType.startsWith('image/');
  const isVideo = item.mimeType.startsWith('video/');
  const isAudio = item.mimeType.startsWith('audio/');
  const isPdf =
    item.mimeType === 'application/pdf' || item.fileName.toLowerCase().endsWith('.pdf');

  const getFileIcon = () => {
    if (item.isVoiceNote) return <MicRoundedIcon sx={{ color: item.isSelf ? '#818cf8' : '#22d3ee' }} />;
    if (isImage) return <ImageRoundedIcon sx={{ color: '#818cf8' }} />;
    if (isVideo) return <VideoFileRoundedIcon sx={{ color: '#22d3ee' }} />;
    if (isAudio) return <AudioFileRoundedIcon sx={{ color: '#f59e0b' }} />;
    if (isPdf) return <PictureAsPdfRoundedIcon sx={{ color: '#ef4444' }} />;
    return <InsertDriveFileRoundedIcon sx={{ color: '#94a3b8' }} />;
  };

  const isTransferring = item.state === 'sending' || item.state === 'receiving' || item.state === 'preparing';

  const handleRequestDownload = async () => {
    try {
      await requestFileDownload(item.id);
    } catch {
      // Error handled in store
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 360,
        borderRadius: 3,
        p: 2,
        backgroundColor: item.isSelf ? 'rgba(79, 70, 229, 0.25)' : 'rgba(30, 41, 59, 0.85)',
        border: `1px solid ${item.isSelf ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* File Header Details */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
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

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ color: '#f8fafc' }}>
            {item.isVoiceNote ? 'Voice Message' : item.fileName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.isVoiceNote && item.duration
              ? `${Math.floor(item.duration / 60)}:${item.duration % 60 < 10 ? '0' : ''}${item.duration % 60} • ${formatFileSize(item.fileSize)}`
              : formatFileSize(item.fileSize)}{' '}
            • {item.isSelf ? 'You' : item.senderName}
          </Typography>
        </Box>

        {isTransferring && (
          <Tooltip title="Cancel Transfer">
            <IconButton size="small" onClick={() => cancelFileTransfer(item.id)} sx={{ color: '#f87171' }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Receiver Offered State: [ Download ] (Standard files only) */}
      {!item.isSelf && item.state === 'offered' && (
        <Box sx={{ mt: 1 }}>
          <Button
            id={`request-download-btn-${item.id}`}
            variant="contained"
            size="small"
            fullWidth
            startIcon={<DownloadRoundedIcon />}
            onClick={handleRequestDownload}
            sx={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              py: 0.8,
              fontWeight: 700,
              '&:hover': { backgroundColor: '#4f46e5' },
            }}
          >
            Download
          </Button>
        </Box>
      )}

      {/* Receiver Pending Approval State */}
      {!item.isSelf && item.state === 'pending_approval' && (
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={18} sx={{ color: '#fbbf24' }} />
          <Box>
            <Typography variant="caption" fontWeight={700} sx={{ color: '#fbbf24', display: 'block' }}>
              Waiting for sender approval...
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Sender will be prompted to allow download.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Receiving State with Progress Bar */}
      {item.state === 'receiving' && (
        <Box sx={{ mb: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 600 }}>
              {item.isVoiceNote ? 'Receiving voice message...' : 'Downloading...'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 700 }}>
              {item.progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={item.progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: item.isVoiceNote ? '#06b6d4' : '#6366f1',
                borderRadius: 3,
              },
            }}
          />
        </Box>
      )}

      {/* Sending State (for active upload) */}
      {item.state === 'sending' && (
        <Box sx={{ mb: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 600 }}>
              {item.isVoiceNote ? 'Sending voice message...' : 'Sending to peer...'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 700 }}>
              {item.progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={item.progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#6366f1',
                borderRadius: 3,
              },
            }}
          />
        </Box>
      )}

      {/* Completed State: Inline VoiceNotePlayer / Previews & Download Action */}
      {item.state === 'completed' && item.blobUrl && (
        <Box sx={{ mt: 1 }}>
          {item.isVoiceNote ? (
            <VoiceNotePlayer item={item} />
          ) : (
            <>
              {!item.isSelf && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CheckCircleRoundedIcon sx={{ color: '#34d399', fontSize: 16 }} />
                  <Typography variant="caption" sx={{ color: '#34d399', fontWeight: 600 }}>
                    Download complete
                  </Typography>
                </Stack>
              )}

              {/* Image Preview */}
              {isImage && (
                <Box
                  component="img"
                  src={item.blobUrl}
                  alt={item.fileName}
                  onClick={() => setImageLightboxOpen(true)}
                  sx={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 2,
                    cursor: 'pointer',
                    mb: 1.5,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.9 },
                  }}
                />
              )}

              {/* Video Preview */}
              {isVideo && (
                <Box sx={{ mb: 1.5, borderRadius: 2, overflow: 'hidden' }}>
                  <video
                    src={item.blobUrl}
                    controls
                    preload="metadata"
                    style={{ width: '100%', maxHeight: 220, borderRadius: 8, display: 'block' }}
                  />
                </Box>
              )}

              {/* Audio Preview */}
              {isAudio && (
                <Box sx={{ mb: 1.5, width: '100%' }}>
                  <audio src={item.blobUrl} controls style={{ width: '100%', height: 36 }} />
                </Box>
              )}

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <Button
                  id={`open-file-${item.id}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                  startIcon={<OpenInNewRoundedIcon />}
                  onClick={() => window.open(item.blobUrl, '_blank')}
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#cbd5e1',
                    py: 0.6,
                    '&:hover': { borderColor: 'rgba(255, 255, 255, 0.4)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                  }}
                >
                  Open
                </Button>
                <Button
                  id={`download-file-${item.id}`}
                  variant="contained"
                  size="small"
                  fullWidth
                  startIcon={<DownloadRoundedIcon />}
                  onClick={() => downloadFile(item.id)}
                  sx={{
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    py: 0.6,
                    fontWeight: 700,
                    '&:hover': { backgroundColor: '#4f46e5' },
                  }}
                >
                  {item.isSelf ? 'Download' : 'Save'}
                </Button>
              </Stack>
            </>
          )}
        </Box>
      )}

      {/* Rejected State */}
      {item.state === 'rejected' && (
        <Box sx={{ mt: 1 }}>
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              mb: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 600, display: 'block' }}>
              Sender rejected the download request.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<ReplayRoundedIcon />}
            onClick={handleRequestDownload}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              fontSize: '0.75rem',
            }}
          >
            Request Again
          </Button>
        </Box>
      )}

      {/* Expired State */}
      {item.state === 'expired' && (
        <Box sx={{ mt: 1 }}>
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <HourglassEmptyRoundedIcon sx={{ color: '#fbbf24', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 600 }}>
              Download request expired.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<ReplayRoundedIcon />}
            onClick={handleRequestDownload}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              fontSize: '0.75rem',
            }}
          >
            Request Again
          </Button>
        </Box>
      )}

      {/* Cancelled / Failed State */}
      {item.state === 'cancelled' && (
        <Chip label="Transfer Cancelled" size="small" color="error" variant="outlined" sx={{ mt: 1 }} />
      )}
      {item.state === 'failed' && (
        <Chip label="Transfer Failed" size="small" color="error" sx={{ mt: 1 }} />
      )}

      {/* Image Lightbox Modal */}
      {isImage && item.blobUrl && (
        <Dialog open={imageLightboxOpen} onClose={() => setImageLightboxOpen(false)} maxWidth="md">
          <DialogContent sx={{ p: 1, backgroundColor: '#090d16', display: 'flex', justifyContent: 'center' }}>
            <Box
              component="img"
              src={item.blobUrl}
              alt={item.fileName}
              sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 2 }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};
