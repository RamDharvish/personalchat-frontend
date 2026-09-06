import React from 'react';
import { Box, Container } from '@mui/material';
import { Header } from './Header.js';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, maxWidth = 'sm' }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header />
      <Container
        maxWidth={maxWidth}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: { xs: 4, md: 8 },
        }}
      >
        {children}
      </Container>
    </Box>
  );
};
