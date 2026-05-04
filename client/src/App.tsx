import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import IndiaMapDashboard from './pages/IndiaMapDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndiaMapDashboard />} />
          <Route path="state/:stateCode" element={<div>State Dashboard (WIP)</div>} />
          <Route path="strategy" element={<div>Strategy Builder (WIP)</div>} />
          <Route path="search" element={<div>AI Search (WIP)</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
