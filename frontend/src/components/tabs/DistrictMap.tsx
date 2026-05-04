import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Paper, Chip, IconButton, InputBase } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import * as d3 from 'd3';
import {
  getIndiaGeo, getStateDistrictGeo, getDistrictData,
  getIndiaLS2024Summary, getUPDistrictResults,
} from '../../api';
import type { DistrictData, MapSelection } from '../../types';
import { CONFIGURED_STATES } from '../../types';

// ── Party palette ─────────────────────────────────────────────────────────────
const PARTY_COLORS: Record<string, string> = {
  bjp: '#f97316', sp: '#e11d48', inc: '#2563eb', bsp: '#7c3aed',
  rld: '#10b981', tmc: '#0ea5e9', dmk: '#f43f5e', tdp: '#eab308',
  jdu: '#22c55e', adal: '#fb923c', ss: '#f59e0b', ss_ub: '#a78bfa',
  ysrcp: '#06b6d4', bjd: '#84cc16', aap: '#818cf8', ncp: '#92400e',
  jmm: '#34d399', cpim: '#dc2626', other: '#475569',
};
const PARTY_LABELS: Record<string, string> = {
  bjp: 'BJP', sp: 'SP', inc: 'INC', bsp: 'BSP', rld: 'RLD',
  tmc: 'TMC', dmk: 'DMK', tdp: 'TDP', jdu: 'JDU', adal: 'ADal',
  ss: 'SS', ss_ub: 'SS(UB)', ysrcp: 'YSRCP', bjd: 'BJD', aap: 'AAP',
  ncp: 'NCP', jmm: 'JMM', cpim: 'CPI-M', other: 'Other',
};

// ── Region colours ────────────────────────────────────────────────────────────
const STATE_REGIONS: Record<string, { color: string; districts: string[] }> = {
  'Western':    { color: '#fef08a', districts: ['Saharanpur','Muzaffarnagar','Shamli','Baghpat','Meerut','Ghaziabad','Hapur','Gautam Buddha Nagar','Bulandshahr','Aligarh','Hathras','Mathura','Agra','Firozabad','Etah','Kasganj','Mainpuri','Etawah','Auraiya','Kannauj','Farrukhabad'] },
  'Northwest':  { color: '#bfdbfe', districts: ['Bijnor','Amroha','Moradabad','Rampur','Sambhal','Budaun','Bareilly','Pilibhit','Shahjahanpur'] },
  'Governance': { color: '#e9d5ff', districts: ['Kheri','Sitapur','Hardoi','Unnao','Lucknow','Rae Bareli','Barabanki','Ayodhya','Amethi','Sultanpur','Ambedkar Nagar','Gonda','Bahraich','Shravasti','Balrampur','Fatehpur'] },
  'Dryland':    { color: '#fecaca', districts: ['Jalaun','Jhansi','Lalitpur','Hamirpur','Mahoba','Banda','Chitrakoot'] },
  'Eastern':    { color: '#bbf7d0', districts: ['Siddharthnagar','Maharajganj','Kushinagar','Basti','Sant Kabir Nagar','Gorakhpur','Deoria','Azamgarh','Mau','Ballia','Jaunpur','Ghazipur','Varanasi','Mirzapur','Chandauli','Sonbhadra','Prayagraj','Kaushambi','Pratapgarh'] },
};

