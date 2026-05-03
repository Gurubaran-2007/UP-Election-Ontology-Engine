import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import * as d3 from 'd3';
import { getUPGeo, getDistrictData } from '../../api';
import type { DistrictData } from '../../types';

const REGIONS: Record<string, { color: string; districts: string[] }> = {
  'Western U.P.': { color: '#fef08a', districts: ['Saharanpur','Muzaffarnagar','Shamli','Baghpat','Meerut','Ghaziabad','Hapur','Gautam Buddha Nagar','Bulandshahr','Aligarh','Hathras','Mathura','Agra','Firozabad','Etah','Kasganj','Mainpuri','Etawah','Auraiya','Kannauj','Farrukhabad'] },
  'Rohilkhand':   { color: '#bfdbfe', districts: ['Bijnor','Amroha','Moradabad','Rampur','Sambhal','Budaun','Bareilly','Pilibhit','Shahjahanpur'] },
  'Awadh':        { color: '#e9d5ff', districts: ['Kheri','Sitapur','Hardoi','Unnao','Lucknow','Rae Bareli','Barabanki','Ayodhya','Amethi','Sultanpur','Ambedkar Nagar','Gonda','Bahraich','Shravasti','Balrampur','Fatehpur'] },
  'Bundelkhand':  { color: '#fecaca', districts: ['Jalaun','Jhansi','Lalitpur','Hamirpur','Mahoba','Banda','Chitrakoot'] },
  'Purvanchal':   { color: '#bbf7d0', districts: ['Siddharthnagar','Maharajganj','Kushinagar','Basti','Sant Kabir Nagar','Gorakhpur','Deoria','Azamgarh','Mau','Ballia','Jaunpur','Ghazipur','Varanasi','Mirzapur','Chandauli','Sonbhadra','Prayagraj','Kaushambi','Pratapgarh'] },
};

function getRegionColor(name: string) {
  for (const [, { color, districts }] of Object.entries(REGIONS)) {
    if (districts.some(d => name.includes(d) || d.includes(name))) return color;
  }
  return '#e2e8f0';
}

