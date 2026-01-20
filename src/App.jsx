import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Monitor, Registro, Confirmacao, FmeaAprendendo } from './pages';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/monitor" replace />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/registro/:eventId" element={<Registro />} />
          <Route path="/confirmacao/:registroId" element={<Confirmacao />} />
          <Route path="/fmea-aprendendo" element={<FmeaAprendendo />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
