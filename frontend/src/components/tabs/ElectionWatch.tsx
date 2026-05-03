import { Box, Paper, Typography, Button } from '@mui/material';

export default function ElectionWatch() {
  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
          <Box>
            <Typography fontWeight={800} fontSize="1.1rem">National Election Watch</Typography>
            <Typography variant="caption" color="text.secondary">Powered by Myneta.info — Candidate & election data for India</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => { const f = document.getElementById('myneta-frame') as HTMLIFrameElement; if (f) f.src = '/proxy/myneta'; }}
              sx={{ textTransform: 'none', fontSize: '0.78rem' }}>
              Reload
            </Button>
            <Button size="small" variant="contained" href="https://myneta.info" target="_blank"
              sx={{ textTransform: 'none', fontSize: '0.78rem', background: '#FF6B35', '&:hover': { background: '#e85d2a' } }}>
              Open Full Site ↗
            </Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <iframe
            id="myneta-frame"
            src="/proxy/myneta"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="National Election Watch — Myneta.info"
          />
        </Box>
      </Paper>
    </Box>
  );
}