function getStateRegion(name: string) {
  for (const [region, { color, districts }] of Object.entries(STATE_REGIONS)) {
    if (districts.some(d => name.includes(d) || d.includes(name))) return { region, color };
  }
  return { region: 'Other', color: '#e2e8f0' };
}
function getStateDistrictColor(name: string) { return getStateRegion(name).color; }
function getIndiaStateColor(name: string) {
  return CONFIGURED_STATES[name] ? 'rgba(249,115,22,0.28)' : '#1e293b';
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ListItem { name: string; sub?: string; color?: string; configured?: boolean }
interface SeatStat { partyId: string; label: string; seats: number; color: string }

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ sel, onBack }: { sel: MapSelection; onBack: () => void }) {
  const crumbs = [{ label: '🇮🇳 India', active: sel.level === 'india' }];
  if (sel.stateName)    crumbs.push({ label: sel.stateName,    active: sel.level === 'state'    });
  if (sel.districtName) crumbs.push({ label: sel.districtName, active: sel.level === 'district' });
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {sel.level !== 'india' && (
        <IconButton size="small" onClick={onBack} sx={{ color: '#94a3b8', mr: 0.25 }}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
      {crumbs.map((c, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {i > 0 && <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>›</Typography>}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: c.active ? 800 : 500, color: c.active ? '#f1f5f9' : '#64748b' }}>
            {c.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Left list panel ───────────────────────────────────────────────────────────
function ListPanel({ items, selected, onSelect, placeholder }: {
  items: ListItem[]; selected?: string; onSelect: (n: string) => void; placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(it => it.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid rgba(148,163,184,0.12)', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 1.5, px: 1, py: 0.5 }}>
          <SearchIcon sx={{ color: '#475569', fontSize: 15, flexShrink: 0 }} />
          <InputBase value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder}
            sx={{ fontSize: '0.78rem', color: '#cbd5e1', flex: 1, '& input::placeholder': { color: '#475569' } }} />
          {query && <Typography onClick={() => setQuery('')} sx={{ color: '#475569', fontSize: '0.7rem', cursor: 'pointer', '&:hover': { color: '#94a3b8' } }}>✕</Typography>}
        </Box>
      </Box>
      <Box sx={{ px: 1.5, py: 0.6, flexShrink: 0 }}>
        <Typography sx={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 0.75, pb: 1 }}>
        {filtered.map(item => {
          const isSel = item.name === selected;
          return (
            <Box key={item.name} onClick={() => onSelect(item.name)} sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1, py: 0.85, borderRadius: 1.25, cursor: 'pointer', mb: 0.25,
              background: isSel ? 'rgba(249,115,22,0.18)' : 'transparent',
              border: isSel ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
              transition: 'background 0.15s',
              '&:hover': { background: isSel ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.05)' },
            }}>
              {item.color && <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: isSel ? 700 : 500, color: isSel ? '#f97316' : item.configured === false ? '#475569' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </Typography>
                {item.sub && <Typography sx={{ fontSize: '0.65rem', color: '#475569', mt: 0.1 }}>{item.sub}</Typography>}
              </Box>
              {item.configured && <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Shared seat-breakdown row ─────────────────────────────────────────────────
function SeatRow({ stat, total }: { stat: SeatStat; total: number }) {
  const pct = total > 0 ? (stat.seats / total) * 100 : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: stat.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>{stat.label}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>{stat.seats}</Typography>
      </Box>
      <Box sx={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, background: stat.color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </Box>
    </Box>
  );
}

// ── India metrics panel ───────────────────────────────────────────────────────
function IndiaMetricsPanel({ stats, total }: { stats: SeatStat[]; total: number }) {
  const majority = 272;
  const bjp = stats.find(s => s.partyId === 'bjp');
  const ndaSeats = stats.filter(s => ['bjp','jdu','tdp','adal','ss'].includes(s.partyId)).reduce((a, s) => a + s.seats, 0);
  const indiaSeats = stats.filter(s => ['inc','sp','tmc','dmk','ss_ub','jmm','aap'].includes(s.partyId)).reduce((a, s) => a + s.seats, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Title */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.12)', background: 'rgba(249,115,22,0.06)', flexShrink: 0 }}>
        <Typography fontWeight={800} fontSize="0.95rem" color="#f97316">India LS 2024</Typography>
        <Typography variant="caption" color="#64748b">{total} seats · Majority: {majority}</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* Alliance blocs */}
        <Box sx={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{ background: 'rgba(255,255,255,0.03)', px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569' }}>Alliance Blocs</Typography>
          </Box>
          <Box sx={{ p: 1.1, display: 'flex', gap: 1 }}>
            {[
              { label: 'NDA', seats: ndaSeats, color: '#f97316' },
              { label: 'I.N.D.I.A', seats: indiaSeats, color: '#2563eb' },
              { label: 'Others', seats: total - ndaSeats - indiaSeats, color: '#475569' },
            ].map(a => (
              <Box key={a.label} sx={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 1.25, p: 0.75, textAlign: 'center', border: `1px solid ${a.color}22` }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: a.color }}>{a.seats}</Typography>
                <Typography sx={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>{a.label}</Typography>
              </Box>
            ))}
          </Box>
          {/* Majority bar */}
          <Box sx={{ px: 1.1, pb: 1.1 }}>
            <Box sx={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)' }}>
              <Box sx={{ flex: ndaSeats, background: '#f97316' }} />
              <Box sx={{ flex: indiaSeats, background: '#2563eb' }} />
              <Box sx={{ flex: Math.max(0, total - ndaSeats - indiaSeats), background: '#334155' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.4 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#475569' }}>▲ majority at {majority}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Per-party breakdown */}
        <Box sx={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{ background: 'rgba(255,255,255,0.03)', px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569' }}>Party Breakdown</Typography>
          </Box>
          <Box sx={{ p: 1.1 }}>
            {stats.slice(0, 10).map(s => <SeatRow key={s.partyId} stat={s} total={total} />)}
          </Box>
        </Box>

        {/* Largest party */}
        {bjp && (
          <Box sx={{ border: '1px solid rgba(249,115,22,0.2)', borderRadius: 1.5, p: 1.1, background: 'rgba(249,115,22,0.05)' }}>
            <Typography sx={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.4 }}>Largest Party</Typography>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#f97316' }}>{bjp.seats}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>BJP · {((bjp.seats / total) * 100).toFixed(1)}% of seats</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── State metrics panel ───────────────────────────────────────────────────────
function StateMetricsPanel({ stats, total, stateName }: { stats: SeatStat[]; total: number; stateName?: string }) {
  const majority = Math.floor(total / 2) + 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.12)', background: 'rgba(249,115,22,0.06)', flexShrink: 0 }}>
        <Typography fontWeight={800} fontSize="0.95rem" color="#f97316">{stateName} LS 2024</Typography>
        <Typography variant="caption" color="#64748b">{total} seats · Majority: {majority}</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* Top-2 face-off */}
        {stats.length >= 2 && (
          <Box sx={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ background: 'rgba(255,255,255,0.03)', px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569' }}>Head to Head</Typography>
            </Box>
            <Box sx={{ p: 1.1, display: 'flex', gap: 1 }}>
              {stats.slice(0, 2).map(s => (
                <Box key={s.partyId} sx={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 1.25, p: 0.85, textAlign: 'center', border: `1px solid ${s.color}33` }}>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.seats}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>{s.label}</Typography>
                </Box>
              ))}
            </Box>
            {/* fill bar */}
            <Box sx={{ px: 1.1, pb: 1.1 }}>
              <Box sx={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)' }}>
                {stats.map(s => <Box key={s.partyId} sx={{ flex: s.seats, background: s.color }} />)}
              </Box>
            </Box>
          </Box>
        )}

        {/* Full breakdown */}
        <Box sx={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{ background: 'rgba(255,255,255,0.03)', px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569' }}>All Parties</Typography>
          </Box>
          <Box sx={{ p: 1.1 }}>
            {stats.map(s => <SeatRow key={s.partyId} stat={s} total={total} />)}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DistrictMap() {
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [sel, setSel]             = useState<MapSelection>({ level: 'india' });
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [distData, setDistData]   = useState<DistrictData | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [mapLoading, setMapLoading]     = useState(true);
  const [mapError, setMapError]         = useState('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null);

  // Metrics state (right panel)
  const [seatStats, setSeatStats] = useState<SeatStat[]>([]);
  const [seatTotal, setSeatTotal] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Refs
  const selRef      = useRef(sel); selRef.current = sel;
  const selectedRef = useRef<string | undefined>(undefined);
  const getFillRef  = useRef<((name: string) => string) | null>(null);
  const getNameRef  = useRef<((d: any) => string) | null>(null);
  // stored results for district panel
  const districtResultsRef = useRef<Record<string, any[]>>({});

  // ── Shared D3 draw ────────────────────────────────────────────────────────
  const renderMap = useCallback((
    geo: any, useIdentity: boolean,
    getFill: (name: string) => string,
    getName: (d: any) => string,
    onClick: (name: string) => void,
    isActive?: (name: string) => boolean,
  ) => {
    if (!svgRef.current || !containerRef.current) return;
    const W = containerRef.current.clientWidth  || 800;
    const H = containerRef.current.clientHeight || 620;

    getFillRef.current = getFill;
    getNameRef.current = getName;

    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${W} ${H}`).style('background', '#020617');
    svg.selectAll('*').remove();

    const g = svg.append('g');
    const proj = useIdentity
      ? (d3.geoIdentity() as any).reflectY(true).fitSize([W, H], geo)
      : d3.geoMercator().fitSize([W, H], geo);
    const path = d3.geoPath().projection(proj);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    g.selectAll('path')
      .data(geo.features)
      .enter().append('path')
      .attr('d', path as any)
      .attr('fill', (d: any) => getFill(getName(d)))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function (_: MouseEvent, d: any) {
        const name = getName(d);
        const active = isActive && isActive(name);
        if (!active) d3.select(this).attr('fill', '#fb923c').attr('stroke', '#f97316').attr('stroke-width', 1.2);
        const [mx, my] = d3.pointer(_, containerRef.current);
        setTooltip({ x: mx, y: my, name });
      })
      .on('mousemove', function (_: MouseEvent) {
        const [mx, my] = d3.pointer(_, containerRef.current);
        setTooltip(t => t ? { ...t, x: mx, y: my } : null);
      })
      .on('mouseout', function (_: MouseEvent, d: any) {
        const name = getName(d);
        const active = isActive && isActive(name);
        d3.select(this)
          .attr('fill',         active ? '#f97316' : getFill(name))
          .attr('stroke',       active ? '#ea580c' : '#0f172a')
          .attr('stroke-width', active ? 1.5       : 0.7);
        setTooltip(null);
      })
      .on('click', (_: MouseEvent, d: any) => onClick(getName(d)));

    g.selectAll('text')
      .data(geo.features)
      .enter().append('text')
      .attr('x', (d: any) => path.centroid(d)[0] || 0)
      .attr('y', (d: any) => path.centroid(d)[1] || 0)
      .attr('text-anchor', 'middle').attr('dy', '.35em')
      .style('pointer-events', 'none')
      .style('font-size', '0.5rem').style('font-weight', '700')
      .style('fill', (d: any) => isActive && isActive(getName(d)) ? '#fff' : '#334155')
      .style('paint-order', 'stroke').style('stroke', 'rgba(0,0,0,0.7)').style('stroke-width', '0.5px')
      .text((d: any) => {
        const n = getName(d);
        return n.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
      });
  }, []);

  // ── Solid-fill highlight ──────────────────────────────────────────────────
  const highlightOnMap = useCallback((name: string) => {
    if (!svgRef.current || !getNameRef.current || !getFillRef.current) return;
    const gn = getNameRef.current;
    const gf = getFillRef.current;
    d3.select(svgRef.current).selectAll('path')
      .attr('fill',         (d: any) => gn(d) === name ? '#f97316' : gf(gn(d)))
      .attr('stroke',       (d: any) => gn(d) === name ? '#ea580c' : '#0f172a')
      .attr('stroke-width', (d: any) => gn(d) === name ? 1.5 : 0.7);
  }, []);

  // ── Select a district ─────────────────────────────────────────────────────
  const selectDistrict = useCallback((districtName: string) => {
    selectedRef.current = districtName;
    setSel(s => ({ ...s, level: 'district', districtName }));
    setPanelLoading(true);
    setDistData(null);
    highlightOnMap(districtName);
    getDistrictData(districtName)
      .then(data => { setDistData(data); setPanelLoading(false); })
      .catch(() => setPanelLoading(false));
  }, [highlightOnMap]);

  // ── Load India ────────────────────────────────────────────────────────────
  const loadIndia = useCallback(() => {
    setMapLoading(true); setMapError(''); setDistData(null); setListItems([]);
    setMetricsLoading(true); setSeatStats([]); setSeatTotal(0);

    Promise.all([getIndiaGeo(), getIndiaLS2024Summary().catch(() => null)])
      .then(([geo, summary]) => {
        setMapLoading(false);

        if (summary?.national) {
          const nat: Record<string, number> = summary.national;
          const total = Object.values(nat).reduce((a, b) => a + b, 0);
          const stats: SeatStat[] = Object.entries(nat)
            .sort((a, b) => b[1] - a[1])
            .map(([pid, n]) => ({ partyId: pid, label: PARTY_LABELS[pid] ?? pid.toUpperCase(), seats: n, color: PARTY_COLORS[pid] ?? '#475569' }));
          setSeatStats(stats);
          setSeatTotal(total);
        }
        setMetricsLoading(false);

        const items: ListItem[] = geo.features.map((f: any) => {
          const name = f.properties.ST_NM || '';
          const cfg = CONFIGURED_STATES[name];
          return { name, color: cfg ? '#f97316' : '#334155', configured: !!cfg };
        }).sort((a: ListItem, b: ListItem) => {
          if (a.configured && !b.configured) return -1;
          if (!a.configured && b.configured) return 1;
          return a.name.localeCompare(b.name);
        });
        setListItems(items);

        renderMap(geo, false,
          name => getIndiaStateColor(name),
          (d: any) => d.properties.ST_NM || '',
          (name: string) => {
            const cfg = CONFIGURED_STATES[name];
            if (!cfg) { showComingSoon(name); return; }
            setSel({ level: 'state', stateCode: cfg.code, stateName: name });
          },
          name => !!CONFIGURED_STATES[name],
        );
      })
      .catch(e => { setMapLoading(false); setMetricsLoading(false); setMapError(e.message); });
  }, [renderMap]);

  // ── Load state districts ──────────────────────────────────────────────────
  const loadState = useCallback((stateCode: string) => {
    setMapLoading(true); setMapError(''); setDistData(null); setListItems([]);
    setMetricsLoading(true); setSeatStats([]); setSeatTotal(0);

    const resultsPromise = stateCode === 'UP'
      ? getUPDistrictResults().catch(() => null)
      : Promise.resolve(null);

    Promise.all([getStateDistrictGeo(stateCode), resultsPromise])
      .then(([geo, results]) => {
        setMapLoading(false);

        if (results?.data) {
          districtResultsRef.current = results.data;
          const seats: Record<string, number> = results.seats ?? {};
          const total = Object.values(seats).reduce((a, b) => a + b, 0);
          const stats: SeatStat[] = Object.entries(seats)
            .sort((a, b) => b[1] - a[1])
            .map(([pid, n]) => ({ partyId: pid, label: PARTY_LABELS[pid] ?? pid.toUpperCase(), seats: n, color: PARTY_COLORS[pid] ?? '#475569' }));
          setSeatStats(stats);
          setSeatTotal(total);
        }
        setMetricsLoading(false);

        const items: ListItem[] = geo.features.map((f: any) => {
          const name = f.properties.name || f.properties.DISTRICT || '';
          const { region, color } = stateCode === 'UP' ? getStateRegion(name) : { region: '', color: '#1e3a5f' };
          return { name, sub: region || undefined, color };
        }).sort((a: ListItem, b: ListItem) => a.name.localeCompare(b.name));
        setListItems(items);

        renderMap(geo, true,
          name => stateCode === 'UP' ? getStateDistrictColor(name) : '#1e3a5f',
          (d: any) => d.properties.name || d.properties.DISTRICT || '',
          (districtName: string) => selectDistrict(districtName),
          (name: string) => name === selectedRef.current,
        );
      })
      .catch(e => { setMapLoading(false); setMetricsLoading(false); setMapError(e.message); });
  }, [renderMap, selectDistrict]);

  // ── List item clicked ─────────────────────────────────────────────────────
  const handleListSelect = useCallback((name: string) => {
    if (sel.level === 'india') {
      const cfg = CONFIGURED_STATES[name];
      if (!cfg) { showComingSoon(name); return; }
      highlightOnMap(name);
      setSel({ level: 'state', stateCode: cfg.code, stateName: name });
    } else {
      selectDistrict(name);
    }
  }, [sel.level, selectDistrict, highlightOnMap]);

  // ── Back navigation ───────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    selectedRef.current = undefined;
    setSel(s => {
      if (s.level === 'district') return { ...s, level: 'state', districtName: undefined };
      return { level: 'india' };
    });
    setDistData(null);
  }, []);

  function showComingSoon(name: string) {
    const el = document.getElementById('map-coming-soon');
    if (el) { el.textContent = `${name} — data coming soon`; el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 2200); }
  }

  // ── React to level/state changes ──────────────────────────────────────────
  useEffect(() => {
    if (sel.level === 'india') loadIndia();
    else if (sel.level === 'state' && sel.stateCode) loadState(sel.stateCode);
  }, [sel.level, sel.stateCode]); // eslint-disable-line

  // ── Region legend ─────────────────────────────────────────────────────────
  const renderLegend = () => {
    if (sel.level === 'india') return (
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <LegendDot color="rgba(249,115,22,0.4)" label="Data available" />
        <LegendDot color="#1e293b" label="Coming soon" border />
      </Box>
    );
    if (sel.stateCode === 'UP') return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {Object.entries(STATE_REGIONS).map(([name, { color }]) => <LegendDot key={name} color={color} label={name} />)}
      </Box>
    );
    return null;
  };

  const listLabel       = sel.level === 'india' ? 'States' : `Districts — ${sel.stateName || ''}`;
  const listPlaceholder = sel.level === 'india' ? 'Search states...' : 'Search districts...';
  const selectedInList  = sel.level === 'district' ? sel.districtName : undefined;

  // ── Right panel content ───────────────────────────────────────────────────
  const renderRightPanel = () => {
    if (sel.level === 'district' && sel.districtName) {
      return (
        <>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.12)', background: 'rgba(249,115,22,0.07)', flexShrink: 0 }}>
            <Typography fontWeight={800} fontSize="1rem" color="#f97316">{sel.districtName}</Typography>
            <Typography variant="caption" color="#64748b">{sel.stateName}, India</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
            {panelLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 6, gap: 2 }}>
                <Box sx={{ width: 30, height: 30, border: '3px solid rgba(249,115,22,0.15)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <Typography color="text.secondary" fontSize="0.8rem">Fetching data...</Typography>
              </Box>
            ) : distData ? (
              <DistrictPanel data={distData} lsResults={districtResultsRef.current[sel.districtName] ?? []} />
            ) : (
              <Typography color="text.secondary" fontSize="0.82rem" sx={{ mt: 2 }}>No data available yet.</Typography>
            )}
          </Box>
        </>
      );
    }

    if (metricsLoading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
          <Box sx={{ width: 28, height: 28, border: '3px solid rgba(249,115,22,0.15)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>Loading metrics...</Typography>
        </Box>
      );
    }

    if (sel.level === 'india') {
      return <IndiaMetricsPanel stats={seatStats} total={seatTotal} />;
    }

    return <StateMetricsPanel stats={seatStats} total={seatTotal} stateName={sel.stateName} />;
  };

  return (
    <Box sx={{ height: 'calc(100vh - 104px)', display: 'flex', gap: 1.5 }}>

      {/* ── LEFT LIST PANEL ── */}
      <Paper elevation={0} sx={{ width: 220, minWidth: 220, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(148,163,184,0.12)', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            {listLabel}
          </Typography>
        </Box>
        <ListPanel items={listItems} selected={selectedInList} onSelect={handleListSelect} placeholder={listPlaceholder} />
      </Paper>

      {/* ── MAP PANEL ── */}
      <Paper elevation={0} sx={{ flex: 1, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        <Box sx={{ px: 2, py: 1.1, borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.92)', flexShrink: 0 }}>
          <Breadcrumb sel={sel} onBack={goBack} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {renderLegend()}
            <div id="map-coming-soon" style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700, opacity: 0, transition: 'opacity 0.3s', whiteSpace: 'nowrap' }} />
          </Box>
        </Box>

        <Box ref={containerRef} sx={{ flex: 1, position: 'relative' }}>
          {mapLoading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, background: '#020617', zIndex: 5 }}>
              <Box sx={{ width: 34, height: 34, border: '3px solid rgba(249,115,22,0.15)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                {sel.level === 'india' ? 'Loading India map...' : `Loading ${sel.stateName || 'state'} districts...`}
              </Typography>
            </Box>
          )}
          {mapError && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="error" fontSize="0.9rem">{mapError}</Typography>
            </Box>
          )}
          {tooltip && (
            <Box sx={{ position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 36, background: 'rgba(15,23,42,0.97)', color: '#f1f5f9', px: 1.5, py: 0.6, borderRadius: 1, border: '1px solid rgba(249,115,22,0.3)', fontSize: '0.78rem', fontWeight: 600, pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              {tooltip.name}
              {sel.level === 'india' && CONFIGURED_STATES[tooltip.name] && (
                <Typography component="span" sx={{ color: '#f97316', fontSize: '0.7rem', ml: 0.8 }}>click →</Typography>
              )}
            </Box>
          )}
          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: mapLoading || mapError ? 'none' : 'block' }} />
        </Box>
      </Paper>

      {/* ── RIGHT METRICS / DETAIL PANEL ── */}
      <Paper elevation={0} sx={{ width: 320, minWidth: 320, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        {renderRightPanel()}
      </Paper>

    </Box>
  );
}

// ── Legend dot ────────────────────────────────────────────────────────────────
function LegendDot({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, background: color, borderRadius: 0.4, border: border ? '1px solid #475569' : 'none', flexShrink: 0 }} />
      <Typography sx={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</Typography>
    </Box>
  );
}

// ── District detail panel ─────────────────────────────────────────────────────
function DistrictPanel({ data, lsResults }: { data: DistrictData; lsResults: any[] }) {
  const { leader, population, demographics, headlines, census } = data;
  const fmt = (v?: number | null) => v && v > 0 ? Number(v).toLocaleString('en-IN') : '—';
  const totalPop = population.total || ((population.rural || 0) + (population.urban || 0));

  // Prefer constituencies from new endpoint; fall back to lsResults from metrics endpoint
  const constituencies = data.constituencies && data.constituencies.length > 0
    ? data.constituencies
    : lsResults.map(r => ({
        ls_id: r.ls_id, ls_name: r.ls_name, election_id: r.election_id,
        winner: r.winner, party_id: r.party_id,
        vote_share: r.vote_share ? parseFloat(r.vote_share) : null,
        margin_pct: r.margin_pct ? parseFloat(r.margin_pct) : null,
      }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>

      {/* LS Election Results from graph */}
      {constituencies.length > 0 && (
        <SectionCard title="Election Results" icon="🗳️">
          {constituencies.map((seg: any) => (
            <Box key={seg.ls_id} sx={{ mb: 1.25, pb: 1.25, borderBottom: '1px solid rgba(148,163,184,0.08)', '&:last-child': { mb: 0, pb: 0, border: 'none' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>{seg.ls_name}</Typography>
                {seg.election_id && <Typography sx={{ fontSize: '0.6rem', color: '#475569', background: 'rgba(255,255,255,0.06)', px: 0.8, py: 0.2, borderRadius: 0.75 }}>{seg.election_id}</Typography>}
              </Box>
              {seg.winner ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: PARTY_COLORS[seg.party_id] ?? '#475569', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seg.winner}
                    </Typography>
                    <Chip label={PARTY_LABELS[seg.party_id] ?? seg.party_id?.toUpperCase() ?? 'N/A'} size="small"
                      sx={{ background: `${PARTY_COLORS[seg.party_id] ?? '#475569'}33`, color: PARTY_COLORS[seg.party_id] ?? '#94a3b8', fontSize: '0.62rem', height: 18, fontWeight: 700 }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 0.4 }}>
                    {seg.vote_share != null && <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>Vote share <b style={{ color: '#cbd5e1' }}>{Number(seg.vote_share).toFixed(1)}%</b></Typography>}
                    {seg.margin_pct != null && <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>Margin <b style={{ color: Number(seg.margin_pct) < 5 ? '#fbbf24' : '#cbd5e1' }}>{Number(seg.margin_pct).toFixed(1)}%</b></Typography>}
                    {seg.margin_votes != null && <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>({Number(seg.margin_votes).toLocaleString('en-IN')} votes)</Typography>}
                  </Box>
                </>
              ) : (
                <Typography sx={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>No result data in graph</Typography>
              )}

              {/* VS segments */}
              {seg.vidhan_sabha_segments?.length > 0 && (
                <Box sx={{ mt: 0.75, pl: 1, borderLeft: '2px solid rgba(148,163,184,0.15)' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', mb: 0.3 }}>
                    {seg.vidhan_sabha_segments.length} VS Segments
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                    {seg.vidhan_sabha_segments.map((vs: any) => (
                      <Chip key={vs.vs_id} label={vs.name} size="small"
                        sx={{ fontSize: '0.58rem', height: 16, background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                          ...(vs.reservation && vs.reservation !== 'GEN' ? { border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c' } : {}) }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Political Leadership" icon="🏛️">
        <Typography fontWeight={700} fontSize="0.88rem" color="#f1f5f9">{leader.name || 'Data pending'}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip label={leader.designation || 'MLA'} size="small" sx={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '0.65rem', height: 18 }} />
          {leader.party && <Chip label={leader.party} size="small" sx={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', fontSize: '0.65rem', height: 18 }} />}
          {leader.since && <Chip label={`Since ${leader.since}`} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />}
        </Box>
        {leader.note && <Typography variant="caption" color="#64748b" display="block" mt={0.5} lineHeight={1.5}>{leader.note}</Typography>}
      </SectionCard>

      {totalPop > 0 && (
        <SectionCard title="Population" icon="👥">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.6 }}>
            {[
              { label: 'Total',     value: fmt(totalPop) },
              { label: 'Density',   value: population.density   ? `${population.density}/km²` : '—' },
              { label: 'Literacy',  value: population.literacy  ? `${population.literacy}%`   : '—' },
              { label: 'Sex Ratio', value: String(population.sex_ratio || '—') },
              { label: 'Rural',     value: fmt(population.rural) },
              { label: 'Urban',     value: fmt(population.urban) },
            ].map(s => (
              <Box key={s.label} sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 1, p: 0.65, textAlign: 'center' }}>
                <Typography fontWeight={700} fontSize="0.82rem" color="#f1f5f9">{s.value}</Typography>
                <Typography sx={{ fontSize: '0.62rem', color: '#64748b' }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
          {census?.hinduPopulation && (
            <Box sx={{ mt: 0.75, display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
              <Chip label={`Hindu ${fmt(census.hinduPopulation)}`} size="small" sx={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: '0.62rem', height: 17 }} />
              {census.muslimPopulation > 0 && <Chip label={`Muslim ${fmt(census.muslimPopulation)}`} size="small" sx={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontSize: '0.62rem', height: 17 }} />}
            </Box>
          )}
        </SectionCard>
      )}

      {demographics.length > 0 && (
        <SectionCard title="Age Demographics" icon="📊">
          {demographics.map(d => (
            <Box key={d.label} mb={0.75}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#cbd5e1' }}>{d.label}</Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9' }}>{d.percent}%</Typography>
              </Box>
              <Box sx={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${d.percent}%`, background: d.color || '#f97316', borderRadius: 99 }} />
              </Box>
            </Box>
          ))}
        </SectionCard>
      )}

      {headlines.length > 0 && (
        <SectionCard title="Latest Headlines" icon="📰">
          {headlines.map((h, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.65 }}>
              <Chip label={i + 1} size="small" sx={{ background: '#f97316', color: '#000', fontSize: '0.6rem', minWidth: 18, height: 17 }} />
              <Typography sx={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: 1.5 }}>{h}</Typography>
            </Box>
          ))}
        </SectionCard>
      )}

      {constituencies.length === 0 && !totalPop && demographics.length === 0 && (
        <Typography color="text.secondary" fontSize="0.82rem" sx={{ mt: 2 }}>No data available yet.</Typography>
      )}
    </Box>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: 1.5, overflow: 'hidden' }}>
      <Box sx={{ background: 'rgba(255,255,255,0.03)', px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569' }}>
          {icon} {title}
        </Typography>
      </Box>
      <Box sx={{ p: 1.1 }}>{children}</Box>
    </Box>
  );
}
