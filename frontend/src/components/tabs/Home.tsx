import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import BallotIcon from '@mui/icons-material/Ballot';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FeedIcon from '@mui/icons-material/Feed';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import MapIcon from '@mui/icons-material/Map';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { SvgIconComponent } from '@mui/icons-material';
import type { TabId } from '../../types';

interface Props {
  onNavigate: (tab: TabId) => void;
}

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  trend: string;
  Icon: SvgIconComponent;
  tone: 'orange' | 'green' | 'blue' | 'violet';
}

interface ModuleCard {
  id: TabId;
  title: string;
  description: string;
  action: string;
  metric: string;
  preview: string[];
  Icon: SvgIconComponent;
  tone: 'orange' | 'green' | 'blue' | 'violet' | 'rose' | 'cyan' | 'amber';
}

const toneMap = {
  orange: { accent: '#f97316', soft: 'rgba(249,115,22,0.14)', line: 'rgba(249,115,22,0.42)' },
  green: { accent: '#22c55e', soft: 'rgba(34,197,94,0.13)', line: 'rgba(34,197,94,0.36)' },
  blue: { accent: '#38bdf8', soft: 'rgba(56,189,248,0.13)', line: 'rgba(56,189,248,0.36)' },
  violet: { accent: '#a78bfa', soft: 'rgba(167,139,250,0.14)', line: 'rgba(167,139,250,0.38)' },
  rose: { accent: '#fb7185', soft: 'rgba(251,113,133,0.14)', line: 'rgba(251,113,133,0.38)' },
  cyan: { accent: '#22d3ee', soft: 'rgba(34,211,238,0.13)', line: 'rgba(34,211,238,0.36)' },
  amber: { accent: '#f59e0b', soft: 'rgba(245,158,11,0.13)', line: 'rgba(245,158,11,0.36)' },
};

const STATS: StatCardProps[] = [
  {
    label: 'Constituencies tracked',
    value: '403',
    detail: 'Assembly seats mapped into live workflows',
    trend: '+12 signal changes',
    Icon: BallotIcon,
    tone: 'orange',
  },
  {
    label: 'District coverage',
    value: '75',
    detail: 'Political, demographic, and media layers',
    trend: 'Full UP grid',
    Icon: LocationCityIcon,
    tone: 'blue',
  },
  {
    label: 'Electorate base',
    value: '15.03 Cr',
    detail: 'Registered voters across UP regions',
    trend: 'Region ready',
    Icon: PeopleIcon,
    tone: 'violet',
  },
  {
    label: 'Regional theatres',
    value: '5',
    detail: 'West, Central, Awadh, Bundelkhand, Purvanchal',
    trend: 'Live filters',
    Icon: PublicIcon,
    tone: 'green',
  },
];

const MODULES: ModuleCard[] = [
  {
    id: 'map',
    title: 'District Map',
    description: 'Locate volatility, party strength, and demographic shifts by district.',
    action: 'Open Map',
    metric: '75 districts',
    preview: ['Heat layer ready', 'District drilldown', 'Leadership context'],
    Icon: MapIcon,
    tone: 'blue',
  },
  {
    id: 'dashboard',
    title: 'Command Center',
    description: 'Review the operational picture across governance and election signals.',
    action: 'Review Signals',
    metric: 'Live overview',
    preview: ['Scheme watch', 'Weather risk', 'Policy events'],
    Icon: DashboardIcon,
    tone: 'orange',
  },
  {
    id: 'booth',
    title: 'Constituency Explorer',
    description: 'Move from region to district, constituency, booth, and local issues.',
    action: 'Track Seat',
    metric: 'Booth depth',
    preview: ['Issue heatmaps', 'Candidate context', 'Voter profile'],
    Icon: AccountBalanceIcon,
    tone: 'violet',
  },
  {
    id: 'strategy',
    title: 'Strategy Builder',
    description: 'Stress-test campaign plans against sentiment and influence networks.',
    action: 'Build Strategy',
    metric: 'AI impact',
    preview: ['Support map', 'Resistance points', 'Influence graph'],
    Icon: AutoGraphIcon,
    tone: 'cyan',
  },
  {
    id: 'ai-search',
    title: 'AI Search',
    description: 'Ask natural-language questions across the political intelligence layer.',
    action: 'Ask AI',
    metric: 'Query ready',
    preview: ['Caste dynamics', 'Seat history', 'Governance record'],
    Icon: ManageSearchIcon,
    tone: 'amber',
  },
  {
    id: 'social',
    title: 'Media Monitor',
    description: 'Track headlines, social narratives, and broadcast movement by region.',
    action: 'Review Alerts',
    metric: 'News stream',
    preview: ['Narrative shifts', 'Topic spikes', 'Source mix'],
    Icon: FeedIcon,
    tone: 'green',
  },
  {
    id: 'election-watch',
    title: 'Election Watch',
    description: 'Inspect candidates, declarations, result context, and national races.',
    action: 'Open Watch',
    metric: 'Candidate intel',
    preview: ['Asset profile', 'Criminal records', 'Result tracking'],
    Icon: HowToVoteIcon,
    tone: 'rose',
  },
];

