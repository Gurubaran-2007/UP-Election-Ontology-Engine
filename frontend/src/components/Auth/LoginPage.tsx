import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography, Paper, Divider } from '@mui/material';

export default function LoginPage() {
  const { loginWithRedirect } = useAuth0();

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, p: 5, borderRadius: 3, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.97)' }}>
        <Box sx={{ display: 'flex', height: 5, borderRadius: 1, overflow: 'hidden', mb: 4 }}>
          <Box sx={{ flex: 1, background: '#FF9933' }} />
          <Box sx={{ flex: 1, background: '#ffffff', border: '1px solid #e2e8f0' }} />
          <Box sx={{ flex: 1, background: '#138808' }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.5px', mb: 0.5 }}>
          UP Election Ontology Engine
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Political Strategy &amp; Predictive Intelligence Platform
        </Typography>

        <Divider sx={{ mb: 4 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            AUTHORISED ACCESS ONLY
          </Typography>
        </Divider>

        <Button
          fullWidth variant="contained" size="large"
          onClick={() => loginWithRedirect()}
          sx={{ background: 'linear-gradient(135deg, #FF6B35, #e85d2a)', color: '#fff', fontWeight: 700, fontSize: '1rem', py: 1.5, borderRadius: 2, textTransform: 'none', boxShadow: '0 4px 14px rgba(255,107,53,0.4)', '&:hover': { background: 'linear-gradient(135deg, #ff7a47, #FF6B35)', boxShadow: '0 6px 20px rgba(255,107,53,0.5)' } }}
        >
          Sign In with Auth0
        </Button>

        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 3 }}>
          Secured by Auth0 &nbsp;|&nbsp; Government of Uttar Pradesh
        </Typography>
      </Paper>
    </Box>
  );
}
