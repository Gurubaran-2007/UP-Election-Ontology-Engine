import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import MapIcon from '@mui/icons-material/Map';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import FeedIcon from '@mui/icons-material/Feed';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import PaletteIcon from '@mui/icons-material/Palette';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { SvgIconComponent } from '@mui/icons-material';
import type { TabId } from '../../types';

import Home            from '../tabs/Home';
import DistrictMap       from '../tabs/DistrictMap';
import ConstituencyBooth from '../tabs/ConstituencyBooth';
import StrategyBuilder   from '../tabs/StrategyBuilder';
import AISearch          from '../tabs/AISearch';
import SocialMedia       from '../tabs/SocialMedia';
import ElectionWatch     from '../tabs/ElectionWatch';
import PaletteLab        from '../tabs/PaletteLab';

interface NavItem { id: TabId; label: string; Icon: SvgIconComponent }

const NAV_ITEMS: NavItem[] = [
  { id: 'home',           label: 'Home',             Icon: HomeIcon },
  { id: 'map',            label: 'District Map',     Icon: MapIcon },
  { id: 'booth',          label: 'Constituency',     Icon: AccountBalanceIcon },
  { id: 'strategy',       label: 'Strategy Builder', Icon: AutoGraphIcon },
  { id: 'ai-search',      label: 'AI Search',        Icon: ManageSearchIcon },
  { id: 'social',         label: 'Media Monitor',    Icon: FeedIcon },
  { id: 'election-watch', label: 'Election Watch',   Icon: HowToVoteIcon },
  { id: 'palette-lab',    label: 'Palette Lab',      Icon: PaletteIcon },
];

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums', letterSpacing: 1, lineHeight: 1.2 }}>
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </Typography>
      <Typography sx={{ color: '#475569', fontSize: '0.62rem', letterSpacing: 0.3 }}>
        {time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      </Typography>
    </Box>
  );
}

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  const renderTab = () => {
    switch (activeTab) {
      case 'home':           return <Home onNavigate={setActiveTab} />;
      case 'map':            return <DistrictMap />;
      case 'booth':          return <ConstituencyBooth />;
      case 'strategy':       return <StrategyBuilder />;
      case 'ai-search':      return <AISearch />;
      case 'social':         return <SocialMedia />;
      case 'election-watch': return <ElectionWatch />;
      case 'palette-lab':    return <PaletteLab />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0B1220' }}>

      {/* ── ROW 1: Brand bar ── */}
      <Box sx={{
        height: 58,
        minHeight: 58,
        background: '#0B1220',
        display: 'flex',
        alignItems: 'center',
        px: { xs: 1.5, md: 3 },
        gap: 2,
        zIndex: 300,
        borderBottom: '1px solid rgba(148,163,184,0.16)',
      }}>
        {/* Tricolor + brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            <Box sx={{ width: 4, height: 11, background: '#FF9933', borderRadius: '2px 2px 0 0' }} />
            <Box sx={{ width: 4, height: 11, background: '#ffffff' }} />
            <Box sx={{ width: 4, height: 11, background: '#138808', borderRadius: '0 0 2px 2px' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#f1f5f9', fontWeight: 900, fontSize: '0.78rem', letterSpacing: 1.8, textTransform: 'uppercase', lineHeight: 1 }}>
              UP Ontology Engine
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.56rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Intelligence workspace
            </Typography>
          </Box>
        </Box>

        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          flex: 1,
          maxWidth: 560,
          mx: 'auto',
          px: 1.4,
          py: 0.85,
          borderRadius: 1.5,
          background: 'rgba(15,23,42,0.88)',
          border: '1px solid rgba(148,163,184,0.18)',
        }}>
          <SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
          <Typography sx={{ color: '#CBD5E1', fontSize: '0.76rem', fontWeight: 600 }}>
            Search seats, districts, alerts, strategies...
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{
            display: { xs: 'none', lg: 'flex' },
            alignItems: 'center',
            gap: 0.75,
            px: 1.2,
            py: 0.7,
            borderRadius: 1.5,
            background: 'rgba(34,197,94,0.10)',
            border: '1px solid rgba(34,197,94,0.18)',
          }}>
            <VerifiedIcon sx={{ color: '#22c55e', fontSize: 15 }} />
            <Typography sx={{ color: '#86efac', fontSize: '0.68rem', fontWeight: 800 }}>
              Systems live
            </Typography>
          </Box>
          <Box sx={{
            width: 34,
            height: 34,
            display: { xs: 'none', md: 'grid' },
            placeItems: 'center',
            borderRadius: 1.5,
            background: 'rgba(15,23,42,0.88)',
            border: '1px solid rgba(148,163,184,0.18)',
          }}>
            <NotificationsNoneIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
          </Box>
        <Clock />
        </Box>
      </Box>

      {/* ── ROW 2: Navigation bar ── */}
      <Box sx={{
        height: 46,
        minHeight: 46,
        background: '#0B1220',
        display: 'flex',
        alignItems: 'stretch',
        px: 2,
        gap: 0.5,
        borderBottom: '1px solid rgba(148,163,184,0.16)',
        zIndex: 200,
        boxShadow: '0 12px 32px rgba(15,23,42,0.24)',
        overflowX: 'auto',
      }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <Box
              key={id}
              onClick={() => setActiveTab(id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.75,
                cursor: 'pointer',
                position: 'relative',
                borderRadius: '6px 6px 0 0',
                background: isActive ? 'rgba(29,78,216,0.20)' : 'transparent',
                transition: 'background 0.18s',
                '&:hover': {
                  background: isActive ? 'rgba(29,78,216,0.24)' : 'rgba(255,255,255,0.05)',
                },
                // Active bottom accent line
                '&::after': isActive ? {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, #1D4ED8, #F97316)',
                  borderRadius: '2px 2px 0 0',
                } : {},
              }}
            >
              <Icon sx={{ fontSize: 15, color: isActive ? '#60A5FA' : '#94A3B8', flexShrink: 0 }} />
              <Typography sx={{
                fontSize: '0.76rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#f8fafc' : '#CBD5E1',
                whiteSpace: 'nowrap',
                letterSpacing: isActive ? 0.2 : 0,
              }}>
                {label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── CONTENT ── */}
      <Box
        key={activeTab}
        className="fade-in"
        sx={{
          flex: 1,
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #F8FAFC 0%, var(--bg) 42%, #E2E8F0 100%)',
          p: { xs: 1.5, md: 2.5 },
        }}
      >
        {renderTab()}
      </Box>
    </Box>
  );
}
