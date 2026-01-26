import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook para captura de foto via câmera do dispositivo
 */
export function useCamera() {
  const [isOpen, setIsOpen] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = traseira, 'user' = frontal
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup - inline to avoid dependency issues
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsOpen(true);
      
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      setError(err.message || 'Não foi possível acessar a câmera');
    }
  }, [facingMode]);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsOpen(false);
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('[useCamera] Video ou canvas não disponível');
      setError('Câmera não está pronta');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('[useCamera] Video sem dimensões:', video.videoWidth, video.videoHeight);
      setError('Aguarde a câmera carregar');
      return;
    }
    
    console.log('[useCamera] Capturando foto:', video.videoWidth, 'x', video.videoHeight);
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('[useCamera] Falha ao criar blob');
        setError('Erro ao capturar foto');
        return;
      }
      
      console.log('[useCamera] Foto capturada:', blob.size, 'bytes');
      
      // Revoke old URL
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
      
      setPhotoBlob(blob);
      const url = URL.createObjectURL(blob);
      setPhotoUrl(url);
      
      // Close camera after taking photo
      closeCamera();
    }, 'image/jpeg', 0.85);
  }, [photoUrl, closeCamera]);

  const clearPhoto = useCallback(() => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhotoBlob(null);
    setPhotoUrl(null);
  }, [photoUrl]);

  const switchCamera = useCallback(() => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    
    // If camera is open, reopen with new facing mode
    if (isOpen) {
      closeCamera();
      setTimeout(() => {
        openCamera();
      }, 100);
    }
  }, [facingMode, isOpen, closeCamera, openCamera]);

  // Handle file input (fallback for devices without camera API)
  const handleFileInput = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Revoke old URL
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    
    setPhotoBlob(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  }, [photoUrl]);

  return {
    isOpen,
    photoBlob,
    photoUrl,
    error,
    facingMode,
    videoRef,
    canvasRef,
    openCamera,
    closeCamera,
    takePhoto,
    clearPhoto,
    switchCamera,
    handleFileInput,
  };
}

export default useCamera;
