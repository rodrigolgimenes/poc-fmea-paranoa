import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  LerEtiqueta,
  DiarioBordo,
  DiarioConfirmacao,
  ConsultaRegistros,
} from './pages';

const BASE_PATH = '/poc-fmea-paranoa';

function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
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