const TRENDING_DISTRICTS = [
  { name: 'Varanasi', signal: 'Media velocity', score: 82, tone: 'orange' as const },
  { name: 'Azamgarh', signal: 'Seat volatility', score: 74, tone: 'violet' as const },
  { name: 'Gorakhpur', signal: 'Governance interest', score: 68, tone: 'green' as const },
  { name: 'Lucknow', signal: 'Policy chatter', score: 63, tone: 'blue' as const },
];

const MEDIA_ALERTS = [
  { source: 'Regional press', title: 'Agriculture pricing narrative rising in eastern belt', level: 'High' },
  { source: 'Broadcast scan', title: 'Law and order mentions clustered around urban seats', level: 'Medium' },
  { source: 'Social signal', title: 'Youth employment query volume increased after rally coverage', level: 'Medium' },
];

const STRATEGY_SIGNALS = [
  'Bundelkhand water and irrigation messaging is outperforming generic welfare copy.',
  'Purvanchal seats show higher sensitivity to candidate reputation than statewide swing.',
  'Urban constituencies need separate media framing for law, jobs, and mobility issues.',
];

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
      <Typography sx={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 800 }}>
        {title}
      </Typography>
      {action && (
        <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>
          {action}
        </Typography>
      )}
    </Box>
  );
}

