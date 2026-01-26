/**
 * AudioLevelMeter (VU Meter) - Medidor de nível de áudio em tempo real
 * Exibe barras que representam a intensidade (RMS) do áudio captado
 * 
 * Comportamento:
 * - Silêncio: barras estáticas no mínimo
 * - Falando: barras sobem proporcionalmente ao volume
 * - Clipping: indicador visual quando estourando
 */
export default function AudioLevelMeter({ 
  audioLevel = 0,      // Nível RMS normalizado (0-1)
  peakLevel = 0,       // Nível de pico (0-1)
  isClipping = false,  // Indicador de clipping
  isRecording = false, // Se está gravando
  barCount = 20,       // Número de barras
  height = 60,         // Altura do componente
}) {
  // Calcular quantas barras devem estar acesas
  const activeBars = Math.round(audioLevel * barCount);
  const peakBar = Math.round(peakLevel * barCount);
  
  // Cores das barras baseado na posição (verde -> amarelo -> vermelho)
  const getBarColor = (index, isActive) => {
    if (!isActive && index !== peakBar) return '#3a3a3a'; // Inativa
    
    const position = index / barCount;
    if (position > 0.85) return '#e63946'; // Vermelho (zona de clipping)
    if (position > 0.65) return '#f5a623'; // Amarelo (zona de atenção)
    return '#4caf50'; // Verde (zona segura)
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 16px',
      background: '#2d2d2d',
      borderRadius: '12px',
      border: isClipping ? '2px solid #e63946' : '2px solid transparent',
    }}>
      {/* Indicador de clipping */}
      {isClipping && (
        <div style={{
          textAlign: 'center',
          color: '#e63946',
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          ⚠️ VOLUME ALTO
        </div>
      )}
      
      {/* Barras do VU Meter */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '3px',
        height: `${height}px`,
      }}>
        {Array(barCount).fill(0).map((_, index) => {
          const isActive = index < activeBars;
          const isPeak = index === peakBar - 1 && peakBar > activeBars;
          const barHeight = isRecording 
            ? (isActive ? height * (0.3 + (index / barCount) * 0.7) : height * 0.15)
            : height * 0.15;
          
          return (
            <div
              key={index}
              style={{
                width: '8px',
                height: `${barHeight}px`,
                backgroundColor: getBarColor(index, isActive || isPeak),
                borderRadius: '2px',
                transition: 'height 0.05s ease-out, background-color 0.1s ease',
                opacity: isActive || isPeak ? 1 : 0.3,
              }}
            />
          );
        })}
      </div>
      
      {/* Labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: '#666',
      }}>
        <span>BAIXO</span>
        <span style={{ color: isRecording && audioLevel > 0 ? '#4caf50' : '#666' }}>
          {isRecording ? (audioLevel > 0 ? '🎙️ Captando...' : '🎙️ Aguardando...') : '🎙️ Microfone'}
        </span>
        <span>ALTO</span>
      </div>
    </div>
  );
}

// Manter export do nome antigo para compatibilidade
export { AudioLevelMeter as AudioWaveform };

/**
 * PulsingMic - Animated microphone button with pulse effect
 */
export function PulsingMic({ 
  isRecording, 
  isLoading,
  isSpeaking,
  onClick,
  disabled 
}) {
  const getIcon = () => {
    if (isLoading) return '⏳';
    if (isSpeaking) return '🔊';
    if (isRecording) return '⏹️';
    return '🎤';
  };

  const getLabel = () => {
    if (isLoading) return 'Processando...';
    if (isSpeaking) return 'Ouvindo...';
    if (isRecording) return 'Toque para parar';
    return 'Toque para falar';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <button
        className={`btn btn-primary audio-button ${isRecording ? 'recording' : ''} ${isSpeaking ? 'speaking' : ''}`}
        onClick={onClick}
        disabled={disabled || isLoading}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          fontSize: '48px',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Pulse rings for recording */}
        {isRecording && (
          <>
            <span className="pulse-ring" style={{ animationDelay: '0s' }} />
            <span className="pulse-ring" style={{ animationDelay: '0.5s' }} />
            <span className="pulse-ring" style={{ animationDelay: '1s' }} />
          </>
        )}
        
        {/* Speaking waves */}
        {isSpeaking && (
          <span className="speaking-waves" />
        )}
        
        {getIcon()}
      </button>
      
      <span style={{ 
        fontSize: '14px', 
        color: isRecording ? 'var(--color-danger)' : 'var(--color-text-muted)',
        fontWeight: isRecording ? '600' : '400'
      }}>
        {getLabel()}
      </span>
    </div>
  );
}

// Add styles for animations
const style = document.createElement('style');
style.textContent = `
  .audio-button {
    position: relative;
  }
  
  .audio-button.recording {
    background: var(--color-danger) !important;
    animation: recordingPulse 1s infinite;
  }
  
  .audio-button.speaking {
    background: var(--color-info) !important;
  }
  
  @keyframes recordingPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  .pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid var(--color-danger);
    border-radius: 50%;
    animation: pulseRing 1.5s infinite;
    pointer-events: none;
  }
  
  @keyframes pulseRing {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }
  
  .speaking-waves {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid var(--color-info);
    border-radius: 50%;
    animation: speakingWave 0.8s infinite;
    pointer-events: none;
  }
  
  @keyframes speakingWave {
    0%, 100% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
  }
`;
document.head.appendChild(style);
