import { useState } from 'react';
import { Box, Paper, Typography, Chip, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getRegionDistricts, getConstituencies, getConstituencyAnalysis, getBoothAnalysis } from '../../api';

type View = 'regions' | 'districts' | 'constituencies' | 'analysis' | 'booth';

const REGIONS = [
  { id: 'western',     name: 'Western UP',              color: '#fef08a', accent: '#eab308', desc: 'Industrial & agricultural hub of the West.' },
  { id: 'central',     name: 'Central UP',              color: '#e9d5ff', accent: '#a855f7', desc: 'Heart of political power and governance.' },
  { id: 'eastern',     name: 'Eastern UP (Purvanchal)', color: '#bbf7d0', accent: '#22c55e', desc: 'Densely populated belt with diverse demographics.' },
  { id: 'bundelkhand', name: 'Bundelkhand',             color: '#fecaca', accent: '#ef4444', desc: 'Historic plateau region with unique issues.' },
];

export default function ConstituencyBooth() {
  const [view, setView]             = useState<View>('regions');
  const [loading, setLoading]       = useState(false);
  const [_regionId, setRegionId]    = useState('');
  const [regionName, setRegionName] = useState('');
  const [district, setDistrict]     = useState('');
  const [constituency, setConstituency] = useState('');
  const [districts, setDistricts]   = useState<string[]>([]);
  const [constituencies, setConstituencies] = useState<string[]>([]);
  const [analysis, setAnalysis]     = useState<any>(null);
  const [boothData, setBoothData]   = useState<any>(null);
  const [stack, setStack]           = useState<View[]>([]);

  const push = (next: View) => { setStack(s => [...s, view]); setView(next); };
  const pop  = () => { const s = [...stack]; const prev = s.pop()!; setStack(s); setView(prev); };

  const selectRegion = async (id: string, name: string) => {
    setRegionId(id); setRegionName(name); setLoading(true); push('districts');
    try { setDistricts(await getRegionDistricts(id)); } finally { setLoading(false); }
  };

  const selectDistrict = async (d: string) => {
    setDistrict(d); setLoading(true); push('constituencies');
    try { setConstituencies(await getConstituencies(d)); } finally { setLoading(false); }
  };

  const selectConstituency = async (c: string) => {
    setConstituency(c); setLoading(true); push('analysis');
    try { setAnalysis(await getConstituencyAnalysis(c)); } finally { setLoading(false); }
  };

  const selectBooth = async (id: string, name: string) => {
    setLoading(true); push('booth');
    try { setBoothData({ ...(await getBoothAnalysis(id)), name }); } finally { setLoading(false); }
  };

  const headers: Record<View, { title: string; subtitle: string }> = {
    regions:         { title: 'UP Constituency & Booth',   subtitle: 'Select a region to begin deep-dive analysis' },
    districts:       { title: regionName,                  subtitle: `Districts in ${regionName}` },
    constituencies:  { title: district,                    subtitle: `Constituencies in ${district}` },
    analysis:        { title: constituency,                subtitle: 'Intelligent Analysis & Booth Data' },
    booth:           { title: boothData?.name || 'Booth',  subtitle: 'Ground Level Booth Data' },
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        {stack.length > 0 && (
          <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={pop} sx={{ textTransform: 'none' }}>Back</Button>
        )}
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{headers[view].title}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{headers[view].subtitle}</Typography>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><div className="loading-spinner" /></Box>
      ) : (
        <>
          {view === 'regions' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {REGIONS.map(r => (
                <Paper key={r.id} elevation={0} onClick={() => selectRegion(r.id, r.name)}
                  sx={{ border: '1px solid #e2e8f0', borderLeft: `5px solid ${r.accent}`, borderRadius: 2, p: 3, cursor: 'pointer', background: r.color, '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }, transition: '0.2s' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 0.5 }}>{r.name}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{r.desc}</Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'block', mt: 1.5 }}>EXPLORE REGION →</Typography>
                </Paper>
              ))}
            </Box>
          )}

          {view === 'districts' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
              {districts.map(d => (
                <Paper key={d} elevation={0} onClick={() => selectDistrict(d)}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: '#FF6B35', background: '#fff7ed' }, transition: '0.2s' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{d}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>View Constituencies</Typography>
                </Paper>
              ))}
            </Box>
          )}

          {view === 'constituencies' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
              {constituencies.map(c => (
                <Paper key={c} elevation={0} onClick={() => selectConstituency(c)}
                  sx={{ border: '1.5px solid rgba(255,107,53,0.2)', borderRadius: 2, p: 2, cursor: 'pointer', background: '#fff7ed', '&:hover': { borderColor: '#FF6B35', boxShadow: '0 2px 8px rgba(255,107,53,0.15)' }, transition: '0.2s' }}>
                  <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>CONSTITUENCY</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', mt: 0.3 }}>{c}</Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, display: 'block', mt: 0.5 }}>ANALYZE →</Typography>
                </Paper>
              ))}
            </Box>
          )}

          {view === 'analysis' && analysis && <ConstituencyView data={analysis} onBoothClick={selectBooth} />}
          {view === 'booth' && boothData && <BoothView data={boothData} />}
        </>
      )}
    </Box>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function ConstituencyView({ data, onBoothClick }: { data: any; onBoothClick: (id: string, name: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Paper elevation={0} sx={{ border: '1px solid #bbf7d0', borderTop: '3px solid #22c55e', borderRadius: 2, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.8rem', color: '#16a34a', mb: 1.5 }}>1. Basic Info & Demographics</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
            <StatCard label="Total Voters" value={data.basic?.total_voters || '—'} />
            <StatCard label="Urban/Rural" value={data.basic?.urban_rural || '—'} />
            <StatCard label="Dominant Caste" value={data.demographics?.dominant_caste || '—'} />
            <StatCard label="Youth %" value={data.demographics?.youth_pop || '—'} />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{data.demographics?.religion_dist}</Typography>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderTop: '3px solid #FF6B35', borderRadius: 2, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.8rem', color: '#FF6B35', mb: 1.5 }}>2. Election Results (2022)</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#16a34a' }}>{data.results?.winner}</Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 0.5, mb: 1.5 }}>
            <Typography variant="body2">Party: <strong>{data.results?.party}</strong></Typography>
            <Typography variant="body2">Vote Share: <strong>{data.results?.vote_share}%</strong></Typography>
          </Box>
          {data.results?.chart_data && (
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 100, background: '#f8fafc', borderRadius: 1, p: 1 }}>
              {data.results.chart_data.map((c: any, i: number) => (
                <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box sx={{ width: '100%', height: `${c.val}%`, background: 'linear-gradient(to top, #FF6B35, #138808)', borderRadius: '3px 3px 0 0' }} />
                  <Typography variant="caption" sx={{ mt: 0.3, textAlign: 'center', fontSize: '0.6rem' }}>{c.label}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #bfdbfe', borderTop: '3px solid #3b82f6', borderRadius: 2, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.8rem', color: '#2563eb', mb: 1.5 }}>3. Candidate Intelligence</Typography>
          {data.candidates?.map((c: any, i: number) => (
            <Box key={i} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 700 }}>{c.name} ({c.party})</Typography>
                <Chip label={c.cases > 0 ? `${c.cases} Cases` : 'Clean'} size="small"
                  sx={{ background: c.cases > 0 ? '#fef2f2' : '#f0fdf4', color: c.cases > 0 ? '#dc2626' : '#16a34a', fontSize: '0.68rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Education: {c.education} | Assets: {c.assets}</Typography>
            </Box>
          ))}
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Paper elevation={0} sx={{ border: '1px solid #fde68a', borderTop: '3px solid #f59e0b', borderRadius: 2, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.8rem', color: '#d97706', mb: 1.5 }}>Issue Heatmap</Typography>
          {data.issues?.map((issue: any, i: number) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{issue.name}</Typography>
              <Chip label={issue.level} size="small" sx={{ background: issue.level === 'High' ? '#fef2f2' : '#fffbeb', color: issue.level === 'High' ? '#dc2626' : '#f59e0b', fontSize: '0.68rem' }} />
            </Box>
          ))}
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #bfdbfe', borderTop: '3px solid #3b82f6', borderRadius: 2, p: 2.5, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.8rem', color: '#2563eb', mb: 0.5 }}>Ground Booths</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>Click any booth for detail</Typography>
          <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {data.booths?.map((b: any) => (
              <Box key={b.id} onClick={() => onBoothClick(b.id, b.name)}
                sx={{ display: 'flex', justifyContent: 'space-between', p: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1, cursor: 'pointer', '&:hover': { borderColor: '#3b82f6', background: '#eff6ff' }, transition: '0.15s' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>ID: {b.id}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

function BoothView({ data }: { data: any }) {
  const sections = [
    { color: '#3b82f6', title: 'Booth Basic Info',    content: <><Typography variant="body2"><strong>ID:</strong> {data.basic?.id}</Typography><Typography variant="body2"><strong>Location:</strong> {data.basic?.location}</Typography><Typography variant="body2"><strong>Linked:</strong> {data.basic?.constituency}</Typography></> },
    { color: '#22c55e', title: 'Voter Data',          content: <><Typography variant="body2"><strong>Total:</strong> {data.voters?.total}</Typography><Typography variant="body2"><strong>Ratio:</strong> {data.voters?.ratio}</Typography><Typography variant="body2"><strong>Ages:</strong> {data.voters?.age_groups}</Typography></> },
    { color: '#f59e0b', title: 'Voting Pattern',      content: <Box sx={{ textAlign: 'center' }}><Box sx={{ width: 90, height: 90, borderRadius: '50%', border: '12px solid #FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}><Typography sx={{ fontWeight: 800 }}>{data.pattern?.turnout}%</Typography></Box><Typography variant="body2"><strong>Winner:</strong> {data.pattern?.winner}</Typography></Box> },
    { color: '#ef4444', title: 'Risk Indicators',     content: data.risks?.map((r: string, i: number) => <Typography key={i} variant="body2" sx={{ color: 'error.main', fontWeight: 600, mb: 0.5 }}>🚨 {r}</Typography>) },
    { color: '#a855f7', title: 'Social Composition',  content: <><Typography variant="body2"><strong>Dominant:</strong> {data.social?.dominant}</Typography><Typography variant="body2"><strong>Type:</strong> {data.social?.type}</Typography></> },
    { color: '#ec4899', title: 'Primary Issue',       content: <Box sx={{ background: '#fdf4ff', border: '1px dashed #e2e8f0', p: 1.5, borderRadius: 1 }}><Typography variant="body2">{data.issue}</Typography></Box> },
  ];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
      {sections.map(s => (
        <Paper key={s.title} elevation={0} sx={{ border: '1px solid #e2e8f0', borderTop: `3px solid ${s.color}`, borderRadius: 2, p: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: s.color, mb: 1.5 }}>{s.title}</Typography>
          {s.content}
        </Paper>
      ))}
    </Box>
  );
}