function StatCard({ label, value, detail, trend, Icon, tone }: StatCardProps) {
  const colors = toneMap[tone];

  return (
    <Paper
      elevation={0}
      sx={{
        background: 'rgba(15,23,42,0.86)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 2,
        p: 2,
        minHeight: 142,
        boxShadow: '0 16px 50px rgba(0,0,0,0.20)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 1.5, background: colors.soft, display: 'grid', placeItems: 'center' }}>
          <Icon sx={{ color: colors.accent, fontSize: 20 }} />
        </Box>
        <Chip
          label={trend}
          size="small"
          sx={{
            height: 24,
            color: colors.accent,
            background: 'rgba(2,6,23,0.42)',
            border: `1px solid ${colors.line}`,
            fontSize: '0.66rem',
            fontWeight: 800,
          }}
        />
      </Box>
      <Typography sx={{ color: '#f8fafc', fontSize: '1.55rem', fontWeight: 900, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 750, mt: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#64748b', fontSize: '0.72rem', lineHeight: 1.5, mt: 0.7 }}>
        {detail}
      </Typography>
    </Paper>
  );
}

function ModuleCard({ module, onNavigate }: { module: ModuleCard; onNavigate: (tab: TabId) => void }) {
  const colors = toneMap[module.tone];

  return (
    <Paper
      elevation={0}
      onClick={() => onNavigate(module.id)}
      sx={{
        background: 'rgba(15,23,42,0.82)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 2,
        p: 2,
        minHeight: 260,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: colors.line,
          background: 'rgba(15,23,42,0.96)',
          '& .module-action': { color: '#f8fafc' },
          '& .module-arrow': { transform: 'translateX(4px)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ width: 42, height: 42, borderRadius: 1.5, background: colors.soft, display: 'grid', placeItems: 'center' }}>
          <module.Icon sx={{ color: colors.accent, fontSize: 22 }} />
        </Box>
        <Typography sx={{ color: colors.accent, fontSize: '0.68rem', fontWeight: 850, textTransform: 'uppercase' }}>
          {module.metric}
        </Typography>
      </Box>

      <Typography sx={{ color: '#f8fafc', fontWeight: 850, fontSize: '1rem', mt: 2 }}>
        {module.title}
      </Typography>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.55, mt: 0.75 }}>
        {module.description}
      </Typography>

      <Box sx={{ my: 2, p: 1.25, borderRadius: 1.5, background: 'rgba(2,6,23,0.40)', border: '1px solid rgba(148,163,184,0.10)' }}>
        {module.preview.map((item, index) => (
          <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.55 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: index === 0 ? colors.accent : 'rgba(148,163,184,0.45)' }} />
            <Typography sx={{ color: index === 0 ? '#cbd5e1' : '#64748b', fontSize: '0.72rem', fontWeight: index === 0 ? 750 : 600 }}>
              {item}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography className="module-action" sx={{ color: colors.accent, fontSize: '0.76rem', fontWeight: 850 }}>
          {module.action}
        </Typography>
        <ArrowForwardIcon className="module-arrow" sx={{ color: colors.accent, fontSize: 17, transition: 'transform 0.18s ease' }} />
      </Box>
    </Paper>
  );
}

export default function Home({ onNavigate }: Props) {
  return (
    <Box sx={{ maxWidth: 1480, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.98) 48%, rgba(30,41,59,0.96) 100%)',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 2,
          p: { xs: 2.2, md: 3 },
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)' }, gap: 3 }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip icon={<ShieldIcon />} label="UP political intelligence" size="small" sx={{ color: '#e2e8f0', background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.18)', fontWeight: 800 }} />
              <Chip icon={<NotificationsActiveIcon />} label="Live monitoring" size="small" sx={{ color: '#f97316', background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.25)', fontWeight: 800 }} />
            </Stack>

            <Typography sx={{ color: '#f8fafc', fontSize: { xs: '1.85rem', md: '2.65rem' }, fontWeight: 950, lineHeight: 1.05, maxWidth: 760 }}>
              Political intelligence command center for Uttar Pradesh.
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: { xs: '0.92rem', md: '1rem' }, lineHeight: 1.7, maxWidth: 700, mt: 1.6 }}>
              Track seats, surface risk signals, search institutional memory, and move from statewide context to booth-level action without leaving the analyst workspace.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<MapIcon />}
                onClick={() => onNavigate('map')}
                sx={{
                  background: '#f97316',
                  color: '#111827',
                  fontWeight: 900,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  px: 2,
                  '&:hover': { background: '#fb923c' },
                }}
              >
                Open District Map
              </Button>
              <Button
                variant="outlined"
                startIcon={<SearchIcon />}
                onClick={() => onNavigate('ai-search')}
                sx={{
                  color: '#e2e8f0',
                  borderColor: 'rgba(148,163,184,0.25)',
                  fontWeight: 850,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  px: 2,
                  '&:hover': { borderColor: 'rgba(249,115,22,0.65)', background: 'rgba(249,115,22,0.08)' },
                }}
              >
                Ask Intelligence
              </Button>
            </Box>
          </Box>

          <Paper
            elevation={0}
            sx={{
              background: 'rgba(2,6,23,0.58)',
              border: '1px solid rgba(148,163,184,0.16)',
              borderRadius: 2,
              p: 2,
              alignSelf: 'stretch',
            }}
          >
            <Typography sx={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 850, textTransform: 'uppercase', mb: 1 }}>
              Command search
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 1.5, px: 1.4, py: 1.2 }}>
              <SearchIcon sx={{ color: '#64748b', fontSize: 19 }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.4 }}>
                Show vulnerable seats in eastern UP
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.4 }}>
              {['Compare BJP vs SP booths', 'Track media spike', 'Find swing districts', 'Build rally brief'].map((query) => (
                <Box key={query} sx={{ background: 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.10)', borderRadius: 1.25, px: 1.2, py: 1 }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>
                    {query}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.6 }}>
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.2fr 0.8fr' }, gap: 1.8 }}>
        <Paper elevation={0} sx={{ background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, p: 2 }}>
          <SectionHeader title="Trending Districts" action="Last 24 hours" />
          <Box sx={{ display: 'grid', gap: 1.15 }}>
            {TRENDING_DISTRICTS.map((district) => {
              const colors = toneMap[district.tone];
              return (
                <Box key={district.name} sx={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.8fr) minmax(120px, 1fr) 80px', gap: 1.5, alignItems: 'center', p: 1.2, borderRadius: 1.5, background: 'rgba(2,6,23,0.38)', border: '1px solid rgba(148,163,184,0.09)' }}>
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 850 }}>{district.name}</Typography>
                  <Box>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', mb: 0.55 }}>{district.signal}</Typography>
                    <LinearProgress variant="determinate" value={district.score} sx={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.13)', '& .MuiLinearProgress-bar': { backgroundColor: colors.accent, borderRadius: 99 } }} />
                  </Box>
                  <Typography sx={{ color: colors.accent, fontSize: '0.78rem', fontWeight: 900, textAlign: 'right' }}>{district.score}</Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, p: 2 }}>
          <SectionHeader title="Latest Media Alerts" action="3 active" />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {MEDIA_ALERTS.map((alert) => (
              <Box key={alert.title} sx={{ display: 'flex', gap: 1.2, p: 1.2, borderRadius: 1.5, background: 'rgba(2,6,23,0.38)', border: '1px solid rgba(148,163,184,0.09)' }}>
                <WarningAmberIcon sx={{ color: alert.level === 'High' ? '#f97316' : '#f59e0b', fontSize: 18, mt: 0.15 }} />
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, textTransform: 'uppercase' }}>{alert.source}</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.25 }}>{alert.title}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '0.8fr 1.2fr' }, gap: 1.8 }}>
        <Paper elevation={0} sx={{ background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, p: 2 }}>
          <SectionHeader title="Strategy Signals" action="Recommended actions" />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {STRATEGY_SIGNALS.map((signal, index) => (
              <Box key={signal} sx={{ display: 'flex', gap: 1.1, p: 1.15, borderRadius: 1.5, background: 'rgba(2,6,23,0.38)', border: '1px solid rgba(148,163,184,0.09)' }}>
                <Box sx={{ width: 24, height: 24, borderRadius: 1, background: index === 0 ? toneMap.orange.soft : 'rgba(148,163,184,0.10)', color: index === 0 ? toneMap.orange.accent : '#94a3b8', display: 'grid', placeItems: 'center', fontSize: '0.72rem', fontWeight: 950 }}>
                  {index + 1}
                </Box>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.76rem', lineHeight: 1.55 }}>{signal}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Box>
          <SectionHeader title="Product Workflows" action="Choose a next move" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.6 }}>
            {MODULES.map((module) => (
              <ModuleCard key={module.id} module={module} onNavigate={onNavigate} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
