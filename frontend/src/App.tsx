import { useAuth0 } from '@auth0/auth0-react';
import { Box, CircularProgress } from '@mui/material';
import LoginPage from './components/Auth/LoginPage';
import AppLayout from './components/Layout/AppLayout';

export default function App() {
  const { isLoading, isAuthenticated } = useAuth0();

  if (isLoading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
        <CircularProgress sx={{ color: '#FF6B35' }} />
      </Box>
    );
  }

  return isAuthenticated ? <AppLayout /> : <LoginPage />;
}
