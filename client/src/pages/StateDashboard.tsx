import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StateMapSVG from '../components/Map/StateMapSVG';
import DistrictPanel from '../components/District/DistrictPanel';

// Static state metadata — extend as more states are added
const STATE_META: Record<string, { name: string; lsSeats: number; vsSeats: number; cm: string; party: string }> = {
  UP: {
    name: 'Uttar Pradesh',
    lsSeats: 80,
    vsSeats: 403,
    cm: 'Yogi Adityanath',
    party: 'BJP',
  },
};

const StateDashboard: React.FC = () => {
  const { stateCode } = useParams<{ stateCode: string }>();
  const navigate = useNavigate();
  const code = stateCode?.toUpperCase() ?? 'UP';
  const meta = STATE_META[code];

  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleDistrictClick = (districtName: string) => {
    setSelectedDistrict(districtName);
    setPanelOpen(true);
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    setSelectedDistrict(null);
  };

  if (!meta) {
    return (
      <div className="fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>State <strong>{code}</strong> is not yet configured.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '1rem', background: 'var(--primary)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
          ← Back to India Map
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '1.2rem 2rem', background: 'linear-gradient(135deg, rgba(255,153,51,0.15), rgba(19,78,74,0.2))', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              ← India Map
            </button>
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>🗺️ {meta.name}</h2>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Click any district to view election intelligence
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {selectedDistrict
              ? <div style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 600, background: 'rgba(255,153,51,0.1)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--secondary)' }}>{selectedDistrict} selected</div>
              : <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No district selected</div>
            }
          </div>
        </div>

        {/* State KPI Row */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>LS Seats</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{meta.lsSeats}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>VS Seats</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{meta.vsSeats}</div>
          </div>
          <div style={{ flex: 2, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Chief Minister</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{meta.cm} <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>({meta.party})</span></div>
          </div>
        </div>

        {/* Map + Sliding Panel */}
        <div style={{ display: 'flex', height: '80vh', minHeight: '600px' }}>
          {/* D3 Map */}
          <div style={{ flex: 1, position: 'relative', background: '#f8fafc', overflow: 'hidden' }}>
            <StateMapSVG stateCode={code} onDistrictClick={handleDistrictClick} selectedDistrict={selectedDistrict} />
          </div>

          {/* Sliding District Panel */}
          <div style={{ width: panelOpen ? '420px' : '0', overflow: 'hidden', transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '420px', height: '100%', overflowY: 'auto', padding: '1.5rem' }}>
              {selectedDistrict && (
                <DistrictPanel
                  districtName={selectedDistrict}
                  stateCode={code}
                  onClose={handleClosePanel}
                />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StateDashboard;
