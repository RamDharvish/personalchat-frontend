import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/Layout/PageContainer.js';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer maxWidth="md">
      <Box sx={{ textAlign: 'center', width: '100%', mb: 5 }}>
        {/* Main Hero Title */}
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
            fontWeight: 800,
            lineHeight: 1.1,
            mb: 2,
            background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 70%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          PersonalChat
        </Typography>

        {/* Privacy Description */}
        <Typography
          variant="h6"
          sx={{
            color: 'text.secondary',
            fontWeight: 400,
            maxWidth: 520,
            mx: 'auto',
            mb: 4,
            fontSize: { xs: '1rem', sm: '1.15rem' },
          }}
        >
          Private temporary conversations. No account required.
        </Typography>

        {/* Primary Action Buttons */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 6 }}
        >
          <Button
            id="create-room-btn"
            variant="contained"
            color="primary"
            size="large"
            startIcon={<AddCircleOutlineRoundedIcon />}
            onClick={() => navigate('/create')}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              width: { xs: '100%', sm: 'auto' },
              minWidth: 180,
            }}
          >
            Create Room
          </Button>

          <Button
            id="join-room-btn"
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<LoginRoundedIcon />}
            onClick={() => navigate('/join')}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              width: { xs: '100%', sm: 'auto' },
              minWidth: 180,
            }}
          >
            Join Room
          </Button>
        </Stack>

        {/* Core Privacy Highlights */}
        <Grid container spacing={2.5} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                height: '100%',
                textAlign: 'left',
                p: 1,
                transition: 'transform 0.2s, border-color 0.2s',
                '&:hover': {
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                    color: '#818cf8',
                  }}
                >
                  <VisibilityOffRoundedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Zero Identity
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No sign-up, email, or passwords. Choose a temporary display name and start.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                height: '100%',
                textAlign: 'left',
                p: 1,
                transition: 'transform 0.2s, border-color 0.2s',
                '&:hover': {
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    backgroundColor: 'rgba(6, 182, 212, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                    color: '#22d3ee',
                  }}
                >
                  <LockResetRoundedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Ephemeral Memory
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No databases or persistent logs. When the room closes, everything is gone.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                height: '100%',
                textAlign: 'left',
                p: 1,
                transition: 'transform 0.2s, border-color 0.2s',
                '&:hover': {
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                    color: '#34d399',
                  }}
                >
                  <BoltRoundedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Direct P2P Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Designed for direct peer-to-peer audio, video, and direct file sharing.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};
