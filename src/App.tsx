import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LobbyPage } from '@/pages/LobbyPage';
import { GamePage } from '@/pages/GamePage';
import { LoginPage } from '@/pages/LoginPage';
import { DeckEditorPage } from '@/pages/DeckEditorPage';
import { CardEditorPage } from '@/pages/CardEditorPage';
import { AdminPage } from '@/pages/AdminPage';
import { RequireAuth, RequireRole } from '@/components/RequireAuth';
import { useAuthStore } from '@/store/authStore';
import { PortraitGate } from '@/components/PortraitGate';

function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <PortraitGate />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><LobbyPage /></RequireAuth>} />
        <Route path="/game" element={<RequireAuth><GamePage /></RequireAuth>} />
        <Route path="/game/:roomCode" element={<RequireAuth><GamePage /></RequireAuth>} />
        <Route path="/deck" element={<RequireAuth><DeckEditorPage /></RequireAuth>} />
        <Route
          path="/editor"
          element={
            <RequireRole roles={['admin', 'supervisor']}>
              <CardEditorPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={<RequireRole roles={['admin']}><AdminPage /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
