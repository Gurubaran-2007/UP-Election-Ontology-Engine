import { Box, Typography, Tooltip } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import FeedIcon from '@mui/icons-material/Feed';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import type { SvgIconComponent } from '@mui/icons-material';
import type { TabId } from '../../types';

interface NavItem {
  id: TabId;
  label: string;
  sublabel: string;
  Icon: SvgIconComponent;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'map',            label: 'District Map',     sublabel: '75 districts',        Icon: MapIcon },
  { id: 'dashboard',      label: 'Command Center',   sublabel: 'Live overview',       Icon: DashboardIcon },
  { id: 'booth',          label: 'Constituency',     sublabel: 'Booth drill-down',    Icon: AccountBalanceIcon },
  { id: 'strategy',       label: 'Strategy Builder', sublabel: 'AI impact analysis',  Icon: AutoGraphIcon },
  { id: 'ai-search',      label: 'AI Search',        sublabel: 'Sarvam intelligence', Icon: ManageSearchIcon },
  { id: 'social',         label: 'Media Monitor',    sublabel: 'News & trends',       Icon: FeedIcon },
  { id: 'election-watch', label: 'Election Watch',   sublabel: 'National results',    Icon: HowToVoteIcon },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
  serverOnline: boolean;
  dbOnline: boolean;
  aiOnline: boolean;
}

export default function Sidebar({ active, onChange, serverOnline, dbOnline }: Props) {
  return (
    <Box sx={{
      width: 220,
      minWidth: 220,
      height: '100%',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Section label */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography sx={{ color: '#334155', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Navigation
        </Typography>
      </Box>

      {/* Nav Items */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <Box
              key={item.id}
              onClick={() => onChange(item.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                mb: 0.5,
                borderRadius: '8px',
                cursor: 'pointer',
                background: isActive ? 'rgba(232,71,28,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(232,71,28,0.2)' : '1px solid transparent',
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: isActive ? 'rgba(232,71,28,0.14)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid rgba(232,71,28,0.2)' : '1px solid rgba(255,255,255,0.06)',
                },
              }}
            >
              <Box sx={{
                width: 34, height: 34, borderRadius: '8px',
                background: isActive ? 'rgba(232,71,28,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.18s',
              }}>
                <item.Icon sx={{ fontSize: 17, color: isActive ? '#E8471C' : '#475569' }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                  color: isActive ? '#f1f5f9' : '#94a3b8',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem', lineHeight: 1.2, whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </Typography>
                <Typography sx={{ color: isActive ? '#E8471C' : '#334155', fontSize: '0.62rem', lineHeight: 1 }}>
                  {item.sublabel}
                </Typography>
              </Box>
              {isActive && (
                <Box sx={{ ml: 'auto', width: 3, height: 20, borderRadius: 4, background: '#E8471C', flexShrink: 0 }} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography sx={{ color: '#1e293b', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', mb: 1 }}>
          System Status
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, mb: 1.5 }}>
          {[
            { label: 'API Server', online: serverOnline },
            { label: 'Neo4j DB',   online: dbOnline },
          ].map((s) => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#334155', fontSize: '0.68rem' }}>{s.label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box className={s.online ? 'pulse-dot' : ''} sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: s.online ? '#22c55e' : '#ef4444',
                  boxShadow: s.online ? '0 0 6px #22c55e88' : 'none',
                }} />
                <Typography sx={{ color: s.online ? '#22c55e' : '#ef4444', fontSize: '0.62rem', fontWeight: 600 }}>
                  {s.online ? 'Live' : 'Offline'}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Tooltip title="UP Political Ontology Engine — MVP v1.0">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <Typography sx={{ color: '#1e293b', fontSize: '0.65rem' }}>v1.0 MVP</Typography>
            <Box sx={{ display: 'flex', gap: '3px' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9933' }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#138808' }} />
            </Box>
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}
