import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { PageContainer } from '../components/Layout/PageContainer.js';
import { useChatStore } from '../store/useChatStore.js';
import { validateDisplayName, validateRoomCode } from '../utils/validation.js';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const joinRoom = useChatStore((state) => state.joinRoom);
  const isLoading = useChatStore((state) => state.isLoading);
  const serverError = useChatStore((state) => state.errorMessage);
  const clearError = useChatStore((state) => state.clearError);

  const initialCode = (
    searchParams.get('code') ||
    (location.state as { code?: string } | null)?.code ||
    ''
  )
    .replace(/\D/g, '')
    .slice(0, 4);

  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, code: false });

  // Sync room code if query param or location state updates
  React.useEffect(() => {
    const raw = searchParams.get('code') || (location.state as { code?: string } | null)?.code || '';
    const clean = raw.replace(/\D/g, '').slice(0, 4);
    if (clean) {
      setCode(clean);
    }
  }, [searchParams, location.state]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    clearError();
    if (touched.name) {
      const res = validateDisplayName(val);
      setNameError(res.isValid ? null : res.error || null);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(digitsOnly);
    clearError();
    if (touched.code) {
      const res = validateRoomCode(digitsOnly);
      setCodeError(res.isValid ? null : res.error || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, code: true });
    clearError();

    const nameValidation = validateDisplayName(name);
    const codeValidation = validateRoomCode(code);

    setNameError(nameValidation.isValid ? null : nameValidation.error || 'Invalid name');
    setCodeError(codeValidation.isValid ? null : codeValidation.error || 'Invalid room code');

    if (!nameValidation.isValid || !codeValidation.isValid) {
      return;
    }

    try {
      await joinRoom(nameValidation.sanitizedValue, codeValidation.sanitizedValue);
      navigate(`/room/${codeValidation.sanitizedValue}`);
    } catch {
      // Error handled by store errorMessage state
    }
  };

  return (
    <PageContainer maxWidth="sm">
      <Card sx={{ width: '100%', p: { xs: 2, sm: 3 } }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button
              id="back-home-btn"
              variant="text"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => {
                clearError();
                navigate('/');
              }}
              sx={{ color: 'text.secondary', px: 1 }}
            >
              Back
            </Button>
          </Box>

          <Typography
            variant="overline"
            sx={{ color: '#06b6d4', fontWeight: 700, letterSpacing: '0.08em' }}
          >
            PersonalChat
          </Typography>
          <Typography variant="h5" component="h1" fontWeight={700} gutterBottom>
            Join Private Room
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Enter your display name and the 4-digit code provided by the room creator.
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
              {serverError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={3}>
              {/* Name Input */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Name
                </Typography>
                <TextField
                  id="join-display-name-input"
                  fullWidth
                  placeholder="Enter your name"
                  value={name}
                  onChange={handleNameChange}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    const res = validateDisplayName(name);
                    setNameError(res.isValid ? null : res.error || null);
                  }}
                  error={Boolean(nameError)}
                  helperText={nameError}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ maxLength: 24 }}
                />
              </Box>

              {/* 4-digit Room Code Input */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Room Code
                </Typography>
                <TextField
                  id="join-room-code-input"
                  fullWidth
                  placeholder="4 digit code"
                  value={code}
                  onChange={handleCodeChange}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, code: true }));
                    const res = validateRoomCode(code);
                    setCodeError(res.isValid ? null : res.error || null);
                  }}
                  error={Boolean(codeError)}
                  helperText={codeError || 'Must be a 4-digit number (e.g. 4821)'}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <DialpadRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{
                    maxLength: 4,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: {
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: '0.25em',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                    },
                  }}
                />
              </Box>

              {/* Submit Button */}
              <Button
                id="join-room-submit-btn"
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                disabled={isLoading}
                startIcon={
                  isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <LoginRoundedIcon />
                  )
                }
                sx={{ py: 1.4, mt: 2 }}
              >
                {isLoading ? 'Joining Room...' : 'Join Room'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
