import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  FormHelperText,
  InputAdornment,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/Layout/PageContainer.js';
import { useChatStore } from '../store/useChatStore.js';
import { validateDisplayName, validateRoomCapacity } from '../utils/validation.js';
import type { RoomCapacity } from '../types/index.js';

type CapacityOption = 2 | 3 | 4 | 'custom';

export const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const createRoom = useChatStore((state) => state.createRoom);
  const isLoading = useChatStore((state) => state.isLoading);
  const serverError = useChatStore((state) => state.errorMessage);
  const clearError = useChatStore((state) => state.clearError);

  const [name, setName] = useState('');
  const [selectedOption, setSelectedOption] = useState<CapacityOption>(2);
  const [customCapacity, setCustomCapacity] = useState('10');
  const [nameError, setNameError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [customTouched, setCustomTouched] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    clearError();
    if (touched) {
      const res = validateDisplayName(val);
      setNameError(res.isValid ? null : res.error || null);
    }
  };

  const handleCapacityOptionChange = (
    _event: React.MouseEvent<HTMLElement>,
    newOption: CapacityOption | null
  ) => {
    if (newOption !== null) {
      setSelectedOption(newOption);
      clearError();
      if (newOption !== 'custom') {
        setCapacityError(null);
      } else if (customTouched) {
        const res = validateRoomCapacity(customCapacity);
        setCapacityError(res.isValid ? null : res.error || null);
      }
    }
  };

  const handleCustomCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCapacity(val);
    clearError();
    if (customTouched) {
      const res = validateRoomCapacity(val);
      setCapacityError(res.isValid ? null : res.error || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    clearError();

    const nameValidation = validateDisplayName(name);
    if (!nameValidation.isValid) {
      setNameError(nameValidation.error || 'Please enter a valid display name');
      return;
    }

    let finalCapacity: RoomCapacity = 2;
    if (selectedOption === 'custom') {
      setCustomTouched(true);
      const capValidation = validateRoomCapacity(customCapacity);
      if (!capValidation.isValid) {
        setCapacityError(capValidation.error || 'Please enter a valid room capacity');
        return;
      }
      finalCapacity = capValidation.capacity;
    } else {
      finalCapacity = selectedOption;
    }

    try {
      const roomCode = await createRoom(nameValidation.sanitizedValue, finalCapacity);
      navigate(`/room/${roomCode}`);
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
            sx={{ color: '#818cf8', fontWeight: 700, letterSpacing: '0.08em' }}
          >
            PersonalChat
          </Typography>
          <Typography variant="h5" component="h1" fontWeight={700} gutterBottom>
            Create Private Room
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Set up an ephemeral room. No conversation data is stored on disk or server.
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
              {serverError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={3}>
              {/* Display Name Input */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Name
                </Typography>
                <TextField
                  id="display-name-input"
                  fullWidth
                  placeholder="Enter your name"
                  value={name}
                  onChange={handleNameChange}
                  onBlur={() => {
                    setTouched(true);
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

              {/* Maximum Members Selection */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Maximum members
                </Typography>
                <ToggleButtonGroup
                  id="room-capacity-group"
                  value={selectedOption}
                  exclusive
                  onChange={handleCapacityOptionChange}
                  fullWidth
                  disabled={isLoading}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                    gap: 1,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid rgba(255, 255, 255, 0.12) !important',
                      borderRadius: '8px !important',
                    },
                    '& .MuiToggleButton-root': {
                      py: 1.2,
                      fontWeight: 700,
                      color: 'text.secondary',
                      gap: 0.5,
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        borderColor: '#6366f1 !important',
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      },
                    },
                  }}
                >
                  <ToggleButton id="capacity-btn-2" value={2} aria-label="2 members">
                    <GroupOutlinedIcon fontSize="small" /> 2 Members
                  </ToggleButton>
                  <ToggleButton id="capacity-btn-3" value={3} aria-label="3 members">
                    <GroupOutlinedIcon fontSize="small" /> 3 Members
                  </ToggleButton>
                  <ToggleButton id="capacity-btn-4" value={4} aria-label="4 members">
                    <GroupOutlinedIcon fontSize="small" /> 4 Members
                  </ToggleButton>
                  <ToggleButton id="capacity-btn-custom" value="custom" aria-label="Custom capacity">
                    <TuneRoundedIcon fontSize="small" /> Custom
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Custom Capacity Number Input */}
                <Collapse in={selectedOption === 'custom'}>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" fontWeight={600} sx={{ color: '#a5b4fc', mb: 0.8, display: 'block' }}>
                      Custom Room Capacity (2 – 20 members)
                    </Typography>
                    <TextField
                      id="custom-capacity-input"
                      fullWidth
                      type="number"
                      placeholder="Enter maximum members (2–20)"
                      value={customCapacity}
                      onChange={handleCustomCapacityChange}
                      onBlur={() => {
                        setCustomTouched(true);
                        const res = validateRoomCapacity(customCapacity);
                        setCapacityError(res.isValid ? null : res.error || null);
                      }}
                      error={Boolean(capacityError)}
                      helperText={capacityError || 'Specify maximum simultaneous peers allowed in this room'}
                      disabled={isLoading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <GroupOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              Members
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{
                        min: 2,
                        max: 20,
                        step: 1,
                        inputMode: 'numeric',
                      }}
                    />
                  </Box>
                </Collapse>

                {selectedOption !== 'custom' && (
                  <FormHelperText sx={{ mt: 0.8, color: 'text.secondary' }}>
                    {selectedOption === 2
                      ? 'Default is 2 peers for direct 1-on-1 private conversations.'
                      : `Selected maximum capacity of ${selectedOption} members.`}
                  </FormHelperText>
                )}
              </Box>

              {/* Submit Button */}
              <Button
                id="create-room-submit-btn"
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={isLoading}
                startIcon={
                  isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <AddCircleOutlineRoundedIcon />
                  )
                }
                sx={{ py: 1.4, mt: 2 }}
              >
                {isLoading ? 'Creating Room...' : 'Create Room'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
