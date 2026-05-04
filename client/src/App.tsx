import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import IndiaMapDashboard from './pages/IndiaMapDashboard';
import StateDashboard from './pages/StateDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndiaMapDashboard />} />
          <Route path="state/:stateCode" element={<StateDashboard />} />
          <Route path="strategy" element={<div style={{padding:'2rem',color:'var(--text-muted)'}}>Strategy Builder — coming soon</div>} />
          <Route path="search" element={<div style={{padding:'2rem',color:'var(--text-muted)'}}>AI Search — coming soon</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
