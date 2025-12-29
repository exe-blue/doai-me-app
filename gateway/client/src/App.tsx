/**
 * DoAi.Me Control Room
 * Main App Component
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DeviceDetail from './pages/DeviceDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/device/:deviceId" element={<DeviceDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

