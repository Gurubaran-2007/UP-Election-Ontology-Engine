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
  BJP: '#FF9933', bjp: '#FF9933',
  SP: '#FF0000', sp: '#FF0000',
  BSP: '#1a237e', bsp: '#1a237e',
  INC: '#00BFFF', inc: '#00BFFF',
  AIMIM: '#006400', RLD: '#228B22',
};

function partyBadgeColor(party?: string) {
  if (!party) return '#334155';
  const key = Object.keys(PARTY_COLORS).find(k => k.toLowerCase() === (party ?? '').toLowerCase());
  return key ? PARTY_COLORS[key] : '#475569';
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
    {children}
  </div>
);

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
    {children}
  </div>
);

const DistrictPanel: React.FC<Props> = ({ districtName, stateCode, onClose }) => {
  const [lsData, setLsData] = useState<EnrichedLS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setLsData([]);

    const prefix = `/api/${stateCode.toLowerCase()}`;

    // Step 1: Get the LS constituencies for this district
    fetch(`${prefix}/district/${encodeURIComponent(districtName)}/constituencies`)
      .then(res => {
        if (!res.ok) throw new Error(`District not found (${res.status})`);
        return res.json();
      })
      .then(async (constituencies: LSConstituency[]) => {
        if (!constituencies.length) {
          setLsData([]);
          setLoading(false);
          return;
        }

        // Step 2: For each LS seat, fetch election results in parallel
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
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [districtName, stateCode]);

  return (
    <div style={{ color: 'var(--text-main)' }}>
      {/* Close + Title */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>

      <h3 style={{ color: 'var(--primary)', fontSize: '1.3rem', margin: '0 0 0.2rem', paddingRight: '2.5rem' }}>{districtName}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 1.5rem' }}>Uttar Pradesh · Graph-backed data</p>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem', borderTopColor: 'var(--primary)', borderRightColor: 'var(--secondary)' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Querying Neo4j graph...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
          ⚠️ {error}
          <br /><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>This district may not be fully imported yet.</span>
        </div>
      )}

      {/* No data */}
      {!loading && !error && lsData.length === 0 && (
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No constituency data found for <strong>{districtName}</strong> in the graph yet.
        </div>
      )}

      {/* LS Constituencies */}
      {!loading && lsData.map((ls, i) => (
        <div key={i}>
          {/* LS Seat Header */}
          <Section>
            <SectionTitle>🏛️ Lok Sabha Constituency</SectionTitle>
            <div style={{ background: 'rgba(10,10,20,0.85)', border: '1.5px solid rgba(255,153,51,0.35)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>{ls.lok_sabha.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {ls.lok_sabha.ls_id}</div>
            </div>
          </Section>

          {/* Election Results */}
          {ls.results.length > 0 && (
            <Section>
              <SectionTitle>🗳️ Election Results</SectionTitle>
              {ls.results.map((r, j) => (
                <div key={j} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{r.election_id ?? 'LS2019'}</span>
                    <span style={{ background: partyBadgeColor(r.winner_party_id), color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px' }}>
                      {r.winner_party_id ?? 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                    {r.winner ?? '—'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {r.winner_vote_share && (
                      <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#4ade80' }}>{Number(r.winner_vote_share).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Vote Share</div>
                      </div>
                    )}
                    {r.margin_pct && (
                      <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>{Number(r.margin_pct).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Win Margin</div>
                      </div>
                    )}
                    {r.margin_votes && (
                      <div style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#60a5fa' }}>{Number(r.margin_votes).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Margin (Votes)</div>
                      </div>
                    )}
                    {r.total_valid_votes && (
                      <div style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#a78bfa' }}>{Number(r.total_valid_votes).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Votes</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Vidhan Sabha Segments */}
          {ls.vidhan_sabha_segments.length > 0 && (
            <Section>
              <SectionTitle>🏟️ Vidhan Sabha Segments ({ls.vidhan_sabha_segments.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {ls.vidhan_sabha_segments.map((vs, k) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.9rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{vs.name}</span>
                    {vs.reservation && vs.reservation !== 'GEN' && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,153,51,0.2)', color: '#FF9933', border: '1px solid rgba(255,153,51,0.4)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>
                        {vs.reservation}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      ))}

      {!loading && lsData.length > 0 && (
        <div style={{ fontSize: '0.68rem', color: '#475569', fontStyle: 'italic' }}>
          Source: Neo4j Graph (ECI LS 2019 data)
        </div>
      )}
    </div>
  );
};

export default DistrictPanel;
