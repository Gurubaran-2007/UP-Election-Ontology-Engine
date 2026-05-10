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
  orange: { accent: '#f97316', soft: 'rgba(249,115,22,0.12)', line: 'rgba(249,115,22,0.32)' },
  green: { accent: '#16a34a', soft: 'rgba(22,163,74,0.10)', line: 'rgba(22,163,74,0.28)' },
  blue: { accent: '#1d4ed8', soft: 'rgba(29,78,216,0.10)', line: 'rgba(29,78,216,0.28)' },
  violet: { accent: '#7c3aed', soft: 'rgba(124,58,237,0.10)', line: 'rgba(124,58,237,0.28)' },
  rose: { accent: '#e11d48', soft: 'rgba(225,29,72,0.10)', line: 'rgba(225,29,72,0.28)' },
  cyan: { accent: '#0891b2', soft: 'rgba(8,145,178,0.10)', line: 'rgba(8,145,178,0.28)' },
  amber: { accent: '#ca8a04', soft: 'rgba(202,138,4,0.10)', line: 'rgba(202,138,4,0.28)' },
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
    trend: 'State grid live',
    Icon: LocationCityIcon,
    tone: 'blue',
  },
  {
    label: 'Electorate base',
    value: '15.03 Cr',
    detail: 'Registered voters across configured states',
    trend: 'Region ready',
    Icon: PeopleIcon,
    tone: 'violet',
  },
  {
    label: 'Political regions',
    value: '5',
    detail: 'Configured regional clusters for the active state',
    trend: 'Live filters',
    Icon: PublicIcon,
    tone: 'green',
  },
];

