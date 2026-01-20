import { createContext, useContext, useState, useCallback } from 'react';
import { events as initialEvents, observacoes as initialObservacoes } from '../mock';

const AppContext = createContext(null);

// Simulation mode for CEP alerts
const SIMULATION_MODES = {
  NORMAL: 'normal',
  TENDENCIA: 'tendencia',
  DESVIO: 'desvio'
};

export function AppProvider({ children }) {
  const [events, setEvents] = useState(initialEvents);
  const [observacoes, setObservacoes] = useState(initialObservacoes);
  const [simulationMode, setSimulationMode] = useState(SIMULATION_MODES.TENDENCIA);
  const [currentTurno, setCurrentTurno] = useState('B');

  // Get current event based on simulation mode
  const getCurrentEvent = useCallback(() => {
    if (simulationMode === SIMULATION_MODES.NORMAL) {
      return events.find(e => e.status === 'normal') || events[1];
    } else if (simulationMode === SIMULATION_MODES.DESVIO) {
      return events.find(e => e.status === 'desvio') || events[3];
    }
    // Default: tendencia
    return events.find(e => e.status === 'tendencia') || events[0];
  }, [events, simulationMode]);

  // Get event by ID
  const getEventById = useCallback((eventId) => {
    return events.find(e => e.event_id === eventId);
  }, [events]);

  // Add new observation
  const addObservacao = useCallback((observacao) => {
    const newId = `OBS-${String(observacoes.length + 41).padStart(5, '0')}`;
    const newObservacao = {
      ...observacao,
      registro_id: newId,
      timestamp: new Date().toISOString(),
      turno: currentTurno
    };
    setObservacoes(prev => [...prev, newObservacao]);
    return newId;
  }, [observacoes.length, currentTurno]);

  // Get observation by ID
  const getObservacaoById = useCallback((registroId) => {
    return observacoes.find(o => o.registro_id === registroId);
  }, [observacoes]);

  // Calculate stats for FMEA Aprendendo
  const getStats = useCallback(() => {
    const last30Days = observacoes; // In real app, filter by date
    
    // Count perceptions
    const percepcaoCount = {};
    const causaCount = {};
    const acoesEfetivas = {};

    last30Days.forEach(obs => {
      // Count perceptions
      obs.percepcao?.forEach(p => {
        percepcaoCount[p] = (percepcaoCount[p] || 0) + 1;
      });
      
      // Count causes
      if (obs.causa_percebida) {
        causaCount[obs.causa_percebida] = (causaCount[obs.causa_percebida] || 0) + 1;
      }

      // Track effective actions
      if (obs.acao?.ajuste && obs.resolveu !== null) {
        const acaoKey = obs.acao.frequencia_agitador_hz ? 'ajustar_agitador' : 
                       obs.acao.pressao_injecao_bar ? 'reduzir_pressao' : 
                       obs.acao.massa_g ? 'ajustar_massa' : null;
        if (acaoKey) {
          if (!acoesEfetivas[acaoKey]) {
            acoesEfetivas[acaoKey] = { total: 0, resolveu: 0 };
          }
          acoesEfetivas[acaoKey].total++;
          if (obs.resolveu) acoesEfetivas[acaoKey].resolveu++;
        }
      }
    });

    return {
      totalRegistros: last30Days.length,
      totalTendencias: events.filter(e => e.status === 'tendencia').length,
      totalDesvios: events.filter(e => e.status === 'desvio').length,
      topPercepcoes: Object.entries(percepcaoCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topCausas: Object.entries(causaCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      acoesEfetivas: Object.entries(acoesEfetivas)
        .map(([key, val]) => ({ acao: key, ...val }))
    };
  }, [observacoes, events]);

  const value = {
    events,
    observacoes,
    simulationMode,
    setSimulationMode,
    currentTurno,
    setCurrentTurno,
    getCurrentEvent,
    getEventById,
    addObservacao,
    getObservacaoById,
    getStats,
    SIMULATION_MODES
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export { SIMULATION_MODES };
