import { useState, useEffect, useRef } from 'react';

// Altura minima das barras quando em silêncio
const MIN_BAR_HEIGHT = 4;
// Threshold para considerar que há som (ajuste conforme necessário)
const SOUND_THRESHOLD = 15;

/**
 * AudioWaveform - Visual feedback component for audio recording
 * Barras só se movem quando detecta som/voz do usuário (como equalizador real)
 */
export default function AudioWaveform({ 
  audioData, 
  isRecording, 
  barCount = 32,
  height = 80,
  barColor = 'var(--color-primary)',
  activeColor = 'var(--color-success)'
}) {
  const [bars, setBars] = useState(() => 
    Array(barCount).fill(0).map(() => ({ height: MIN_BAR_HEIGHT, active: false }))
  );
  const animationRef = useRef(null);

  // Process audio data into bar heights - reage apenas ao som real
  useEffect(() => {
    const updateBars = () => {
      // Se não está gravando, mostrar barras mínimas estáticas
      if (!isRecording) {
        setBars(Array(barCount).fill(0).map(() => ({ 
          height: MIN_BAR_HEIGHT, 
          active: false 
        })));
        return;
      }

      // Se está gravando mas sem dados de áudio, mostrar barras mínimas
      if (!audioData || audioData.length === 0) {
        setBars(Array(barCount).fill(0).map(() => ({ 
          height: MIN_BAR_HEIGHT, 
          active: false 
        })));
        animationRef.current = requestAnimationFrame(updateBars);
        return;
      }

      // Calcular volume médio para detectar se há som
      let totalVolume = 0;
      for (let i = 0; i < audioData.length; i++) {
        totalVolume += audioData[i];
      }
      const avgVolume = totalVolume / audioData.length;
      const hasSpeech = avgVolume > SOUND_THRESHOLD;

      // Sample the audio data to match bar count
      const step = Math.max(1, Math.floor(audioData.length / barCount));
      const newBars = Array(barCount).fill(0).map((_, i) => {
        const index = Math.min(i * step, audioData.length - 1);
        const value = audioData[index] || 0;
        
        // Se não há fala detectada, manter barras mínimas
        if (!hasSpeech) {
          return {
            height: MIN_BAR_HEIGHT,
            active: false
          };
        }
        
        // Amplificar o valor para melhor visualização quando há som
        const amplifiedValue = Math.min(255, value * 2);
        const normalizedHeight = (amplifiedValue / 255) * height;
        return {
          height: Math.max(MIN_BAR_HEIGHT, normalizedHeight),
          active: value > SOUND_THRESHOLD
        };
      });
      setBars(newBars);
      
      // Continuar atualizando durante gravação
      animationRef.current = requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, isRecording, barCount, height]);

  return (
    <div 
      className="audio-waveform"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        height: `${height}px`,
        padding: '16px',
        background: 'var(--color-bg-input)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
    >
      {bars.map((bar, index) => (
        <div
          key={index}
          style={{
            width: '6px',
            height: `${bar.height}px`,
            backgroundColor: bar.active ? activeColor : barColor,
            borderRadius: '3px',
            transition: isRecording ? 'height 0.05s ease' : 'height 0.3s ease',
            opacity: isRecording ? 1 : 0.5
          }}
        />
      ))}
    </div>
  );
}

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
