import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, Grid } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getUPDashboard, getUPWeather } from '../../api';

const KPI_CARDS = [
  { label: 'Total Voters',     value: '15.03 Cr', delta: 'Registered 2022', color: '#E8471C', bg: 'linear-gradient(135deg, #fff7f5, #ffede8)', Icon: PeopleIcon },
  { label: 'Assembly Seats',   value: '403',       delta: 'UP Legislature', color: '#1e3a8a', bg: 'linear-gradient(135deg, #f0f4ff, #e0e9ff)', Icon: AccountBalanceIcon },
  { label: 'Districts',        value: '75',        delta: 'Administrative', color: '#138808', bg: 'linear-gradient(135deg, #f0fff4, #dcfce7)', Icon: TrendingUpIcon },
  { label: 'Constituencies',   value: '403',       delta: 'Vidhan Sabha',   color: '#7c3aed', bg: 'linear-gradient(135deg, #faf5ff, #ede9fe)', Icon: AccountBalanceIcon },
];

export default function UPDashboard() {
  const [schemes, setSchemes] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUPDashboard(), getUPWeather()])
      .then(([s, w]) => { setSchemes(s); setWeather(w); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Hero Banner ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1e40af 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        {/* Subtle grid pattern */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <Box sx={{ position: 'relative', p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ height: 3, width: 40, borderRadius: 2, background: 'linear-gradient(90deg, #FF9933, #fff, #138808)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                Uttar Pradesh
              </Typography>
            </Box>
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.5rem', lineHeight: 1.1, mb: 0.5 }}>
              Political Command Center
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' }}>
              Real-time governance, scheme tracking &amp; climatic intelligence
            </Typography>
          </Box>
          {weather && (
            <Box sx={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2.5,
              px: 2.5, py: 1.5,
              textAlign: 'right',
              backdropFilter: 'blur(8px)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end', mb: 0.5 }}>
                <ThermostatIcon sx={{ color: '#fb923c', fontSize: 18 }} />
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem' }}>
                  {weather.temp || '—'}°C
                </Typography>
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{weather.condition || 'Clear'}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>{weather.city || 'Lucknow'}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── KPI Cards ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
        {KPI_CARDS.map(({ label, value, delta, color, bg, Icon }) => (
          <Paper key={label} elevation={0} sx={{
            borderRadius: 2.5,
            border: '1px solid rgba(0,0,0,0.06)',
            background: bg,
            p: 2,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {label}
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon sx={{ fontSize: 17, color }} />
              </Box>
            </Box>
            <Typography sx={{ color, fontWeight: 900, fontSize: '1.8rem', lineHeight: 1, mb: 0.5 }}>
              {value}
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>{delta}</Typography>
            {/* Decorative corner accent */}
            <Box sx={{ position: 'absolute', bottom: -8, right: -8, width: 56, height: 56, borderRadius: '50%', background: `${color}0a` }} />
          </Paper>
        ))}
      </Box>

      {/* ── Scheme Cards ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <div className="loading-spinner" />
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Paper elevation={0} sx={{
              borderRadius: 2.5,
              border: '1px solid rgba(0,0,0,0.06)',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(90deg, #fff7f5, #fff)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 4, height: 20, borderRadius: 4, background: '#E8471C' }} />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>Recently Introduced Schemes</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>Government of Uttar Pradesh</Typography>
                </Box>
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {schemes?.recent?.length > 0
                  ? schemes.recent.map((s: any, i: number) => <SchemeCard key={i} scheme={s} color="#E8471C" />)
                  : <EmptyState label="No recent schemes available" />}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={6}>
            <Paper elevation={0} sx={{
              borderRadius: 2.5,
              border: '1px solid rgba(0,0,0,0.06)',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(90deg, #f0fff4, #fff)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 4, height: 20, borderRadius: 4, background: '#138808' }} />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>Upcoming Schemes</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>Pipeline &amp; announced</Typography>
                </Box>
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {schemes?.future?.length > 0
                  ? schemes.future.map((s: any, i: number) => <SchemeCard key={i} scheme={s} color="#138808" />)
                  : <EmptyState label="No upcoming schemes available" />}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

function SchemeCard({ scheme, color }: { scheme: any; color: string }) {
  return (
    <Box sx={{
      border: '1px solid #f1f5f9',
      borderLeft: `3px solid ${color}`,
      borderRadius: '0 10px 10px 0',
      p: 1.5,
      background: '#fafafa',
      transition: 'box-shadow 0.18s',
      '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', mb: 0.4 }}>
        {scheme.title || scheme.name}
      </Typography>
      {scheme.category && (
        <Chip label={scheme.category} size="small" sx={{ mb: 0.6, fontSize: '0.62rem', height: 18, background: `${color}12`, color, border: `1px solid ${color}30`, fontWeight: 600 }} />
      )}
      <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
        {scheme.description || scheme.summary}
      </Typography>
      {scheme.beneficiaries && (
        <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.5 }}>
          Beneficiaries: <strong style={{ color: '#64748b' }}>{scheme.beneficiaries}</strong>
        </Typography>
      )}
    </Box>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Box sx={{ py: 3, textAlign: 'center' }}>
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{label}</Typography>
    </Box>
  );
}
