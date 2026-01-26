import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  LerEtiqueta,
  DiarioBordo,
  DiarioConfirmacao,
  ConsultaRegistros,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Diário de Bordo */}
        <Route path="/" element={<LerEtiqueta />} />
        <Route path="/diario-bordo" element={<DiarioBordo />} />
        <Route path="/diario-confirmacao" element={<DiarioConfirmacao />} />
        <Route path="/consulta" element={<ConsultaRegistros />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
