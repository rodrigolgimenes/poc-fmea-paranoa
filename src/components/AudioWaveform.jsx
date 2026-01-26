import { useState, useEffect, useRef } from 'react';

/**
 * AudioWaveform - Visual feedback component for audio recording
 * Displays animated bars based on audio frequency data
 */
export default function AudioWaveform({ 
  audioData, 
  isRecording, 
  barCount = 32,
  height = 80,
  barColor = 'var(--color-primary)',
  activeColor = 'var(--color-success)'
}) {
  const [bars, setBars] = useState([]);
  const animationRef = useRef(null);
  const idlePhaseRef = useRef(0);

  // Process audio data into bar heights - atualiza continuamente durante gravação
  useEffect(() => {
    const updateBars = () => {
      if (!isRecording) {
        // Animação idle suave quando não está gravando
        idlePhaseRef.current += 0.05;
        const idleBars = Array(barCount).fill(0).map((_, i) => ({
          height: 8 + Math.sin(idlePhaseRef.current + i * 0.3) * 4,
          active: false
        }));
        setBars(idleBars);
        animationRef.current = requestAnimationFrame(updateBars);
        return;
      }

      if (!audioData || audioData.length === 0) {
        // Gravando mas sem dados ainda - mostrar barras pulsando
        idlePhaseRef.current += 0.1;
        const waitingBars = Array(barCount).fill(0).map((_, i) => ({
          height: 10 + Math.sin(idlePhaseRef.current + i * 0.2) * 6,
          active: true
        }));
        setBars(waitingBars);
        animationRef.current = requestAnimationFrame(updateBars);
        return;
      }

      // Sample the audio data to match bar count
      const step = Math.max(1, Math.floor(audioData.length / barCount));
      const newBars = Array(barCount).fill(0).map((_, i) => {
        const index = Math.min(i * step, audioData.length - 1);
        const value = audioData[index] || 0;
        // Amplificar o valor para melhor visualização
        const amplifiedValue = Math.min(255, value * 1.5);
        const normalizedHeight = (amplifiedValue / 255) * height;
        return {
          height: Math.max(6, normalizedHeight),
          active: value > 30
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
