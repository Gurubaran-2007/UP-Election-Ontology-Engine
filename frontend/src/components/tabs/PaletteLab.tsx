import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaletteIcon from '@mui/icons-material/Palette';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface PaletteOption {
  name: string;
  mode: 'Dark' | 'Light' | 'Hybrid';
  mood: string;
  bestFor: string;
  background: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
}

const PALETTES: PaletteOption[] = [
  {
    name: 'Intelligence Charcoal',
    mode: 'Dark',
    mood: 'Sharp, serious, India-aware',
    bestFor: 'Best default for your current product direction.',
    background: '#020617',
    panel: '#0F172A',
    panelAlt: '#111827',
    text: '#F8FAFC',
    muted: '#94A3B8',
    primary: '#F97316',
    secondary: '#38BDF8',
    success: '#22C55E',
    warning: '#F59E0B',
  },
  {
    name: 'Graphite Election Ink',
    mode: 'Dark',
    mood: 'Enterprise, institutional, restrained',
    bestFor: 'Most SaaS-like, least campaign-like.',
    background: '#080A0F',
    panel: '#11141B',
    panelAlt: '#171B24',
    text: '#F4F7FB',
    muted: '#8B95A7',
    primary: '#2F80ED',
    secondary: '#E8471C',
    success: '#16A34A',
    warning: '#EAB308',
  },
  {
    name: 'Civic Cloud',
    mode: 'Light',
    mood: 'Clean, official, calm',
    bestFor: 'A polished SaaS product that needs long analyst sessions.',
    background: '#F6F8FB',
    panel: '#FFFFFF',
    panelAlt: '#EEF3F8',
    text: '#111827',
    muted: '#64748B',
    primary: '#2563EB',
    secondary: '#E8471C',
    success: '#16A34A',
    warning: '#D97706',
  },
  {
    name: 'Election Briefing',
    mode: 'Light',
    mood: 'Editorial, readable, premium',
    bestFor: 'When the product should feel like a daily intelligence brief.',
    background: '#FAFAF7',
    panel: '#FFFFFF',
    panelAlt: '#F1F5F0',
    text: '#1F2933',
    muted: '#6B7280',
    primary: '#0F766E',
    secondary: '#C2410C',
    success: '#15803D',
    warning: '#B45309',
  },
  {
    name: 'Studio Slate',
    mode: 'Light',
    mood: 'Modern SaaS, neutral, fast',
    bestFor: 'A clean B2B interface with minimal political color bias.',
    background: '#F8FAFC',
    panel: '#FFFFFF',
    panelAlt: '#F1F5F9',
    text: '#0F172A',
    muted: '#64748B',
    primary: '#4F46E5',
    secondary: '#0891B2',
    success: '#059669',
    warning: '#D97706',
  },
  {
    name: 'Navy Shell',
    mode: 'Hybrid',
    mood: 'Dark navigation, light workspace',
    bestFor: 'Most familiar enterprise SaaS pattern for mixed teams.',
    background: '#EAF0F7',
    panel: '#FFFFFF',
    panelAlt: '#0B1220',
    text: '#0F172A',
    muted: '#64748B',
    primary: '#1D4ED8',
    secondary: '#F97316',
    success: '#16A34A',
    warning: '#CA8A04',
  },
  {
    name: 'Sandstone Operations',
    mode: 'Light',
    mood: 'Warm, field-oriented, approachable',
    bestFor: 'A less intimidating product for district teams and operators.',
    background: '#FBF7F0',
    panel: '#FFFFFF',
    panelAlt: '#F3EBDD',
    text: '#27231F',
    muted: '#746B61',
    primary: '#B45309',
    secondary: '#2563EB',
    success: '#15803D',
    warning: '#DC2626',
  },
  {
    name: 'Carbon Signal Cyan',
    mode: 'Dark',
    mood: 'Modern AI SaaS, technical, crisp',
    bestFor: 'If you want it to feel like an AI-native analytics product.',
    background: '#050505',
    panel: '#111111',
    panelAlt: '#18181B',
    text: '#FAFAFA',
    muted: '#A1A1AA',
    primary: '#22D3EE',
    secondary: '#F97316',
    success: '#10B981',
    warning: '#F59E0B',
  },
];

const labels = ['Background', 'Panel', 'Alt', 'Text', 'Muted', 'Primary', 'Secondary', 'Success', 'Warning'];

