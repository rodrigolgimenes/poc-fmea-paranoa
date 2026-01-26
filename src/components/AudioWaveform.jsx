import { useEffect, useRef, useState } from 'react';

/**
 * AudioLevelMeter - Medidor de nível de áudio em tempo real
 * Recebe o MediaStream diretamente e cria seu próprio analyser
 * Baseado na implementação do InsightScribe
 */
export default function AudioLevelMeter({ 
  stream = null,       // MediaStream do microfone
  isRecording = false, // Se está gravando
  barCount = 24,       // Número de barras
  height = 60,         // Altura do componente
}) {
  const [levels, setLevels] = useState(() => Array(barCount).fill(0));
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const smoothedLevelsRef = useRef(Array(barCount).fill(0));

  useEffect(() => {
    // Se não está gravando ou não tem stream, mostrar barras zeradas
    if (!isRecording || !stream) {
      setLevels(Array(barCount).fill(0));
      return;
    }

    // Verificar se o stream tem tracks de áudio
    if (!stream.getAudioTracks || stream.getAudioTracks().length === 0) {
      console.warn('[AudioLevelMeter] Stream sem tracks de áudio');
      return;
    }

    console.log('[AudioLevelMeter] Configurando analyser com stream');

    try {
      // Criar AudioContext
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      
      // Criar analyser
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.4;
      
      // Conectar stream ao analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      // Função de atualização
      const updateLevels = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Dividir frequências em barCount grupos
        const step = Math.floor(dataArray.length / barCount);
        const newLevels = [];
        
        for (let i = 0; i < barCount; i++) {
          // Pegar média do grupo de frequências
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j] || 0;
          }
          const avg = sum / step;
          const normalized = avg / 255;
          
          // Smoothing: subida rápida, descida suave
          const prev = smoothedLevelsRef.current[i] || 0;
          const smoothed = normalized > prev 
            ? normalized 
            : prev * 0.85 + normalized * 0.15;
          
          smoothedLevelsRef.current[i] = smoothed;
          newLevels.push(smoothed);
        }
        
        setLevels(newLevels);
        animationRef.current = requestAnimationFrame(updateLevels);
      };
      
      updateLevels();
      
    } catch (error) {
      console.error('[AudioLevelMeter] Erro ao configurar:', error);
    }

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      smoothedLevelsRef.current = Array(barCount).fill(0);
    };
  }, [stream, isRecording, barCount]);

  // Calcular se há som sendo captado
  const hasSound = levels.some(l => l > 0.05);
  const maxLevel = Math.max(...levels);
  const isClipping = maxLevel > 0.95;

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
        }}>
          ⚠️ VOLUME ALTO
        </div>
      )}
      
      {/* Barras do medidor */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '2px',
        height: `${height}px`,
      }}>
        {levels.map((level, index) => {
          const barHeight = Math.max(4, level * height);
          const position = index / barCount;
          
          // Cor baseada no nível
          let color = '#3a3a3a';
          if (level > 0.05) {
            if (level > 0.85) color = '#e63946'; // Vermelho
            else if (level > 0.6) color = '#f5a623'; // Amarelo
            else color = '#4caf50'; // Verde
          }
          
          return (
            <div
              key={index}
              style={{
                width: '6px',
                height: `${barHeight}px`,
                backgroundColor: color,
                borderRadius: '2px',
                transition: 'height 0.05s ease-out',
              }}
            />
          );
        })}
      </div>
      
      {/* Status */}
      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        color: hasSound ? '#4caf50' : '#666',
      }}>
        {isRecording 
          ? (hasSound ? '🎙️ Captando áudio...' : '🎙️ Aguardando som...') 
          : '🎙️ Microfone'
        }
      </div>
    </div>
  );
}

// Export para compatibilidade
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
