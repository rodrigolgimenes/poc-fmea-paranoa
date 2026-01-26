import { useState, useRef, useCallback, useEffect } from 'react';

// Configurações do medidor de nível
const SILENCE_THRESHOLD = 0.01; // Abaixo disso é considerado silêncio
const SMOOTHING_FACTOR = 0.3;   // Suavização do movimento (0-1, maior = mais suave)
const UPDATE_INTERVAL_MS = 50;  // ~20 FPS para economia de CPU

/**
 * Hook para gravação de áudio com medidor de nível (VU Meter)
 * Calcula RMS (Root Mean Square) para intensidade real do áudio
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null); // MediaStream para visualização
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const smoothedLevelRef = useRef(0);
  const peakHoldRef = useRef(0);
  const peakDecayTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup - inline to avoid dependency issues
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update duration while recording
  useEffect(() => {
    let intervalId;
    if (isRecording && !isPaused && startTimeRef.current) {
      intervalId = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRecording, isPaused]);

  // Calcular nível RMS do áudio (medidor de intensidade real)
  const measureAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);
    
    // Calcular RMS (Root Mean Square) - métrica padrão para volume de áudio
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = dataArray[i];
      sumSquares += sample * sample;
      const absSample = Math.abs(sample);
      if (absSample > peak) peak = absSample;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    
    // Normalizar para 0-1 (RMS tipicamente fica entre 0 e ~0.5 para áudio normal)
    const normalizedRms = Math.min(1, rms * 3);
    
    // Aplicar threshold de silêncio
    const finalLevel = normalizedRms < SILENCE_THRESHOLD ? 0 : normalizedRms;
    
    // Smoothing: suavizar transições para evitar tremores
    // Subida rápida, descida suave
    if (finalLevel > smoothedLevelRef.current) {
      smoothedLevelRef.current = finalLevel; // Subida instantânea
    } else {
      smoothedLevelRef.current = smoothedLevelRef.current * (1 - SMOOTHING_FACTOR) + finalLevel * SMOOTHING_FACTOR;
    }
    
    // Se abaixo do threshold após smoothing, zerar
    if (smoothedLevelRef.current < SILENCE_THRESHOLD) {
      smoothedLevelRef.current = 0;
    }
    
    setAudioLevel(smoothedLevelRef.current);
    
    // Peak hold com decay (pico cai lentamente)
    if (peak > peakHoldRef.current) {
      peakHoldRef.current = peak;
      peakDecayTimeRef.current = Date.now();
    } else if (Date.now() - peakDecayTimeRef.current > 1000) {
      // Decay do pico após 1 segundo
      peakHoldRef.current *= 0.95;
    }
    setPeakLevel(Math.min(1, peakHoldRef.current * 2));
    
    // Detectar clipping (>95% do máximo)
    setIsClipping(peak > 0.95);
    
    // Continuar medindo
    animationFrameRef.current = setTimeout(() => {
      requestAnimationFrame(measureAudioLevel);
    }, UPDATE_INTERVAL_MS);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;
      setStream(stream); // Expor stream para visualização
      
      // Setup audio context para medição de nível
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Maior precisão para RMS
      analyserRef.current.smoothingTimeConstant = 0; // Sem smoothing do analyser (fazemos manual)
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Reset dos valores de medidor
      smoothedLevelRef.current = 0;
      peakHoldRef.current = 0;
      
      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Revoke old URL
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      
      // Iniciar medição de nível
      measureAudioLevel();
      
    } catch (err) {
      console.error('Erro ao iniciar gravação:', err);
      setError(err.message || 'Não foi possível acessar o microfone');
    }
  }, [audioUrl, measureAudioLevel]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setStream(null); // Limpar stream
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];
  }, [audioUrl]);

  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    duration,
    formattedDuration: formatDuration(duration),
    error,
    stream, // MediaStream para visualização
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
}

export default useAudioRecorder;
