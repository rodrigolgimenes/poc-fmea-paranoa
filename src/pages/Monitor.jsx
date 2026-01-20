import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Labels for display
const STATUS_LABELS = {
  normal: '✓ NORMAL',
  tendencia: '⚠️ TENDÊNCIA DE DESVIO',
  desvio: '🚨 DESVIO'
};

const REGRA_LABELS = {
  tendencia_3_pontos_subindo: '3 pontos consecutivos subindo',
  tendencia_2_pontos_acima: '2 pontos acima do limite',
  abaixo_do_esperado: 'Valor abaixo do esperado',
  fora_do_limite: 'Fora do limite de especificação',
  estabilizado: 'Processo estabilizado'
};

// Mock chart data generator
function generateChartData(event) {
  const { valor_atual, LSE, LIE, status } = event;
  const range = LSE - LIE;
  const bars = [];
  
  for (let i = 0; i < 10; i++) {
    let value;
    if (status === 'tendencia' || status === 'desvio') {
      // Trending upward
      value = LIE + (range * 0.3) + (range * 0.5 * (i / 9));
      if (i >= 8) value = valor_atual;
    } else {
      // Normal variation around center
      value = LIE + (range * 0.4) + (Math.random() * range * 0.2);
    }
    
    const percent = ((value - LIE) / range) * 100;
    const isAbove = value > LSE;
    const isWarning = value > LSE - (range * 0.1);
    
    bars.push({ value, percent: Math.min(percent, 100), isAbove, isWarning });
  }
  
  return bars;
}

export default function Monitor() {
  const navigate = useNavigate();
  const { 
    getCurrentEvent, 
    simulationMode, 
    setSimulationMode, 
    currentTurno,
    setCurrentTurno,
    SIMULATION_MODES 
  } = useApp();

  const event = getCurrentEvent();
  const chartData = generateChartData(event);

  const handleRegister = () => {
    navigate(`/registro/${event.event_id}`);
  };

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">FMEA VIVO — PARANOÁ</h1>
          <p className="page-subtitle">
            Processo: {event.processo} | Linha: {event.linha} | Turno: {currentTurno}
          </p>
        </div>
        
        {/* Simulation controls */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="simulation-control">
            <label>Turno:</label>
            <select 
              value={currentTurno} 
              onChange={(e) => setCurrentTurno(e.target.value)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          
          <div className="simulation-control">
            <label>🎮 Simulação:</label>
            <select 
              value={simulationMode} 
              onChange={(e) => setSimulationMode(e.target.value)}
            >
              <option value={SIMULATION_MODES.NORMAL}>Normal</option>
              <option value={SIMULATION_MODES.TENDENCIA}>Tendência</option>
              <option value={SIMULATION_MODES.DESVIO}>Desvio</option>
            </select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="page-content">
        {/* Equipment info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Equipamento: {event.equipamento}</span>
            <span className={`status-badge ${event.status}`}>
              {STATUS_LABELS[event.status]}
            </span>
          </div>
          
          <div className="info-grid">
            <div className="info-item">
              <div className="label">Variável CEP</div>
              <div className="value">{event.variavel_cep}</div>
            </div>
            <div className="info-item">
              <div className="label">Valor Atual</div>
              <div className="value" style={{ 
                color: event.valor_atual > event.LSE || event.valor_atual < event.LIE 
                  ? 'var(--color-danger)' 
                  : 'inherit' 
              }}>
                {event.valor_atual} {event.unidade}
              </div>
            </div>
            <div className="info-item">
              <div className="label">LSE (Limite Superior)</div>
              <div className="value">{event.LSE} {event.unidade}</div>
            </div>
            <div className="info-item">
              <div className="label">LIE (Limite Inferior)</div>
              <div className="value">{event.LIE} {event.unidade}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Gráfico CEP (últimas leituras)</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Regra: {REGRA_LABELS[event.regra_cep] || event.regra_cep}
            </span>
          </div>
          
          <div className="mini-chart">
            <div className="chart-line">
              {chartData.map((bar, i) => (
                <div 
                  key={i}
                  className={`bar ${bar.isAbove ? 'above-limit' : bar.isWarning ? 'warning' : ''}`}
                  style={{ height: `${bar.percent}%` }}
                />
              ))}
            </div>
            <div className="limits">
              <span>LIE: {event.LIE}</span>
              <span>LSE: {event.LSE}</span>
            </div>
          </div>
        </div>

        {/* Failure mode info */}
        {event.status !== 'normal' && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
            <div className="card-title" style={{ marginBottom: '8px' }}>
              Modo de Falha Associado
            </div>
            <p style={{ fontSize: '20px', fontWeight: '600' }}>
              {event.modo_falha_sugerido}
            </p>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>
              O CEP detectou uma tendência que pode levar a este modo de falha. 
              Registre sua percepção para ajudar o FMEA a aprender.
            </p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="bottom-bar">
        {event.status !== 'normal' ? (
          <button 
            className="btn btn-warning btn-lg btn-block"
            onClick={handleRegister}
          >
            📝 REGISTRAR PERCEPÇÃO (1 min)
          </button>
        ) : (
          <button 
            className="btn btn-success btn-lg btn-block"
            onClick={handleRegister}
          >
            📝 REGISTRO MANUAL
          </button>
        )}
      </div>

      {/* Quick nav */}
      <div style={{ 
        padding: '12px 24px', 
        display: 'flex', 
        justifyContent: 'center',
        gap: '24px',
        fontSize: '14px'
      }}>
        <Link to="/fmea-aprendendo" className="nav-link">
          📊 Ver FMEA Aprendendo
        </Link>
      </div>
    </div>
  );
}
