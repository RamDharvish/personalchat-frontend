import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, Container } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: 'transparent',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', py: 1.5 }}>
          <Box
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.9 },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <ShieldOutlinedIcon sx={{ color: '#ffffff', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              PersonalChat
            </Typography>
          </Box>

          <Chip
            label="Privacy First"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
            }}
          />
        </Toolbar>
      </Container>
    </AppBar>
  );
};
