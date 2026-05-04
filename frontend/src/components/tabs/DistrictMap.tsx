import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Paper, Chip, IconButton, InputBase } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import * as d3 from 'd3';
import { getIndiaGeo, getStateDistrictGeo, getDistrictData } from '../../api';
import type { DistrictData, MapSelection } from '../../types';
import { CONFIGURED_STATES } from '../../types';

// ── Region colours for configured state drill-down ───────────────────────────
const STATE_REGIONS: Record<string, { color: string; districts: string[] }> = {
  'Western Cluster': { color: '#fef08a', districts: ['Saharanpur','Muzaffarnagar','Shamli','Baghpat','Meerut','Ghaziabad','Hapur','Gautam Buddha Nagar','Bulandshahr','Aligarh','Hathras','Mathura','Agra','Firozabad','Etah','Kasganj','Mainpuri','Etawah','Auraiya','Kannauj','Farrukhabad'] },
  'Northwest Cluster': { color: '#bfdbfe', districts: ['Bijnor','Amroha','Moradabad','Rampur','Sambhal','Budaun','Bareilly','Pilibhit','Shahjahanpur'] },
  'Governance Cluster': { color: '#e9d5ff', districts: ['Kheri','Sitapur','Hardoi','Unnao','Lucknow','Rae Bareli','Barabanki','Ayodhya','Amethi','Sultanpur','Ambedkar Nagar','Gonda','Bahraich','Shravasti','Balrampur','Fatehpur'] },
  'Dryland Cluster': { color: '#fecaca', districts: ['Jalaun','Jhansi','Lalitpur','Hamirpur','Mahoba','Banda','Chitrakoot'] },
  'Eastern Cluster': { color: '#bbf7d0', districts: ['Siddharthnagar','Maharajganj','Kushinagar','Basti','Sant Kabir Nagar','Gorakhpur','Deoria','Azamgarh','Mau','Ballia','Jaunpur','Ghazipur','Varanasi','Mirzapur','Chandauli','Sonbhadra','Prayagraj','Kaushambi','Pratapgarh'] },
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

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ sel, onBack }: { sel: MapSelection; onBack: () => void }) {
  const crumbs = [{ label: '🇮🇳 India', active: sel.level === 'india' }];
  if (sel.stateName)   crumbs.push({ label: sel.stateName,    active: sel.level === 'state'    });
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
interface ListItem {
  name: string;
  sub?: string;       // region label
  color?: string;     // dot colour
  configured?: boolean;
}

function ListPanel({ items, selected, onSelect, placeholder }: {
  items: ListItem[];
  selected?: string;
  onSelect: (name: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(it => it.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid rgba(148,163,184,0.12)', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 1.5, px: 1, py: 0.5 }}>
          <SearchIcon sx={{ color: '#475569', fontSize: 15, flexShrink: 0 }} />
          <InputBase
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            sx={{ fontSize: '0.78rem', color: '#cbd5e1', flex: 1, '& input::placeholder': { color: '#475569' } }}
          />
          {query && (
            <Typography onClick={() => setQuery('')} sx={{ color: '#475569', fontSize: '0.7rem', cursor: 'pointer', '&:hover': { color: '#94a3b8' } }}>✕</Typography>
          )}
        </Box>
      </Box>

      {/* Count */}
      <Box sx={{ px: 1.5, py: 0.6, flexShrink: 0 }}>
        <Typography sx={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </Typography>
      </Box>

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 0.75, pb: 1 }}>
        {filtered.map(item => {
          const isSelected = item.name === selected;
          return (
            <Box
              key={item.name}
              onClick={() => onSelect(item.name)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1, py: 0.85,
                borderRadius: 1.25,
                cursor: 'pointer',
                mb: 0.25,
                background: isSelected ? 'rgba(249,115,22,0.18)' : 'transparent',
                border: isSelected ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                transition: 'background 0.15s',
                '&:hover': { background: isSelected ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.05)' },
              }}
            >
              {/* Colour dot */}
              {item.color && (
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
              )}
              {/* Name */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#f97316' : item.configured === false ? '#475569' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </Typography>
                {item.sub && (
                  <Typography sx={{ fontSize: '0.65rem', color: '#475569', mt: 0.1 }}>{item.sub}</Typography>
                )}
              </Box>
              {/* Badge for configured states */}
              {item.configured && (
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
              )}
            </Box>
          );
        })}
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
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Refs to keep D3 click handlers in sync with React state
  const selRef = useRef(sel);
  selRef.current = sel;

  // Tracks currently-selected feature name so mouseout handlers can restore highlight
  const selectedRef = useRef<string | undefined>(undefined);

  // ── Shared D3 draw ────────────────────────────────────────────────────────
  const renderMap = useCallback((
    geo: any,
    useIdentity: boolean,
    getFill: (name: string) => string,
    getName: (d: any) => string,
    onClick: (name: string) => void,
    isActive?: (name: string) => boolean,
  ) => {
    if (!svgRef.current || !containerRef.current) return;
    const W = containerRef.current.clientWidth  || 800;
    const H = containerRef.current.clientHeight || 620;

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
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function (_: MouseEvent, d: any) {
        const name = getName(d);
        d3.select(this).attr('stroke', '#f97316').attr('stroke-width', 1.5);
        const [mx, my] = d3.pointer(_, containerRef.current);
        setTooltip({ x: mx, y: my, text: name });
      })
      .on('mousemove', function (_: MouseEvent) {
        const [mx, my] = d3.pointer(_, containerRef.current);
        setTooltip(t => t ? { ...t, x: mx, y: my } : null);
      })
      .on('mouseout', function (_: MouseEvent, d: any) {
        const name = getName(d);
        d3.select(this)
          .attr('stroke', isActive && isActive(name) ? '#f97316' : '#1e293b')
          .attr('stroke-width', isActive && isActive(name) ? 1.5 : 0.7);
        setTooltip(null);
      })
      .on('click', (_: MouseEvent, d: any) => onClick(getName(d)));

    // Labels
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

  // ── Highlight selected path on map ────────────────────────────────────────
  const highlightOnMap = useCallback((name: string) => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll('path')
      .attr('stroke', (d: any) => {
        const n = d?.properties?.ST_NM || d?.properties?.name || d?.properties?.DISTRICT || '';
        return n === name ? '#f97316' : '#1e293b';
      })
      .attr('stroke-width', (d: any) => {
        const n = d?.properties?.ST_NM || d?.properties?.name || d?.properties?.DISTRICT || '';
        return n === name ? 2 : 0.7;
      });
  }, []);

  // ── Load India ────────────────────────────────────────────────────────────
  const loadIndia = useCallback(() => {
    setMapLoading(true); setMapError(''); setDistData(null); setListItems([]);
    getIndiaGeo()
      .then(geo => {
        setMapLoading(false);
        const items: ListItem[] = geo.features.map((f: any) => {
          const name = f.properties.ST_NM || '';
          const cfg = CONFIGURED_STATES[name];
          return { name, color: cfg ? '#f97316' : '#334155', configured: !!cfg };
        }).sort((a: ListItem, b: ListItem) => {
          // Put configured states first
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
      .catch(e => { setMapLoading(false); setMapError(e.message); });
  }, [renderMap]);

  // ── Load state districts ──────────────────────────────────────────────────
  const loadState = useCallback((stateCode: string) => {
    setMapLoading(true); setMapError(''); setDistData(null); setListItems([]);
    getStateDistrictGeo(stateCode)
      .then(geo => {
        setMapLoading(false);
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
      .catch(e => { setMapLoading(false); setMapError(e.message); });
  }, [renderMap]);

  // ── Select a district (from list OR map click) ────────────────────────────
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

  // ── List item clicked ─────────────────────────────────────────────────────
  const handleListSelect = useCallback((name: string) => {
    if (sel.level === 'india') {
      const cfg = CONFIGURED_STATES[name];
      if (!cfg) { showComingSoon(name); return; }
      // Briefly highlight the state on the India map before navigating into it
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
    if (sel.level === 'india') { loadIndia(); }
    // Only reload the state map when we arrive at 'state' level.
    // When level transitions to 'district' the same SVG is reused — just highlight.
    else if (sel.level === 'state' && sel.stateCode) { loadState(sel.stateCode); }
  }, [sel.level, sel.stateCode]); // eslint-disable-line

  // ── Legend ────────────────────────────────────────────────────────────────
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

  // ── List header label ─────────────────────────────────────────────────────
  const listLabel = sel.level === 'india' ? 'States' : `Districts — ${sel.stateName || ''}`;
  const listPlaceholder = sel.level === 'india' ? 'Search states...' : 'Search districts...';
  const selectedInList = sel.level === 'district' ? sel.districtName : sel.level === 'state' ? sel.stateName : undefined;

  return (
    <Box sx={{ height: 'calc(100vh - 104px)', display: 'flex', gap: 1.5 }}>

      {/* ── LEFT LIST PANEL ── */}
      <Paper elevation={0} sx={{ width: 220, minWidth: 220, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(148,163,184,0.12)', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            {listLabel}
          </Typography>
        </Box>
        <ListPanel
          items={listItems}
          selected={selectedInList}
          onSelect={handleListSelect}
          placeholder={listPlaceholder}
        />
      </Paper>

      {/* ── MAP PANEL ── */}
      <Paper elevation={0} sx={{ flex: 1, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        {/* Header */}
        <Box sx={{ px: 2, py: 1.1, borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.92)', flexShrink: 0 }}>
          <Breadcrumb sel={sel} onBack={goBack} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {renderLegend()}
            <div id="map-coming-soon" style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700, opacity: 0, transition: 'opacity 0.3s', whiteSpace: 'nowrap' }} />
          </Box>
        </Box>

        {/* SVG */}
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

          {/* Tooltip */}
          {tooltip && (
            <Box sx={{ position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 32, background: 'rgba(15,23,42,0.97)', color: '#f1f5f9', px: 1.5, py: 0.6, borderRadius: 1, border: '1px solid rgba(249,115,22,0.3)', fontSize: '0.78rem', fontWeight: 600, pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              {tooltip.text}
              {sel.level === 'india' && CONFIGURED_STATES[tooltip.text] && (
                <Typography component="span" sx={{ color: '#f97316', fontSize: '0.7rem', ml: 0.8 }}>click →</Typography>
              )}
            </Box>
          )}

          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: mapLoading || mapError ? 'none' : 'block' }} />
        </Box>
      </Paper>

      {/* ── DISTRICT DETAIL PANEL ── */}
      {sel.level === 'district' && sel.districtName && (
        <Paper elevation={0} sx={{ width: 340, border: '1px solid rgba(148,163,184,0.15)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
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
              <DistrictPanel data={distData} />
            ) : (
              <Typography color="text.secondary" fontSize="0.82rem" sx={{ mt: 2 }}>No data available yet.</Typography>
            )}
          </Box>
        </Paper>
      )}
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

// ── District detail panel ────────────────────────────────────────────────────
function DistrictPanel({ data }: { data: DistrictData }) {
  const { leader, population, demographics, headlines, census } = data;
  const fmt = (v?: number) => v && v > 0 ? Number(v).toLocaleString('en-IN') : '—';
  const totalPop = population.total || ((population.rural || 0) + (population.urban || 0));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
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
              { label: 'Total',    value: fmt(totalPop) },
              { label: 'Density', value: population.density ? `${population.density}/km²` : '—' },
              { label: 'Literacy', value: population.literacy ? `${population.literacy}%` : '—' },
              { label: 'Sex Ratio', value: String(population.sex_ratio || '—') },
              { label: 'Rural',    value: fmt(population.rural) },
              { label: 'Urban',    value: fmt(population.urban) },
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
