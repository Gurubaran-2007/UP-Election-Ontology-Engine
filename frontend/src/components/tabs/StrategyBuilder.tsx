import { useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Chip, LinearProgress } from '@mui/material';
import * as d3 from 'd3';
import { analyzeStrategy } from '../../api';
import type { StrategyResult, GraphNode, GraphLink } from '../../types';

export default function StrategyBuilder() {
  const [title, setTitle]     = useState('');
  const [desc, setDesc]       = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<StrategyResult | null>(null);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try { setResult(await analyzeStrategy(title, desc)); }
    catch { setError('Analysis failed. Please retry.'); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 3 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 0.5 }}>Strategy Builder</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 2 }}>
          Enter a proposed political implementation plan to analyze public sentiment.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Plan Title" placeholder="e.g. Free Laptop Distribution Scheme" value={title} onChange={e => setTitle(e.target.value)} required fullWidth size="small" />
          <TextField label="Implementation Details" placeholder="Describe the policy, target audience, and key highlights..." value={desc} onChange={e => setDesc(e.target.value)} required fullWidth multiline rows={3} size="small" />
          <Button type="submit" variant="contained" disabled={loading} sx={{ alignSelf: 'flex-start', background: '#FF6B35', '&:hover': { background: '#e85d2a' }, textTransform: 'none', fontWeight: 700, px: 3 }}>
            {loading ? 'Analyzing...' : 'Analyze Strategy Impact'}
          </Button>
          {loading && <LinearProgress sx={{ borderRadius: 1 }} color="warning" />}
          {error && <Typography sx={{ color: 'error.main', fontSize: '0.85rem' }}>{error}</Typography>}
        </Box>
      </Paper>

      {result && (
        <Box className="fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Scorecard */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            {[
              { label: 'Positive Impact', value: `${result.metrics.positive}%`, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Resistance',      value: `${result.metrics.negative}%`, color: '#dc2626', bg: '#fef2f2' },
              { label: 'Success Rate',    value: `${result.metrics.overall}%`,  color: '#2563eb', bg: '#eff6ff' },
            ].map(m => (
              <Paper key={m.label} elevation={0} sx={{ border: `1px solid ${m.color}40`, borderRadius: 2, p: 2, textAlign: 'center', background: m.bg }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color: m.color }}>{m.value}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</Typography>
              </Paper>
            ))}
          </Box>

          {/* AI Prediction */}
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>AI Strategy Prediction</Typography>
            {result.db_context?.includes('found') && (
              <Chip label="Historical Precedent Found" size="small" sx={{ mb: 1.5, background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }} />
            )}
            <Box sx={{ background: '#f8fafc', borderRadius: 1, p: 2, maxHeight: 300, overflowY: 'auto', fontSize: '0.88rem', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
              {result.ai_prediction}
            </Box>
          </Paper>

          {/* Force Graph */}
          {result.graph_data?.nodes?.length > 0 && (
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 3 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Public Sentiment Graph</Typography>
              <SentimentGraph nodes={result.graph_data.nodes} links={result.graph_data.links} />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 1 }}>
                Node size = impact level &nbsp;|&nbsp; Green = positive sentiment, Red = resistance
              </Typography>
            </Paper>
          )}

          {/* Support & Resistance */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Paper elevation={0} sx={{ border: '1px solid #bbf7d0', borderRadius: 2, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#16a34a', mb: 1.5 }}>Support Analysis</Typography>
              {result.support.map((s, i) => (
                <Box key={i} sx={{ background: '#f0fdf4', borderLeft: '3px solid #22c55e', px: 1.5, py: 1, mb: 1, borderRadius: '0 6px 6px 0' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#16a34a' }}>{s.group}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.reason}</Typography>
                </Box>
              ))}
            </Paper>
            <Paper elevation={0} sx={{ border: '1px solid #fecaca', borderRadius: 2, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#dc2626', mb: 1.5 }}>Resistance Analysis</Typography>
              {result.resistance.map((r, i) => (
                <Box key={i} sx={{ background: '#fef2f2', borderLeft: '3px solid #ef4444', px: 1.5, py: 1, mb: 1, borderRadius: '0 6px 6px 0' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626' }}>{r.group}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.reason}</Typography>
                </Box>
              ))}
            </Paper>
          </Box>

          {/* Demography + Roadmap */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#7c3aed', mb: 1 }}>Demographic Study</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.7 }}>{result.demography}</Typography>
              <Box sx={{ mt: 1.5, p: 1.5, background: '#fafafa', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#FF6B35', mb: 0.5 }}>Success Justification</Typography>
                <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{result.summary}</Typography>
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#d97706', mb: 1 }}>Roadmap to 100% Success</Typography>
              {result.roadmap.map((step, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 22, height: 22, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>{i + 1}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.84rem', color: 'text.secondary', lineHeight: 1.5 }}>{step}</Typography>
                </Box>
              ))}
            </Paper>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function SentimentGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;
    const W = 700, H = 380;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const colorOf = (s: string) => s === 'positive' ? '#22c55e' : s === 'negative' ? '#ef4444' : '#94a3b8';
    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius((d: any) => 20 + (d.impact || 10) / 4));
    const link = svg.append('g').selectAll('line').data(links).enter().append('line')
      .attr('stroke', '#cbd5e1').attr('stroke-width', 1.5);
    const node = svg.append('g').selectAll('g').data(nodes).enter().append('g').style('cursor', 'pointer');
    node.append('circle').attr('r', (d) => 14 + (d.impact || 10) / 5).attr('fill', (d) => colorOf(d.sentiment)).attr('stroke', '#fff').attr('stroke-width', 2).attr('fill-opacity', 0.85);
    node.append('text').text((d) => d.label).attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '11px').style('font-weight', '600').style('fill', '#1e293b').style('pointer-events', 'none');
    sim.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y).attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
    return () => { sim.stop(); };
  }, [nodes, links]);

  return (
    <Box sx={{ background: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <svg ref={svgRef} viewBox="0 0 700 380" style={{ width: '100%', height: 380 }} />
    </Box>
  );
}