function PalettePreview({ palette }: { palette: PaletteOption }) {
  const values = [
    palette.background,
    palette.panel,
    palette.panelAlt,
    palette.text,
    palette.muted,
    palette.primary,
    palette.secondary,
    palette.success,
    palette.warning,
  ];
  const primaryButtonText = palette.mode === 'Light' || palette.mode === 'Hybrid' ? '#FFFFFF' : palette.background;
  const heroPanelBg = palette.mode === 'Hybrid' ? palette.panelAlt : palette.panelAlt;
  const heroText = palette.mode === 'Hybrid' ? '#F8FAFC' : palette.text;
  const heroMuted = palette.mode === 'Hybrid' ? '#94A3B8' : palette.muted;

  return (
    <Paper
      elevation={0}
      sx={{
        background: palette.background,
        border: `1px solid ${palette.muted}33`,
        borderRadius: 2,
        overflow: 'hidden',
        minHeight: 520,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${palette.muted}22`, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ color: palette.text, fontSize: '1rem', fontWeight: 900 }}>
            {palette.name}
          </Typography>
          <Typography sx={{ color: palette.muted, fontSize: '0.74rem', lineHeight: 1.5, mt: 0.4 }}>
            {palette.mood}
          </Typography>
        </Box>
        <Chip
          label={palette.mode}
          size="small"
          sx={{
            height: 24,
            color: palette.primary,
            background: `${palette.primary}18`,
            border: `1px solid ${palette.primary}44`,
            fontSize: '0.66rem',
            fontWeight: 850,
          }}
        />
      </Box>

      <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 0.7 }}>
          {values.map((color, index) => (
            <Box key={`${palette.name}-${color}`} title={`${labels[index]} ${color}`}>
              <Box sx={{ height: 34, borderRadius: 1, background: color, border: `1px solid ${palette.muted}33` }} />
              <Typography sx={{ color: palette.muted, fontSize: '0.52rem', mt: 0.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {labels[index]}
              </Typography>
            </Box>
          ))}
        </Box>

        <Paper elevation={0} sx={{ background: palette.panel, border: `1px solid ${palette.muted}24`, borderRadius: 1.5, p: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1, background: `${palette.primary}20`, display: 'grid', placeItems: 'center' }}>
                <ShieldIcon sx={{ color: palette.primary, fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ color: palette.text, fontSize: '0.82rem', fontWeight: 850 }}>
                  National Intelligence
                </Typography>
                <Typography sx={{ color: palette.muted, fontSize: '0.62rem' }}>
                  Analyst workspace
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, color: palette.success }}>
              <CheckCircleIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 850 }}>Live</Typography>
            </Box>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ background: heroPanelBg, border: `1px solid ${palette.muted}24`, borderRadius: 1.5, p: 1.5 }}>
          <Typography sx={{ color: heroText, fontSize: '1.15rem', fontWeight: 950, lineHeight: 1.15 }}>
            Political command center
          </Typography>
          <Typography sx={{ color: heroMuted, fontSize: '0.72rem', lineHeight: 1.55, mt: 0.7 }}>
            Track constituencies, media movement, strategy risk, and district-level signals.
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.9, mt: 1.4 }}>
            <Button
              size="small"
              variant="contained"
              sx={{
                background: palette.primary,
                color: primaryButtonText,
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 900,
                borderRadius: 1,
                '&:hover': { background: palette.primary },
              }}
            >
              Open Map
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SearchIcon sx={{ fontSize: 15 }} />}
              sx={{
                color: heroText,
                borderColor: `${palette.muted}44`,
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: 1,
              }}
            >
              Ask AI
            </Button>
          </Box>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {[
            ['High-risk seats', '38', palette.warning],
            ['Media alerts', '12', palette.secondary],
          ].map(([label, value, color]) => (
            <Paper key={label} elevation={0} sx={{ background: palette.panel, border: `1px solid ${palette.muted}20`, borderRadius: 1.5, p: 1.25 }}>
              <Typography sx={{ color, fontSize: '1.2rem', fontWeight: 950 }}>
                {value}
              </Typography>
              <Typography sx={{ color: palette.muted, fontSize: '0.66rem', mt: 0.3 }}>
                {label}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Paper elevation={0} sx={{ background: palette.panel, border: `1px solid ${palette.muted}20`, borderRadius: 1.5, p: 1.25 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <WarningAmberIcon sx={{ color: palette.warning, fontSize: 18, mt: 0.1 }} />
            <Box>
              <Typography sx={{ color: palette.text, fontSize: '0.74rem', fontWeight: 850 }}>
                Media narrative rising
              </Typography>
              <Typography sx={{ color: palette.muted, fontSize: '0.66rem', lineHeight: 1.45, mt: 0.25 }}>
                Agriculture pricing mentions increased across eastern state coverage.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mt: 'auto', p: 2, borderTop: `1px solid ${palette.muted}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ color: palette.muted, fontSize: '0.68rem', lineHeight: 1.45 }}>
          {palette.bestFor}
        </Typography>
        <ArrowForwardIcon sx={{ color: palette.primary, fontSize: 18, flexShrink: 0 }} />
      </Box>
    </Paper>
  );
}

export default function PaletteLab() {
  return (
    <Box sx={{ maxWidth: 1480, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.96))',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 2,
          p: { xs: 2.2, md: 3 },
        }}
      >
        <Chip
          icon={<PaletteIcon />}
          label="Palette Lab"
          size="small"
          sx={{
            color: '#f97316',
            background: 'rgba(249,115,22,0.10)',
            border: '1px solid rgba(249,115,22,0.25)',
            fontWeight: 850,
            mb: 2,
          }}
        />
        <Typography sx={{ color: '#f8fafc', fontSize: { xs: '1.7rem', md: '2.35rem' }, fontWeight: 950, lineHeight: 1.08 }}>
          Choose the visual direction for the product.
        </Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.7, maxWidth: 760, mt: 1.3 }}>
          Dark, light, and hybrid production palettes, shown as mini product screens so you can compare brand feel, readability, and accent behavior.
        </Typography>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.8 }}>
        {PALETTES.map((palette) => (
          <PalettePreview key={palette.name} palette={palette} />
        ))}
      </Box>
    </Box>
  );
}
