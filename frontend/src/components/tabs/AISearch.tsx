import { useState } from 'react';
import { Box, Paper, Typography, InputBase, IconButton, LinearProgress, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { aiSearch } from '../../api';

const QUICK_QUERIES = [
  'BJP vote share trend in UP 2012–2022',
  'Caste composition of Purvanchal',
  'Major infrastructure projects UP 2017–2022',
  'SP vs BJP swing voters analysis',
  'Yogi Adityanath governance impact',
];

export default function AISearch() {
  const [query, setQuery]     = useState('');
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true); setResult(''); setError('');
    try {
      const data = await aiSearch(q);
      setResult(data.result || '');
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 900, mx: 'auto', width: '100%' }}>

      {/* ── Hero Search ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        p: 3.5,
        position: 'relative',
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
              Sarvam AI · Indian Political Intelligence
            </Typography>
          </Box>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.4rem', mb: 0.5 }}>
            Ask the Intelligence Engine
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', mb: 3 }}>
            Query India's political history, caste dynamics, governance records, and electoral patterns.
          </Typography>

          {/* Search Input */}
          <Box sx={{
            display: 'flex',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 2,
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
            transition: 'border-color 0.2s',
            '&:focus-within': { borderColor: 'rgba(232,71,28,0.6)' },
          }}>
            <SearchIcon sx={{ color: 'rgba(255,255,255,0.3)', m: 1.5, fontSize: 20 }} />
            <InputBase
              fullWidth
              placeholder="e.g. What is the BJP's vote share trend in Purvanchal since 2012?"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              sx={{ color: '#f1f5f9', fontSize: '0.9rem', flex: 1, '& input::placeholder': { color: 'rgba(255,255,255,0.25)' } }}
            />
            <IconButton
              onClick={() => handleSearch()}
              disabled={loading}
              sx={{
                m: 0.75, px: 2.5, borderRadius: 1.5,
                background: loading ? 'rgba(232,71,28,0.3)' : '#E8471C',
                color: '#fff',
                fontSize: '0.78rem', fontWeight: 700,
                '&:hover': { background: '#c73c17' },
                '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)' },
                transition: 'background 0.2s',
              }}
            >
              {loading ? '...' : 'Ask AI'}
            </IconButton>
          </Box>

          {loading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #E8471C, #f59e0b)' } }} />}
        </Box>
      </Paper>

      {/* ── Quick Queries ── */}
      {!result && !loading && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LightbulbIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
            <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Suggested Queries
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {QUICK_QUERIES.map(q => (
              <Chip
                key={q}
                label={q}
                onClick={() => handleSearch(q)}
                sx={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': { background: '#fff7f5', borderColor: '#E8471C', color: '#E8471C' },
                  transition: 'all 0.15s',
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Error ── */}
      {error && (
        <Paper elevation={0} sx={{ border: '1px solid #fecaca', background: '#fff5f5', borderRadius: 2, p: 2 }}>
          <Typography sx={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>{error}</Typography>
        </Paper>
      )}

      {/* ── Result ── */}
      {result && (
        <Paper elevation={0} className="fade-in" sx={{
          border: '1px solid #e2e8f0',
          borderRadius: 2.5,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(90deg, #fff7f5, #fff)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AutoAwesomeIcon sx={{ color: '#E8471C', fontSize: 18 }} />
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>AI Intelligence Response</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>Powered by Sarvam AI · Results may vary</Typography>
            </Box>
            <Chip
              label={query.slice(0, 40) + (query.length > 40 ? '…' : '')}
              size="small"
              sx={{ ml: 'auto', background: '#f1f5f9', color: '#64748b', fontSize: '0.65rem', maxWidth: 200 }}
            />
          </Box>
          <Box sx={{
            p: 2.5,
            fontSize: '0.88rem',
            lineHeight: 1.9,
            color: '#1e293b',
            whiteSpace: 'pre-wrap',
            maxHeight: 520,
            overflowY: 'auto',
            background: '#fafafa',
          }}>
            {result}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
