import React from 'react';
import IndiaMapSVG from '../components/Map/IndiaMapSVG';

const IndiaMapDashboard: React.FC = () => {
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, rgba(255,153,51,0.15), rgba(19,78,74,0.2))', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>🇮🇳 India — National Overview</h2>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Macro intelligence, voter segments & state drill-downs</p>
          </div>
        </div>

        {/* Top Row: Macro Political Metrics */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem 2rem 0', background: 'var(--bg-dark)' }}>
          <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Parliamentary Seats</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>543</div>
          </div>
          <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Ruling Alliance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>NDA</div>
          </div>
          <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>National Turnout Trend</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--positive)' }}>67.4% <span style={{ fontSize: '0.8rem' }}>(▲ 1.2%)</span></div>
          </div>
        </div>

        {/* Second Row: National Demographic Segments Overlay */}
        <div style={{ padding: '1.5rem 2rem 1rem', background: 'var(--bg-dark)' }}>
          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '0.8rem', fontWeight: 'bold' }}>National Segments</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Youth Chip */}
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem', cursor: 'pointer' }} title="Youth weakness concentrated in Maharashtra, Bihar, Karnataka">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Youth (18-25)</strong>
                <span style={{ color: 'var(--negative)', fontSize: '0.8rem' }}>▼ 2.1%</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share: 18% | Support: Flat</div>
            </div>
            {/* Women Chip */}
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Women</strong>
                <span style={{ color: 'var(--positive)', fontSize: '0.8rem' }}>▲ 4.5%</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share: 48% | Turnout: High</div>
            </div>
            {/* Urban Chip */}
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Urban</strong>
                <span style={{ color: 'var(--positive)', fontSize: '0.8rem' }}>▲ 1.8%</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share: 35% | Improving vs Rural</div>
            </div>
            {/* SC/ST/OBC Chip */}
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>SC/ST/OBC</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▬ Flat</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share: 68% | Support: Stable</div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div style={{ position: 'relative', height: '65vh', minHeight: '500px', background: 'var(--bg-dark)' }}>
          <IndiaMapSVG />
        </div>

      </div>
    </div>
  );
};

export default IndiaMapDashboard;
