import React, { useEffect, useState } from 'react';

interface VSSegment { vs_id: string; name: string; reservation?: string }
interface LSConstituency {
  lok_sabha: { ls_id: string; name: string };
  vidhan_sabha_segments: VSSegment[];
}
interface ElectionResult {
  election_id?: string;
  winner?: string;
  winner_party_id?: string;
  winner_vote_share?: string;
  margin_votes?: string;
  margin_pct?: string;
  total_valid_votes?: string;
}
interface EnrichedLS extends LSConstituency {
  results: ElectionResult[];
}

interface Props {
  districtName: string;
  stateCode: string;
  onClose: () => void;
}

const PARTY_COLORS: Record<string, string> = {
  bjp: '#f97316', sp: '#ef4444', bsp: '#1a237e', inc: '#0ea5e9',
  aimim: '#006400', rld: '#228B22',
};

function partyColor(party?: string) {
  if (!party) return '#64748b';
  return PARTY_COLORS[party.toLowerCase()] ?? '#64748b';
}

const DistrictPanel: React.FC<Props> = ({ districtName, stateCode, onClose }) => {
  const [lsData, setLsData] = useState<EnrichedLS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setLsData([]);

    const prefix = `/api/${stateCode.toLowerCase()}`;

    fetch(`${prefix}/district/${encodeURIComponent(districtName)}/constituencies`)
      .then(res => {
        if (!res.ok) throw new Error(`District not found (${res.status})`);
        return res.json();
      })
      .then(async (constituencies: LSConstituency[]) => {
        if (!constituencies.length) { setLsData([]); setLoading(false); return; }

        const enriched = await Promise.all(
          constituencies.map(async (ls) => {
            try {
              const res = await fetch(`${prefix}/constituency/${encodeURIComponent(ls.lok_sabha.name)}/results`);
              if (!res.ok) return { ...ls, results: [] };
              const data = await res.json();
              return { ...ls, results: data.results ?? [] };
            } catch {
              return { ...ls, results: [] };
            }
          })
        );

        setLsData(enriched);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [districtName, stateCode]);

  return (
    <div style={{ color: '#1e293b', position: 'relative' }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 0, right: 0,
          background: 'transparent', border: '1px solid rgba(100,116,139,0.3)',
          color: '#64748b', width: 28, height: 28, borderRadius: '50%',
          cursor: 'pointer', fontSize: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      <h3 style={{ color: '#f97316', fontSize: '1.2rem', margin: '0 0 0.15rem', paddingRight: '2rem' }}>
        {districtName}
      </h3>
      <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 1.5rem' }}>
        Uttar Pradesh · Graph-backed data
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Querying Neo4j graph...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem' }}>
          {error}
          <br /><span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>District may not be fully imported yet.</span>
        </div>
      )}

      {!loading && !error && lsData.length === 0 && (
        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          No constituency data found for <strong>{districtName}</strong> in the graph.
        </div>
      )}

      {!loading && lsData.map((ls, i) => (
        <div key={i} style={{ marginBottom: '1.5rem' }}>
          {/* LS Seat */}
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f97316', marginBottom: '0.5rem' }}>
            Lok Sabha Constituency
          </div>
          <div style={{ background: 'rgba(249,115,22,0.06)', border: '1.5px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '0.9rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.3rem' }}>{ls.lok_sabha.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ID: {ls.lok_sabha.ls_id}</div>
          </div>

          {/* Election Results */}
          {ls.results.length > 0 && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(100,116,139,0.15)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: '0.5rem' }}>
                Election Results
              </div>
              {ls.results.map((r, j) => (
                <div key={j} style={{ background: '#fff', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '10px', padding: '0.9rem', marginBottom: '0.6rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{r.election_id ?? 'LS2019'}</span>
                    <span style={{ background: partyColor(r.winner_party_id), color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px' }}>
                      {r.winner_party_id ?? 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>
                    {r.winner ?? '—'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {r.winner_vote_share && (
                      <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16a34a' }}>{Number(r.winner_vote_share).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Vote Share</div>
                      </div>
                    )}
                    {r.margin_pct && (
                      <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#d97706' }}>{Number(r.margin_pct).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Win Margin</div>
                      </div>
                    )}
                    {r.margin_votes && (
                      <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563eb' }}>{Number(r.margin_votes).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Margin Votes</div>
                      </div>
                    )}
                    {r.total_valid_votes && (
                      <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#7c3aed' }}>{Number(r.total_valid_votes).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Votes</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Vidhan Sabha Segments */}
          {ls.vidhan_sabha_segments.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: '0.5rem' }}>
                Vidhan Sabha Segments ({ls.vidhan_sabha_segments.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {ls.vidhan_sabha_segments.map((vs, k) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: '8px', padding: '0.5rem 0.85rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>{vs.name}</span>
                    {vs.reservation && vs.reservation !== 'GEN' && (
                      <span style={{ fontSize: '0.62rem', background: 'rgba(249,115,22,0.12)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>
                        {vs.reservation}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {!loading && lsData.length > 0 && (
        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.5rem' }}>
          Source: Neo4j Graph (ECI LS 2019 data)
        </div>
      )}
    </div>
  );
};

export default DistrictPanel;
