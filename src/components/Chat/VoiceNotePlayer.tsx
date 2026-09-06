import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import type { FileTransferItem } from '../../types/index.js';

interface VoiceNotePlayerProps {
  item: FileTransferItem;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ item }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    if (item.duration && duration === 0) {
      setDuration(item.duration);
    }
  }, [item.duration, duration]);

  const handlePlayPause = () => {
    if (!audioRef.current || !item.blobUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('[VoiceNotePlayer] Playback error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!duration || isNaN(duration))) {
      const audioDuration = audioRef.current.duration;
      if (!isNaN(audioDuration) && isFinite(audioDuration)) {
        setDuration(Math.round(audioDuration));
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (_e: Event, newValue: number | number[]) => {
    const seekTime = Array.isArray(newValue) ? newValue[0] : newValue;
    if (audioRef.current && typeof seekTime === 'number') {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.8,
      }}
    >
      {/* Hidden Audio Element */}
      {item.blobUrl && (
        <audio
          ref={audioRef}
          src={item.blobUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Player Controls Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.2,
          borderRadius: 2.5,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Play / Pause Button */}
        <IconButton
          id={`play-voice-note-${item.id}`}
          onClick={handlePlayPause}
          disabled={!item.blobUrl}
          size="small"
          sx={{
            width: 38,
            height: 38,
            backgroundColor: item.isSelf ? '#6366f1' : '#06b6d4',
            color: '#ffffff',
            flexShrink: 0,
            '&:hover': {
              backgroundColor: item.isSelf ? '#4f46e5' : '#0891b2',
            },
            '&.Mui-disabled': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {isPlaying ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
        </IconButton>

        {/* Progress Slider and Timing */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Slider
            size="small"
            value={currentTime}
            min={0}
            max={duration || 1}
            step={0.1}
            onChange={handleSeek}
            disabled={!item.blobUrl}
            sx={{
              color: item.isSelf ? '#818cf8' : '#22d3ee',
              height: 4,
              py: 0.8,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
                transition: '0.2s cubic-bezier(.47,1.64,.41,.8)',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 6px rgba(99, 102, 241, 0.16)',
                },
              },
              '& .MuiSlider-rail': {
                opacity: 0.28,
                backgroundColor: '#ffffff',
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {formatTime(duration)}
            </Typography>
          </Box>
        </Box>

        {/* Mic Icon Pill */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            flexShrink: 0,
          }}
        >
          <MicRoundedIcon sx={{ fontSize: 16, color: item.isSelf ? '#a5b4fc' : '#67e8f9' }} />
        </Box>
      </Box>
    </Box>
  );
};

