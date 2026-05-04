import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, TrendingUp, Search } from 'lucide-react';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo-small">Ontology Engine</h1>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
              <Map size={18} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
              Interactive India Map
            </NavLink>
          </li>
          <li>
            <NavLink to="/strategy" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={18} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
              Strategy Builder
            </NavLink>
          </li>
          <li>
            <NavLink to="/search" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
              <Search size={18} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
              AI Search
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <div className="status-indicator-col">
          <div><span className="status-dot online"></span> Server</div>
          <div><span className="status-dot online"></span> Neo4j</div>
          <div><span className="status-dot online"></span> AI Engine</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
