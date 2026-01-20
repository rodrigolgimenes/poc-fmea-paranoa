import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useElevenLabs } from '../hooks/useElevenLabs';
import { insights } from '../mock';
import AudioWaveform, { PulsingMic } from '../components/AudioWaveform';

// Form options
const MOMENTO_OPTIONS = [
  { value: 'antes', label: 'Antes do desvio' },
  { value: 'durante', label: 'Durante' },
  { value: 'apos', label: 'Após' }
];

const PERCEPCAO_OPTIONS = [
  { value: 'som_agitador', label: 'Som do agitador / motor' },
  { value: 'viscosidade', label: 'Viscosidade do material' },
  { value: 'brilho_aparencia', label: 'Brilho / aparência superficial' },
  { value: 'bolha_visivel', label: 'Formação de bolhas visível' },
  { value: 'vibracao', label: 'Vibração anormal' }
];

const CAUSA_OPTIONS = [
  { value: 'umidade_materia_prima', label: 'Umidade da matéria-prima' },
  { value: 'materia_prima_diferente', label: 'Matéria-prima diferente' },
  { value: 'setup_recente', label: 'Setup recente' },
  { value: 'manutencao_recente', label: 'Manutenção recente' },
  { value: 'ar_incorporado', label: 'Ar incorporado' },
  { value: 'pressao_injecao', label: 'Pressão de injeção' }
];

// Questions for voice-first audio mode
const QUESTIONS = [
  { 
    key: 'momento', 
    text: 'Quando você percebeu algo diferente? Diga: antes, durante, ou após o desvio.',
    options: MOMENTO_OPTIONS
  },
  { 
    key: 'percepcao', 
    text: 'O que você percebeu de diferente no processo? Por exemplo: som do agitador, viscosidade, bolhas visíveis, ou brilho diferente.',
    options: PERCEPCAO_OPTIONS,
    multiple: true
  },
  { 
    key: 'ajuste', 
    text: 'Você fez algum ajuste no processo? Diga sim ou não.',
    options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]
  },
  { 
    key: 'causa', 
    text: 'Na sua experiência, qual a causa mais provável? Por exemplo: umidade da matéria-prima, setup recente, ar incorporado, ou pressão.',
    options: CAUSA_OPTIONS
  }
];

// Voice-first mode states
const VOICE_STATES = {
  IDLE: 'idle',
  SPEAKING: 'speaking',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  CONFIRMING: 'confirming'
};