const MODULES: ModuleCard[] = [
  {
    id: 'map',
    title: 'National Map',
    description: 'Locate volatility, party strength, and demographic shifts by state and district.',
    action: 'Open Map',
    metric: '75 districts',
    preview: ['Heat layer ready', 'District drilldown', 'Leadership context'],
    Icon: MapIcon,
    tone: 'blue',
  },
  {
    id: 'booth',
    title: 'Constituency Command',
    description: 'Combine statewide signals with constituency, booth, and local issue drilldowns.',
    action: 'Open Workflow',
    metric: 'Merged center',
    preview: ['Scheme watch', 'Weather risk', 'Booth drilldown'],
    Icon: AccountBalanceIcon,
    tone: 'orange',
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
  { name: 'Patna', signal: 'Policy chatter', score: 63, tone: 'blue' as const },
];

const MEDIA_ALERTS = [
  { source: 'Regional press', title: 'Agriculture pricing narrative rising across rural belts', level: 'High' },
  { source: 'Broadcast scan', title: 'Law and order mentions clustered around urban seats', level: 'Medium' },
  { source: 'Social signal', title: 'Youth employment query volume increased after rally coverage', level: 'Medium' },
];

const STRATEGY_SIGNALS = [
  'Water and irrigation messaging is outperforming generic welfare copy in drought-prone clusters.',
  'High-density seats show higher sensitivity to candidate reputation than statewide swing.',
  'Urban constituencies need separate media framing for law, jobs, and mobility issues.',
];

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
      <Typography sx={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 850 }}>
        {title}
      </Typography>
      {action && (
        <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 750 }}>
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
        backgroundColor: '#ffffff',
        border: '1px solid #d8e0ea',
        borderRadius: 2,
        p: 2,
        minHeight: 142,
        boxShadow: '0 14px 34px rgba(15,23,42,0.08)',
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
            background: colors.soft,
            border: `1px solid ${colors.line}`,
            fontSize: '0.66rem',
            fontWeight: 800,
          }}
        />
      </Box>
      <Typography sx={{ color: '#0f172a', fontSize: '1.55rem', fontWeight: 900, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: '#334155', fontSize: '0.78rem', fontWeight: 750, mt: 1 }}>
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
        background: '#ffffff',
        border: '1px solid #d8e0ea',
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
          background: '#fbfdff',
          boxShadow: '0 16px 38px rgba(15,23,42,0.10)',
          '& .module-action': { color: colors.accent },
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

      <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: '1rem', mt: 2 }}>
        {module.title}
      </Typography>
      <Typography sx={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.55, mt: 0.75 }}>
        {module.description}
      </Typography>

      <Box sx={{ my: 2, p: 1.25, borderRadius: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        {module.preview.map((item, index) => (
          <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.55 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: index === 0 ? colors.accent : '#cbd5e1' }} />
            <Typography sx={{ color: index === 0 ? '#334155' : '#64748b', fontSize: '0.72rem', fontWeight: index === 0 ? 750 : 600 }}>
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
          background: 'linear-gradient(135deg, #0B1220 0%, #111C33 54%, #1D4ED8 160%)',
          border: '1px solid rgba(148,163,184,0.22)',
          borderRadius: 2,
          p: { xs: 2.2, md: 3 },
          boxShadow: '0 22px 58px rgba(15,23,42,0.22)',
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
              <Chip icon={<ShieldIcon />} label="National political intelligence" size="small" sx={{ color: '#e2e8f0', background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.22)', fontWeight: 800 }} />
              <Chip icon={<NotificationsActiveIcon />} label="Live monitoring" size="small" sx={{ color: '#fed7aa', background: 'rgba(249,115,22,0.16)', border: '1px solid rgba(249,115,22,0.35)', fontWeight: 800 }} />
            </Stack>

            <Typography sx={{ color: '#f8fafc', fontSize: { xs: '1.85rem', md: '2.65rem' }, fontWeight: 950, lineHeight: 1.05, maxWidth: 760 }}>
              National political intelligence ontology.
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
                  color: '#ffffff',
                  fontWeight: 900,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  px: 2,
                  '&:hover': { background: '#fb923c' },
                }}
              >
                Open National Map
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
              border: '1px solid rgba(148,163,184,0.20)',
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
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.4 }}>
                Show vulnerable seats in eastern India
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
        <Paper elevation={0} sx={{ background: '#ffffff', border: '1px solid #d8e0ea', borderRadius: 2, p: 2, boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
          <SectionHeader title="Trending Districts" action="Last 24 hours" />
          <Box sx={{ display: 'grid', gap: 1.15 }}>
            {TRENDING_DISTRICTS.map((district) => {
              const colors = toneMap[district.tone];
              return (
                <Box key={district.name} sx={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.8fr) minmax(120px, 1fr) 80px', gap: 1.5, alignItems: 'center', p: 1.2, borderRadius: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ color: '#0f172a', fontSize: '0.82rem', fontWeight: 850 }}>{district.name}</Typography>
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.7rem', mb: 0.55 }}>{district.signal}</Typography>
                    <LinearProgress variant="determinate" value={district.score} sx={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.13)', '& .MuiLinearProgress-bar': { backgroundColor: colors.accent, borderRadius: 99 } }} />
                  </Box>
                  <Typography sx={{ color: colors.accent, fontSize: '0.78rem', fontWeight: 900, textAlign: 'right' }}>{district.score}</Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ background: '#ffffff', border: '1px solid #d8e0ea', borderRadius: 2, p: 2, boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
          <SectionHeader title="Latest Media Alerts" action="3 active" />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {MEDIA_ALERTS.map((alert) => (
              <Box key={alert.title} sx={{ display: 'flex', gap: 1.2, p: 1.2, borderRadius: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <WarningAmberIcon sx={{ color: alert.level === 'High' ? '#f97316' : '#f59e0b', fontSize: 18, mt: 0.15 }} />
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 850, textTransform: 'uppercase' }}>{alert.source}</Typography>
                  <Typography sx={{ color: '#334155', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.25 }}>{alert.title}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '0.8fr 1.2fr' }, gap: 1.8 }}>
        <Paper elevation={0} sx={{ background: '#ffffff', border: '1px solid #d8e0ea', borderRadius: 2, p: 2, boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
          <SectionHeader title="Strategy Signals" action="Recommended actions" />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {STRATEGY_SIGNALS.map((signal, index) => (
              <Box key={signal} sx={{ display: 'flex', gap: 1.1, p: 1.15, borderRadius: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Box sx={{ width: 24, height: 24, borderRadius: 1, background: index === 0 ? toneMap.orange.soft : '#e2e8f0', color: index === 0 ? toneMap.orange.accent : '#64748b', display: 'grid', placeItems: 'center', fontSize: '0.72rem', fontWeight: 950 }}>
                  {index + 1}
                </Box>
                <Typography sx={{ color: '#334155', fontSize: '0.76rem', lineHeight: 1.55 }}>{signal}</Typography>
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
