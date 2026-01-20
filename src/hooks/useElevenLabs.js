import { useState, useCallback, useRef } from 'react';

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// ElevenLabs female voice IDs
const VOICE_IDS = {
  // Rachel - warm female voice
  rachel: '21m00Tcm4TlvDq8ikWAM',
  // Charlotte - clear female voice  
  charlotte: 'XB0fDUnXU5powFXDhCwa',
  // Bella - young female voice
  bella: 'EXAVITQu4vr4xnSDxMaL',
};

// Default to Rachel voice (warm, clear)
const DEFAULT_VOICE_ID = VOICE_IDS.rachel;

export function useElevenLabs() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [audioData, setAudioData] = useState(null); // For waveform visualization
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  // Text-to-Speech using ElevenLabs
  const speak = useCallback(async (text, onEnd) => {
    if (!ELEVENLABS_API_KEY) {
      setError('ElevenLabs API key não configurada');
      return;
    }

    setIsLoading(true);
    setIsSpeaking(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (onEnd) onEnd();
      };
      audioRef.current.onerror = () => {
        setError('Erro ao reproduzir áudio');
        setIsSpeaking(false);
      };
      
      await audioRef.current.play();
    } catch (err) {
      setError(err.message);
      setIsSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Start recording for Speech-to-Text
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context for waveform visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Start waveform animation
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        
        try {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          setAudioData([...dataArray]);
        } catch (e) {
          // Analyser may have been closed
          return;
        }
        
        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(updateWaveform);
        }
      };

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Start waveform updates
      requestAnimationFrame(updateWaveform);

    } catch (err) {
      setError('Erro ao acessar microfone: ' + err.message);
    }
  }, [isRecording]);

  // Stop recording and transcribe using ElevenLabs STT
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        analyserRef.current = null;
        setAudioData(null);
        setIsRecording(false);

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current.mimeType 
        });

        // Transcribe using OpenAI Whisper
        try {
          setIsLoading(true);
          
          if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key não configurada');
          }
          
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          formData.append('model', 'whisper-1');
          formData.append('language', 'pt'); // Portuguese
          formData.append('response_format', 'json');

          const response = await fetch(
            'https://api.openai.com/v1/audio/transcriptions',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
              },
              body: formData,
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI Whisper error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const result = await response.json();
          const transcribedText = result.text || '';
          setTranscript(transcribedText);
          resolve(transcribedText);
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Erro na transcrição: ' + err.message);
          resolve('');
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // States
    isLoading,
    isSpeaking,
    isRecording,
    transcript,
    error,
    audioData, // For waveform visualization
    
    // Actions
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
    clearTranscript,
    clearError,
    
    // Check if API is available
    isAvailable: !!ELEVENLABS_API_KEY && !!OPENAI_API_KEY,
  };
}

export default useElevenLabs;
