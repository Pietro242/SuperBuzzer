// App.jsx – Root con React Router (WebSocket, niente Firebase)
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PlayerView from './pages/PlayerView';
import HostView from './pages/HostView';
import ScreenView from './pages/ScreenView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/giocatore" replace />} />
        <Route path="/giocatore" element={<PlayerView />} />
        <Route path="/host" element={<HostView />} />
        <Route path="/schermo" element={<ScreenView />} />
        <Route path="*" element={<Navigate to="/giocatore" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
