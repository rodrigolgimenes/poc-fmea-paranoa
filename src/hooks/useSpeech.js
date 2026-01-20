import { useState, useCallback, useEffect, useRef } from 'react';

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSynthesis = window.speechSynthesis;

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Reconhecimento de voz não suportado neste navegador');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'pt-BR';

    recognitionRef.current.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      setTranscript(text);
    };

    recognitionRef.current.onerror = (event) => {
      setError(`Erro no reconhecimento: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    setError(null);
    setTranscript('');
    setIsListening(true);
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      setError('Erro ao iniciar reconhecimento de voz');
      setIsListening(false);
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  // Speak text (TTS)
  const speak = useCallback((text, onEnd) => {
    if (!speechSynthesis) {
      setError('Síntese de voz não suportada neste navegador');
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = (event) => {
      setError(`Erro na síntese: ${event.error}`);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript
  };
}

export default useSpeech;