export default function DistrictMap() {
  const svgRef        = useRef<SVGSVGElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [distData, setDistData]   = useState<DistrictData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    getUPGeo()
      .then(geo => {
        if (cancelled || !containerRef.current || !svgRef.current) return;
        const W = containerRef.current.clientWidth || 700;
        const H = containerRef.current.clientHeight || 600;

        const svg = d3.select(svgRef.current)
          .attr('width', '100%').attr('height', '100%')
          .attr('viewBox', `0 0 ${W} ${H}`);

        svg.selectAll('*').remove();

        const g = svg.append('g');

        const projection = d3.geoIdentity().reflectY(true).fitSize([W, H], geo);
        const path = d3.geoPath().projection(projection);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 12])
          .on('zoom', (e) => g.attr('transform', e.transform));
        svg.call(zoom);

        g.selectAll('path')
          .data(geo.features)
          .enter().append('path')
          .attr('d', path as any)
          .attr('fill', (d: any) => getRegionColor(d.properties.NAME_2 || d.properties.name || ''))
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 0.5)
          .style('cursor', 'pointer')
          .on('mouseover', function () {
            d3.select(this).attr('stroke', '#FF6B35').attr('stroke-width', 1.5);
          })
          .on('mouseout', function (_, d: any) {
            const name = d.properties.NAME_2 || d.properties.name || '';
            const isSelected = name === selected;
            d3.select(this)
              .attr('stroke', isSelected ? '#FF6B35' : '#94a3b8')
              .attr('stroke-width', isSelected ? 2 : 0.5);
          })
          .on('click', (_: any, d: any) => {
            const name = d.properties.NAME_2 || d.properties.name || '';
            setSelected(name);
            setLoading(true);
            setDistData(null);
            getDistrictData(name).then(data => { setDistData(data); setLoading(false); }).catch(() => setLoading(false));
          });

        // District labels
        g.selectAll('text')
          .data(geo.features)
          .enter().append('text')
          .attr('x', (d: any) => path.centroid(d)[0] || 0)
          .attr('y', (d: any) => path.centroid(d)[1] || 0)
          .attr('text-anchor', 'middle').attr('dy', '.35em')
          .style('pointer-events', 'none')
          .style('font-size', '0.5rem')
          .style('font-weight', '600')
          .style('fill', '#1e293b')
          .text((d: any) => d.properties.NAME_2 || d.properties.name || '');

        setMapLoading(false);
      })
      .catch(e => { setMapError(e.message); setMapLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', gap: 2 }}>
      {/* Map */}
      <Paper elevation={0} sx={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700} fontSize="1.1rem">Uttar Pradesh District Map</Typography>
          {selected && <Chip label={selected} size="small" sx={{ background: '#fff7ed', color: '#FF6B35', fontWeight: 700, border: '1px solid #FF6B35' }} />}
        </Box>
        <Box ref={containerRef} sx={{ height: 'calc(100% - 57px)', position: 'relative' }}>
          {mapLoading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <div className="loading-spinner" />
              <Typography color="text.secondary" fontSize="0.85rem">Loading district map...</Typography>
            </Box>
          )}
          {mapError && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="error">Failed to load map: {mapError}</Typography>
            </Box>
          )}
          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: mapLoading || mapError ? 'none' : 'block' }} />
        </Box>
      </Paper>

      {/* District Panel */}
      {selected && (
        <Paper elevation={0} sx={{ width: 380, border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', background: '#fff7ed' }}>
            <Typography fontWeight={800} fontSize="1.15rem" color="#FF6B35">{selected}</Typography>
            <Typography variant="caption" color="text.secondary">Uttar Pradesh, India</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, gap: 2 }}>
                <div className="loading-spinner" />
                <Typography color="text.secondary" fontSize="0.85rem">Fetching intelligence...</Typography>
              </Box>
            ) : distData ? (
              <DistrictPanel data={distData} />
            ) : null}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function DistrictPanel({ data }: { data: DistrictData }) {
  const { leader, population, demographics, headlines, census } = data;
  const fmt = (v?: number) => v && v > 0 ? Number(v).toLocaleString('en-IN') : '—';
  const totalPop = population.total || ((population.rural || 0) + (population.urban || 0));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Political Leader */}
      <SectionCard title="Political Leadership" icon="🏛️">
        <Typography fontWeight={700}>{leader.name || 'Fetching...'}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip label={leader.designation || 'MLA'} size="small" sx={{ background: '#fff7ed', color: '#FF6B35', fontSize: '0.7rem' }} />
          <Chip label={leader.party || 'N/A'} size="small" sx={{ background: '#f0fdf4', color: '#138808', fontSize: '0.7rem' }} />
          {leader.since && <Chip label={`Since ${leader.since}`} size="small" sx={{ fontSize: '0.7rem' }} />}
        </Box>
        {leader.note && <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{leader.note}</Typography>}
      </SectionCard>

      {/* Population */}
      {totalPop > 0 && (
        <SectionCard title="Population Overview" icon="👥">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { label: 'Total', value: fmt(totalPop) },
              { label: 'Density', value: population.density ? `${population.density}/km²` : '—' },
              { label: 'Literacy', value: population.literacy ? `${population.literacy}%` : '—' },
              { label: 'Sex Ratio', value: population.sex_ratio || '—' },
              { label: 'Rural', value: fmt(population.rural) },
              { label: 'Urban', value: fmt(population.urban) },
            ].map(s => (
              <Box key={s.label} sx={{ background: '#f8fafc', borderRadius: 1, p: 1, textAlign: 'center' }}>
                <Typography fontWeight={700} fontSize="0.95rem">{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            ))}
          </Box>
          {census?.hinduPopulation && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip label={`Hindu: ${fmt(census.hinduPopulation)}`} size="small" sx={{ background: '#fff7ed', color: '#FF6B35', fontSize: '0.68rem' }} />
              {census.muslimPopulation > 0 && <Chip label={`Muslim: ${fmt(census.muslimPopulation)}`} size="small" sx={{ background: '#eff6ff', color: '#3b82f6', fontSize: '0.68rem' }} />}
            </Box>
          )}
        </SectionCard>
      )}

      {/* Demographics */}
      {demographics.length > 0 && (
        <SectionCard title="Age Demographics" icon="📊">
          {demographics.map(d => (
            <Box key={d.label} mb={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography variant="caption" fontWeight={600}>{d.label}</Typography>
                <Typography variant="caption" fontWeight={700}>{d.percent}%</Typography>
              </Box>
              <Box sx={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${d.percent}%`, background: d.color || '#FF6B35', borderRadius: 4, transition: 'width 0.6s ease' }} />
              </Box>
            </Box>
          ))}
        </SectionCard>
      )}

      {/* Headlines */}
      {headlines.length > 0 && (
        <SectionCard title="Top Headlines" icon="📰">
          {headlines.map((h, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Chip label={i + 1} size="small" sx={{ background: '#FF6B35', color: '#fff', fontSize: '0.65rem', minWidth: 22, height: 20 }} />
              <Typography variant="caption" lineHeight={1.5}>{h}</Typography>
            </Box>
          ))}
        </SectionCard>
      )}
    </Box>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ background: '#f8fafc', px: 1.5, py: 0.8, borderBottom: '1px solid #e2e8f0' }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
          {icon} {title}
        </Typography>
      </Box>
      <Box sx={{ p: 1.5 }}>{children}</Box>
    </Box>
  );
}