export default function Registro() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { getEventById, addObservacao } = useApp();
  const { 
    isLoading,
    isSpeaking, 
    isRecording,
    transcript, 
    error,
    audioData,
    speak, 
    stopSpeaking,
    startRecording,
    stopRecording,
    clearTranscript,
    clearError,
    isAvailable 
  } = useElevenLabs();

  const event = getEventById(eventId);

  // Form state
  const [formData, setFormData] = useState({
    momento: '',
    percepcao: [],
    percepcaoOutro: '',
    ajuste: null,
    frequencia_agitador_hz: '',
    pressao_injecao_bar: '',
    massa_g: '',
    causa_percebida: '',
    causaOutro: ''
  });

  // Voice-first mode state
  const [voiceMode, setVoiceMode] = useState(true); // Start in voice mode by default
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [pendingTranscript, setPendingTranscript] = useState('');

  // Process transcribed response
  const processAudioResponse = useCallback((text) => {
    if (!text) return;
    
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const question = QUESTIONS[currentQuestion];
    let detected = false;
    
    if (question.key === 'momento') {
      if (lower.includes('antes')) {
        setFormData(f => ({ ...f, momento: 'antes' }));
        detected = true;
      } else if (lower.includes('durante')) {
        setFormData(f => ({ ...f, momento: 'durante' }));
        detected = true;
      } else if (lower.includes('apos') || lower.includes('depois')) {
        setFormData(f => ({ ...f, momento: 'apos' }));
        detected = true;
      }
    } else if (question.key === 'percepcao') {
      const detectedItems = [];
      if (lower.includes('som') || lower.includes('agitador') || lower.includes('motor') || lower.includes('barulho')) {
        detectedItems.push('som_agitador');
      }
      if (lower.includes('viscosidade') || lower.includes('viscoso') || lower.includes('grosso') || lower.includes('fino')) {
        detectedItems.push('viscosidade');
      }
      if (lower.includes('brilho') || lower.includes('aparencia') || lower.includes('cor')) {
        detectedItems.push('brilho_aparencia');
      }
      if (lower.includes('bolha') || lower.includes('bolhas')) {
        detectedItems.push('bolha_visivel');
      }
      if (lower.includes('vibra') || lower.includes('tremendo') || lower.includes('tremedeira')) {
        detectedItems.push('vibracao');
      }
      if (detectedItems.length > 0) {
        setFormData(f => ({ ...f, percepcao: [...new Set([...f.percepcao, ...detectedItems])] }));
        detected = true;
      }
    } else if (question.key === 'ajuste') {
      if (lower.includes('sim') || lower.includes('fiz') || lower.includes('ajustei')) {
        setFormData(f => ({ ...f, ajuste: true }));
        detected = true;
      } else if (lower.includes('nao') || lower.includes('nenhum')) {
        setFormData(f => ({ ...f, ajuste: false }));
        detected = true;
      }
    } else if (question.key === 'causa') {
      if (lower.includes('umidade') || lower.includes('umido') || lower.includes('molhado')) {
        setFormData(f => ({ ...f, causa_percebida: 'umidade_materia_prima' }));
        detected = true;
      } else if (lower.includes('setup') || lower.includes('configuracao')) {
        setFormData(f => ({ ...f, causa_percebida: 'setup_recente' }));
        detected = true;
      } else if (lower.includes('ar') || lower.includes('incorporado')) {
        setFormData(f => ({ ...f, causa_percebida: 'ar_incorporado' }));
        detected = true;
      } else if (lower.includes('manutencao')) {
        setFormData(f => ({ ...f, causa_percebida: 'manutencao_recente' }));
        detected = true;
      } else if (lower.includes('pressao')) {
        setFormData(f => ({ ...f, causa_percebida: 'pressao_injecao' }));
        detected = true;
      } else if (lower.includes('materia') || lower.includes('diferente') || lower.includes('lote')) {
        setFormData(f => ({ ...f, causa_percebida: 'materia_prima_diferente' }));
        detected = true;
      }
    }

    return detected;
  }, [currentQuestion]);

  // Start voice mode - ask first question
  const startVoiceMode = useCallback(async () => {
    setVoiceMode(true);
    setCurrentQuestion(0);
    setVoiceState(VOICE_STATES.SPEAKING);
    
    // Speak the first question
    await speak(QUESTIONS[0].text, () => {
      setVoiceState(VOICE_STATES.LISTENING);
      startRecording();
    });
  }, [speak, startRecording]);

  // Handle microphone button click
  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      // Stop recording and process
      setVoiceState(VOICE_STATES.PROCESSING);
      const text = await stopRecording();
      setPendingTranscript(text);
      
      if (text) {
        const detected = processAudioResponse(text);
        setVoiceState(VOICE_STATES.CONFIRMING);
      } else {
        // No transcription, ask again
        setVoiceState(VOICE_STATES.SPEAKING);
        await speak('Desculpe, não consegui entender. Pode repetir?', () => {
          setVoiceState(VOICE_STATES.LISTENING);
          startRecording();
        });
      }
    } else if (voiceState === VOICE_STATES.IDLE || voiceState === VOICE_STATES.CONFIRMING) {
      // Start recording
      setVoiceState(VOICE_STATES.LISTENING);
      clearTranscript();
      startRecording();
    }
  }, [isRecording, voiceState, stopRecording, processAudioResponse, speak, startRecording, clearTranscript]);

  // Move to next question
  const goToNextQuestion = useCallback(async () => {
    clearTranscript();
    setPendingTranscript('');
    const nextIndex = currentQuestion + 1;
    
    if (nextIndex < QUESTIONS.length) {
      setCurrentQuestion(nextIndex);
      setVoiceState(VOICE_STATES.SPEAKING);
      
      await speak(QUESTIONS[nextIndex].text, () => {
        setVoiceState(VOICE_STATES.LISTENING);
        startRecording();
      });
    } else {
      // All questions answered
      setVoiceState(VOICE_STATES.IDLE);
      setVoiceMode(false);
    }
  }, [currentQuestion, speak, startRecording, clearTranscript]);

  // Skip current question
  const skipQuestion = useCallback(() => {
    goToNextQuestion();
  }, [goToNextQuestion]);

  // Handle option selection (touch)
  const handleOptionSelect = useCallback((value) => {
    const question = QUESTIONS[currentQuestion];
    
    if (question.key === 'momento') {
      setFormData(f => ({ ...f, momento: value }));
    } else if (question.key === 'percepcao') {
      setFormData(f => ({
        ...f,
        percepcao: f.percepcao.includes(value)
          ? f.percepcao.filter(p => p !== value)
          : [...f.percepcao, value]
      }));
    } else if (question.key === 'ajuste') {
      setFormData(f => ({ ...f, ajuste: value === 'sim' }));
    } else if (question.key === 'causa') {
      setFormData(f => ({ ...f, causa_percebida: value }));
    }
  }, [currentQuestion]);

  // Form handlers for manual mode
  const togglePercepcao = (value) => {
    setFormData(f => ({
      ...f,
      percepcao: f.percepcao.includes(value)
        ? f.percepcao.filter(p => p !== value)
        : [...f.percepcao, value]
    }));
  };

  const handleSubmit = () => {
    const observacao = {
      event_id: eventId,
      equipamento: event?.equipamento || 'Injetora PU 02',
      modo_falha: event?.modo_falha_sugerido || 'Bolhas no material',
      momento: formData.momento,
      percepcao: formData.percepcao,
      acao: {
        ajuste: formData.ajuste || false,
        ...(formData.frequencia_agitador_hz && { frequencia_agitador_hz: parseInt(formData.frequencia_agitador_hz) }),
        ...(formData.pressao_injecao_bar && { pressao_injecao_bar: parseInt(formData.pressao_injecao_bar) }),
        ...(formData.massa_g && { massa_g: parseInt(formData.massa_g) })
      },
      causa_percebida: formData.causa_percebida,
      resolveu: null
    };

    const registroId = addObservacao(observacao);
    navigate(`/confirmacao/${registroId}`);
  };

  // Get current question's selected value for display
  const getCurrentValue = () => {
    const question = QUESTIONS[currentQuestion];
    if (!question) return null;
    
    if (question.key === 'momento') return formData.momento;
    if (question.key === 'percepcao') return formData.percepcao;
    if (question.key === 'ajuste') return formData.ajuste === true ? 'sim' : formData.ajuste === false ? 'nao' : null;
    if (question.key === 'causa') return formData.causa_percebida;
    return null;
  };

  // Recommendation display
  const recommendation = insights.recomendacao_causa_provavel;

  // Auto-start voice mode on mount if API available
  useEffect(() => {
    if (isAvailable && voiceMode && voiceState === VOICE_STATES.IDLE && event) {
      // Small delay before starting
      const timer = setTimeout(() => {
        startVoiceMode();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAvailable, event]);

  if (!event) {
    return (
      <div className="page">
        <p>Evento não encontrado</p>
        <button className="btn btn-primary" onClick={() => navigate('/monitor')}>
          Voltar ao Monitor
        </button>
      </div>
    );
  }

  const currentQ = QUESTIONS[currentQuestion];
  const currentValue = getCurrentValue();

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">REGISTRAR PERCEPÇÃO</h1>
          <p className="page-subtitle">
            Modo de falha: {event.modo_falha_sugerido}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Voice/Manual mode toggle */}
          <button 
            className={`btn ${voiceMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              if (voiceMode) {
                stopSpeaking();
                if (isRecording) stopRecording();
                setVoiceMode(false);
                setVoiceState(VOICE_STATES.IDLE);
              } else {
                startVoiceMode();
              }
            }}
            style={{ padding: '8px 16px', minHeight: '48px' }}
          >
            {voiceMode ? '📝 Modo Manual' : '🎤 Modo Voz'}
          </button>
        </div>
      </header>

      {/* Context card */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '14px', alignItems: 'center' }}>
          <span><strong>Equip.:</strong> {event.equipamento}</span>
          <span><strong>CEP:</strong> {event.variavel_cep} {event.valor_atual} {event.unidade}</span>
          <span className={`status-badge ${event.status}`} style={{ padding: '4px 12px' }}>
            {event.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="card" style={{ 
          background: 'rgba(230, 57, 70, 0.1)', 
          borderLeft: '4px solid var(--color-danger)',
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {error}</span>
            <button 
              className="btn btn-secondary"
              style={{ padding: '4px 12px', minHeight: '32px', fontSize: '14px' }}
              onClick={clearError}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Voice-First Mode UI */}
      {voiceMode ? (
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Progress indicator */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '8px',
            padding: '8px'
          }}>
            {QUESTIONS.map((_, index) => (
              <div 
                key={index}
                style={{
                  width: '40px',
                  height: '6px',
                  borderRadius: '3px',
                  background: index < currentQuestion ? 'var(--color-success)' :
                             index === currentQuestion ? 'var(--color-primary)' : 'var(--color-bg-input)'
                }}
              />
            ))}
          </div>

          {/* Question display */}
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ 
              fontSize: '14px', 
              color: 'var(--color-text-muted)',
              marginBottom: '8px'
            }}>
              Pergunta {currentQuestion + 1} de {QUESTIONS.length}
            </div>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600',
              lineHeight: '1.4'
            }}>
              {currentQ?.text}
            </h2>
          </div>

          {/* Audio visualization and mic button */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '16px',
            padding: '16px'
          }}>
            {/* Waveform visualization */}
            {(isRecording || voiceState === VOICE_STATES.LISTENING) && (
              <AudioWaveform 
                audioData={audioData} 
                isRecording={isRecording}
                height={60}
                barCount={24}
              />
            )}

            {/* Mic button */}
            <PulsingMic
              isRecording={isRecording}
              isLoading={isLoading}
              isSpeaking={isSpeaking}
              onClick={handleMicClick}
              disabled={isSpeaking || isLoading}
            />

            {/* Transcript display */}
            {(pendingTranscript || transcript) && (
              <div style={{
                background: 'var(--color-bg-input)',
                padding: '16px',
                borderRadius: '12px',
                width: '100%',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Você disse:
                </div>
                <div style={{ fontSize: '18px', fontStyle: 'italic' }}>
                  "{pendingTranscript || transcript}"
                </div>
              </div>
            )}
          </div>

          {/* Touch options (can also tap instead of speak) */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              color: 'var(--color-text-muted)',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              Ou toque em uma opção:
            </div>
            <div className="option-group" style={{ justifyContent: 'center' }}>
              {currentQ?.options.map(opt => {
                const isSelected = currentQ.multiple 
                  ? (currentValue || []).includes(opt.value)
                  : currentValue === opt.value;
                  
                return (
                  <label 
                    key={opt.value}
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(opt.value)}
                    style={{ minWidth: '120px', justifyContent: 'center' }}
                  >
                    <span className="check-icon"></span>
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            padding: '0 16px',
            marginTop: 'auto'
          }}>
            <button 
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={skipQuestion}
              disabled={isSpeaking || isLoading}
            >
              Pular
            </button>
            <button 
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={goToNextQuestion}
              disabled={isSpeaking || isLoading || isRecording}
            >
              {currentQuestion < QUESTIONS.length - 1 ? 'Próxima →' : 'Concluir ✓'}
            </button>
          </div>
        </div>
      ) : (
        /* Manual Form Mode */
        <div className="page-content">
          {/* AI Recommendation */}
          {recommendation && (
            <div className="card" style={{ 
              background: 'rgba(72, 202, 228, 0.1)', 
              borderLeft: '4px solid var(--color-info)',
              padding: '16px'
            }}>
              <div style={{ fontSize: '14px', color: 'var(--color-info)', marginBottom: '4px' }}>
                💡 Causa provável (beta) — {Math.round(recommendation.confianca * 100)}% confiança
              </div>
              <div style={{ fontWeight: '600' }}>
                {CAUSA_OPTIONS.find(c => c.value === recommendation.causa)?.label || recommendation.causa}
              </div>
            </div>
          )}

          {/* 1) Momento */}
          <div className="form-group">
            <label className="form-label">1) Quando você percebeu algo diferente?</label>
            <div className="option-group">
              {MOMENTO_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.momento === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData(f => ({ ...f, momento: opt.value }))}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 2) Percepção */}
          <div className="form-group">
            <label className="form-label">2) O que você percebeu? (marque rápido)</label>
            <div className="option-group">
              {PERCEPCAO_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.percepcao.includes(opt.value) ? 'selected' : ''}`}
                  onClick={() => togglePercepcao(opt.value)}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 3) Ajuste */}
          <div className="form-group">
            <label className="form-label">3) Houve algum ajuste?</label>
            <div className="option-group">
              <label 
                className={`option-card ${formData.ajuste === false ? 'selected' : ''}`}
                onClick={() => setFormData(f => ({ ...f, ajuste: false }))}
              >
                <span className="check-icon"></span>
                Não
              </label>
              <label 
                className={`option-card ${formData.ajuste === true ? 'selected' : ''}`}
                onClick={() => setFormData(f => ({ ...f, ajuste: true }))}
              >
                <span className="check-icon"></span>
                Sim
              </label>
            </div>

            {formData.ajuste && (
              <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Freq. agitador:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="50"
                    value={formData.frequencia_agitador_hz}
                    onChange={(e) => setFormData(f => ({ ...f, frequencia_agitador_hz: e.target.value }))}
                  />
                  <span className="unit">Hz (ref: 50)</span>
                </div>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Pressão injeção:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="165"
                    value={formData.pressao_injecao_bar}
                    onChange={(e) => setFormData(f => ({ ...f, pressao_injecao_bar: e.target.value }))}
                  />
                  <span className="unit">bar</span>
                </div>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Qtd. massa:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="1000"
                    value={formData.massa_g}
                    onChange={(e) => setFormData(f => ({ ...f, massa_g: e.target.value }))}
                  />
                  <span className="unit">g (ref: 1000)</span>
                </div>
              </div>
            )}
          </div>

          {/* 4) Causa percebida */}
          <div className="form-group">
            <label className="form-label">4) Na sua experiência, isso acontece quando:</label>
            <div className="option-group">
              {CAUSA_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.causa_percebida === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData(f => ({ ...f, causa_percebida: opt.value }))}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions - only show in manual mode or when voice mode is complete */}
      {!voiceMode && (
        <div className="bottom-bar">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/monitor')}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={!formData.momento}
          >
            ✓ SALVAR REGISTRO
          </button>
        </div>
      )}

      {/* Voice mode bottom bar */}
      {voiceMode && (
        <div className="bottom-bar">
          <button 
            className="btn btn-secondary"
            onClick={() => {
              stopSpeaking();
              if (isRecording) stopRecording();
              navigate('/monitor');
            }}
            style={{ flex: 1 }}
          >
            ✕ Cancelar
          </button>
          {currentQuestion === QUESTIONS.length - 1 && (
            <button 
              className="btn btn-success"
              onClick={() => {
                setVoiceMode(false);
                handleSubmit();
              }}
              disabled={!formData.momento}
              style={{ flex: 2 }}
            >
              ✓ SALVAR REGISTRO
            </button>
          )}
        </div>
      )}
    </div>
  );
}
              onClick={startAudioMode}
              title="Modo áudio"
            >
              🎤
            </button>
          )}
        </div>
      </header>

      {/* Context card */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px' }}>
          <span><strong>Equip.:</strong> {event.equipamento}</span>
          <span><strong>CEP:</strong> {event.variavel_cep} {event.valor_atual} {event.unidade}</span>
          <span className={`status-badge ${event.status}`} style={{ padding: '4px 12px' }}>
            {event.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* AI Recommendation */}
      {recommendation && (
        <div className="card" style={{ 
          background: 'rgba(72, 202, 228, 0.1)', 
          borderLeft: '4px solid var(--color-info)',
          padding: '16px'
        }}>
          <div style={{ fontSize: '14px', color: 'var(--color-info)', marginBottom: '4px' }}>
            💡 Causa provável (beta) — {Math.round(recommendation.confianca * 100)}% confiança
          </div>
          <div style={{ fontWeight: '600' }}>
            {CAUSA_OPTIONS.find(c => c.value === recommendation.causa)?.label || recommendation.causa}
          </div>
        </div>
      )}

      {/* Audio Mode UI */}
      {audioMode ? (
        <div className="page-content">
          <div className="audio-mode">
            <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>
              {QUESTIONS[currentQuestion]?.text}
            </h2>
            
            <button 
              className={`btn btn-primary audio-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={isSpeaking}
            >
              {isSpeaking ? '🔊' : isListening ? '🎤' : '🎤'}
            </button>
            
            <div className="audio-transcript">
              {transcript || (isListening ? 'Ouvindo...' : 'Toque para falar')}
            </div>

            <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={skipQuestion}
              >
                Pular
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={nextQuestion}
                disabled={isListening || isSpeaking}
              >
                Próximo
              </button>
            </div>

            <button 
              className="btn btn-secondary btn-block"
              onClick={() => setAudioMode(false)}
            >
              Voltar ao formulário
            </button>
          </div>
        </div>
      ) : (
        /* Form Mode */
        <div className="page-content">
          {/* 1) Momento */}
          <div className="form-group">
            <label className="form-label">1) Quando você percebeu algo diferente?</label>
            <div className="option-group">
              {MOMENTO_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.momento === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData(f => ({ ...f, momento: opt.value }))}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 2) Percepção */}
          <div className="form-group">
            <label className="form-label">2) O que você percebeu? (marque rápido)</label>
            <div className="option-group">
              {PERCEPCAO_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.percepcao.includes(opt.value) ? 'selected' : ''}`}
                  onClick={() => togglePercepcao(opt.value)}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
            <input 
              type="text"
              className="input"
              placeholder="Outro (descreva em poucas palavras)"
              value={formData.percepcaoOutro}
              onChange={(e) => setFormData(f => ({ ...f, percepcaoOutro: e.target.value }))}
              style={{ marginTop: '12px' }}
            />
          </div>

          {/* 3) Ajuste */}
          <div className="form-group">
            <label className="form-label">3) Houve algum ajuste?</label>
            <div className="option-group">
              <label 
                className={`option-card ${formData.ajuste === false ? 'selected' : ''}`}
                onClick={() => setFormData(f => ({ ...f, ajuste: false }))}
              >
                <span className="check-icon"></span>
                Não
              </label>
              <label 
                className={`option-card ${formData.ajuste === true ? 'selected' : ''}`}
                onClick={() => setFormData(f => ({ ...f, ajuste: true }))}
              >
                <span className="check-icon"></span>
                Sim
              </label>
            </div>

            {formData.ajuste && (
              <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Freq. agitador:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="50"
                    value={formData.frequencia_agitador_hz}
                    onChange={(e) => setFormData(f => ({ ...f, frequencia_agitador_hz: e.target.value }))}
                  />
                  <span className="unit">Hz (ref: 50)</span>
                </div>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Pressão injeção:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="165"
                    value={formData.pressao_injecao_bar}
                    onChange={(e) => setFormData(f => ({ ...f, pressao_injecao_bar: e.target.value }))}
                  />
                  <span className="unit">bar</span>
                </div>
                <div className="input-row">
                  <label style={{ minWidth: '180px' }}>Qtd. massa:</label>
                  <input 
                    type="number"
                    className="input"
                    placeholder="1000"
                    value={formData.massa_g}
                    onChange={(e) => setFormData(f => ({ ...f, massa_g: e.target.value }))}
                  />
                  <span className="unit">g (ref: 1000)</span>
                </div>
              </div>
            )}
          </div>

          {/* 4) Causa percebida */}
          <div className="form-group">
            <label className="form-label">4) Na sua experiência, isso acontece quando:</label>
            <div className="option-group">
              {CAUSA_OPTIONS.map(opt => (
                <label 
                  key={opt.value}
                  className={`option-card ${formData.causa_percebida === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData(f => ({ ...f, causa_percebida: opt.value }))}
                >
                  <span className="check-icon"></span>
                  {opt.label}
                </label>
              ))}
            </div>
            <input 
              type="text"
              className="input"
              placeholder="Outro (descreva em poucas palavras)"
              value={formData.causaOutro}
              onChange={(e) => setFormData(f => ({ ...f, causaOutro: e.target.value }))}
              style={{ marginTop: '12px' }}
            />
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {!audioMode && (
        <div className="bottom-bar">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/monitor')}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={!formData.momento}
          >
            ✓ SALVAR REGISTRO
          </button>
        </div>
      )}
    </div>
  );
}
