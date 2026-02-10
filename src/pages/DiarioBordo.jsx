import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useCamera } from '../hooks/useCamera';
import { criarEvento, uploadMidia, finalizarEvento } from '../services/diarioRefugoService';
import { transcreverAudio } from '../services/transcricaoService';
import AudioLevelMeter from '../components/AudioWaveform';

// Audio recorder component
function AudioInput({ 
  label, 
  audioUrl, 
  isRecording, 
  formattedDuration,
  stream,
  onStartRecording, 
  onStopRecording, 
  onClear,
  quickOption,
  onQuickOption,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = () => setIsPlaying(false);
    }
  }, [audioUrl]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{label}</span>
        {audioUrl && (
          <span className="status-badge" style={{ background: 'var(--color-success)', color: 'white' }}>
            ✓ Gravado
          </span>
        )}
      </div>

      {/* Recording indicator com VU Meter */}
      {isRecording && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          marginBottom: '12px',
        }}>
          {/* Medidor de nível de áudio */}
          <AudioLevelMeter 
            stream={stream}
            isRecording={isRecording} 
            height={50} 
            barCount={24} 
          />
          
          {/* Timer */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--color-danger)',
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'var(--color-danger)',
              animation: 'pulse 1s infinite',
            }} />
            Gravando {formattedDuration}
          </div>
        </div>
      )}

      {/* Playback */}
      {audioUrl && !isRecording && (
        <div style={{ marginBottom: '12px' }}>
          <audio ref={audioRef} src={audioUrl} />
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center',
            padding: '12px',
            background: 'var(--color-bg-input)',
            borderRadius: '8px',
          }}>
            <button 
              className="btn btn-secondary"
              onClick={handlePlayPause}
              style={{ padding: '8px 16px' }}
            >
              {isPlaying ? '⏸️ Pausar' : '▶️ Ouvir'}
            </button>
            <span style={{ flex: 1, fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Áudio gravado com sucesso
            </span>
            <button 
              className="btn btn-secondary"
              onClick={onClear}
              style={{ padding: '8px 12px', fontSize: '12px' }}
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {!isRecording ? (
          <button 
            className="btn btn-primary"
            onClick={onStartRecording}
            disabled={!!audioUrl}
            style={{ flex: 1, minWidth: '140px' }}
          >
            🎙️ {audioUrl ? 'Já gravado' : 'Gravar'}
          </button>
        ) : (
          <button 
            className="btn btn-danger"
            onClick={onStopRecording}
            style={{ flex: 1, minWidth: '140px' }}
          >
            ⏹️ Parar
          </button>
        )}
        
        {quickOption && !audioUrl && !isRecording && (
          <button 
            className="btn btn-secondary"
            onClick={onQuickOption}
            style={{ flex: 1, minWidth: '140px' }}
          >
            ⚡ {quickOption}
          </button>
        )}
      </div>
    </div>
  );
}

// Photo capture component - Usa input file nativo para melhor compatibilidade mobile
function PhotoInput({ photoUrl, onCapture, onClear, isCameraOpen, openCamera, closeCamera, takePhoto, switchCamera, videoRef, canvasRef }) {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const event = { target: { files: [file] } };
      onCapture(event, true);
    }
    // Reset input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  return (
    <>
    <div className="card">
      <div className="card-header">
        <span className="card-title">📷 Foto (Evidência)</span>
        {photoUrl && (
          <span className="status-badge" style={{ background: 'var(--color-success)', color: 'white' }}>
            ✓ Capturada
          </span>
        )}
      </div>

      {/* Photo preview */}
      {photoUrl && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <img 
              src={photoUrl} 
              alt="Foto capturada"
              style={{ 
                width: '100%', 
                height: 'auto',
                maxHeight: '250px',
                objectFit: 'cover',
              }}
            />
            <button 
              className="btn btn-secondary"
              onClick={onClear}
              style={{ 
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '8px 12px',
              }}
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {/* Action buttons - usa input nativo com capture para abrir câmera diretamente */}
      {!photoUrl && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => {
              if (navigator.mediaDevices?.getUserMedia && typeof openCamera === 'function') {
                openCamera();
              } else {
                cameraInputRef.current?.click();
              }
            }}
            style={{ flex: 1 }}
          >
            📷 Tirar Foto
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1 }}
          >
            📁 Galeria
          </button>
          {/* Input para câmera - capture="environment" abre câmera traseira */}
          <input 
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {/* Input para galeria - sem capture para abrir seletor de arquivos */}
          <input 
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>

    {/* In-app camera overlay using getUserMedia */}
    {isCameraOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={switchCamera}>🔄 Trocar câmera</button>
          <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={closeCamera}>✕ Fechar</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: '100%', maxHeight: '100%' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-success" onClick={takePhoto} style={{ fontSize: 18, padding: '12px 24px' }}>📸 Capturar</button>
        </div>
      </div>
    )}
    </>
  );
}

export default function DiarioBordo() {
  const navigate = useNavigate();
  const location = useLocation();
  const refugoData = location.state?.refugoData;

  // Redirect if no refugo data
  useEffect(() => {
    if (!refugoData) {
      navigate('/', { replace: true });
    }
  }, [refugoData, navigate]);

  // Audio recorders (separate instances for each audio)
  const audioDetalhe = useAudioRecorder();
  const audioObservacao = useAudioRecorder();

  // Camera hook
  const camera = useCamera();

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [quickObservacao, setQuickObservacao] = useState(false);

  // Handle quick observation option
  const handleQuickObservacao = () => {
    setQuickObservacao(true);
  };

  // Validation - foto é opcional
  const isValid = (audioDetalhe.audioBlob || quickObservacao) && 
                  (audioObservacao.audioBlob || quickObservacao);

  // Handle save
  const handleSalvar = async () => {
    if (!refugoData) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveStatus('Criando registro...');

    try {
      // 1. Create event
      const { data: evento, error: eventoError } = await criarEvento({
        ...refugoData,
        usuario_nome: 'Operador', // Would come from auth context in production
        usuario_matricula: '12345',
      });

      if (eventoError) {
        throw new Error(eventoError.message || 'Erro ao criar evento');
      }

      const eventoId = evento.evento_id;

      // 2. Upload media files
      setSaveStatus('Enviando arquivos...');
      const uploads = [];

      // Upload audio detalhe
      if (audioDetalhe.audioBlob) {
        uploads.push(
          uploadMidia(eventoId, audioDetalhe.audioBlob, 'AUDIO_DETALHE', {
            duracao_seg: audioDetalhe.duration,
          })
        );
      }

      // Upload audio observação
      if (audioObservacao.audioBlob) {
        uploads.push(
          uploadMidia(eventoId, audioObservacao.audioBlob, 'AUDIO_OBSERVACAO', {
            duracao_seg: audioObservacao.duration,
          })
        );
      }

      // Upload foto
      if (camera.photoBlob) {
        uploads.push(
          uploadMidia(eventoId, camera.photoBlob, 'FOTO')
        );
      }

      // Wait for all uploads
      await Promise.all(uploads);

      // 3. Transcribe audios (Edge Function salva diretamente no banco)
      setSaveStatus('Transcrevendo áudios...');
      const transcricoes = {};

      // Transcrever áudio de detalhe
      if (audioDetalhe.audioBlob) {
        console.log('[DiarioBordo] Transcrevendo áudio de detalhe...');
        const resultDetalhe = await transcreverAudio(
          audioDetalhe.audioBlob, 
          eventoId, 
          'detalhe'
        );
        console.log('[DiarioBordo] Resultado transcrição detalhe:', resultDetalhe);
        if (resultDetalhe.text) {
          transcricoes.detalhe = resultDetalhe.text;
        } else if (resultDetalhe.error) {
          console.error('[DiarioBordo] Erro transcrição detalhe:', resultDetalhe.error);
        }
      }

      // Transcrever áudio de observação
      if (audioObservacao.audioBlob) {
        console.log('[DiarioBordo] Transcrevendo áudio de observação...');
        const resultObservacao = await transcreverAudio(
          audioObservacao.audioBlob,
          eventoId,
          'observacao'
        );
        console.log('[DiarioBordo] Resultado transcrição observação:', resultObservacao);
        if (resultObservacao.text) {
          transcricoes.observacao = resultObservacao.text;
        } else if (resultObservacao.error) {
          console.error('[DiarioBordo] Erro transcrição observação:', resultObservacao.error);
        }
      } else if (quickObservacao) {
        transcricoes.observacao = 'Não vi nada de diferente';
      }

      console.log('[DiarioBordo] Transcrições finais:', transcricoes);

      // 4. Finalize event (transcrições já foram salvas pela Edge Function)
      setSaveStatus('Finalizando...');
      // Se usou quickObservacao, ainda precisa salvar essa transcrição
      const transcricoesParaSalvar = quickObservacao && !audioObservacao.audioBlob
        ? { observacao: transcricoes.observacao }
        : {};
      const { error: finalizeError } = await finalizarEvento(eventoId, transcricoesParaSalvar);

      if (finalizeError) {
        throw new Error(finalizeError.message || 'Erro ao finalizar evento');
      }

      // Success - navigate to confirmation
      navigate('/diario-confirmacao', { 
        state: { 
          eventoId,
          refugoData,
          transcricoes,
          success: true,
        } 
      });

    } catch (error) {
      console.error('Erro ao salvar:', error);
      setSaveError(error.message || 'Erro ao salvar registro');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelar = () => {
    navigate('/', { replace: true });
  };

  if (!refugoData) {
    return null; // Will redirect
  }

  return (
    <div style={{ minHeight: '100vh', background: '#18191a', display: 'flex', flexDirection: 'column', fontFamily: "'Exo', sans-serif" }}>
      {/* Header - DataDriven Style */}
      <header style={{
        padding: '12px 16px',
        background: '#242526',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '2px 2px 5px 1px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
            src="/datawake_logo.svg" 
            alt="DataWake" 
            style={{ height: 40 }} 
            onError={(e) => { e.currentTarget.style.display='none'; }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#ccc' }}>Diário de Bordo</span>
            <span style={{ fontSize: 11, color: '#707070' }}>Registro de Refugos</span>
          </div>
        </div>
        <div style={{
          background: '#3a3b3c',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#707070',
          border: '1px solid #3a3b3c',
        }}>
          Ambiente: <span style={{ color: '#FDB913', fontWeight: 600 }}>TESTES</span>
        </div>
      </header>

      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {/* Context summary */}
        <div className="card" style={{ 
          padding: '12px 16px',
          background: 'rgba(23, 162, 184, 0.1)',
          borderLeft: '4px solid #17a2b8',
          borderRadius: '8px',
        }}>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '16px', 
            fontSize: '14px',
            alignItems: 'center',
          }}>
            <span><strong>🔴 Defeito:</strong> {refugoData.desc_defeito}</span>
            <span><strong>📦 Produto:</strong> {refugoData.nome_produto || refugoData.cod_produto}</span>
            <span><strong>🏭 Linha:</strong> {refugoData.linha}</span>
          </div>
        </div>

        {/* Error message */}
        {saveError && (
          <div className="card" style={{ 
            background: 'rgba(230, 57, 70, 0.1)', 
            borderLeft: '4px solid var(--color-danger)',
          }}>
            <p style={{ fontWeight: '600' }}>⚠️ {saveError}</p>
          </div>
        )}

        {/* Audio 1: Detalhes do defeito */}
        <AudioInput
          label="🎙️ Detalhes do Defeito"
          audioUrl={audioDetalhe.audioUrl}
          isRecording={audioDetalhe.isRecording}
          formattedDuration={audioDetalhe.formattedDuration}
          stream={audioDetalhe.stream}
          onStartRecording={audioDetalhe.startRecording}
          onStopRecording={audioDetalhe.stopRecording}
          onClear={audioDetalhe.clearRecording}
        />

        {/* Audio 2: Observações */}
        <AudioInput
          label="🎙️ Observações / Diagnóstico"
          audioUrl={audioObservacao.audioUrl}
          isRecording={audioObservacao.isRecording}
          formattedDuration={audioObservacao.formattedDuration}
          stream={audioObservacao.stream}
          onStartRecording={audioObservacao.startRecording}
          onStopRecording={audioObservacao.stopRecording}
          onClear={audioObservacao.clearRecording}
          quickOption="Não vi nada diferente"
          onQuickOption={handleQuickObservacao}
        />

        {/* Quick observation indicator */}
        {quickObservacao && !audioObservacao.audioUrl && (
          <div className="card" style={{ 
            padding: '12px 16px',
            background: 'rgba(46, 204, 113, 0.1)',
            borderLeft: '4px solid var(--color-success)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✓</span>
              <span>Observação padrão: "Não vi nada de diferente"</span>
              <button 
                className="btn btn-secondary"
                onClick={() => setQuickObservacao(false)}
                style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '12px' }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Photo */}
        <PhotoInput
          photoUrl={camera.photoUrl}
          onCapture={(e) => camera.handleFileInput(e)}
          onClear={camera.clearPhoto}
          isCameraOpen={camera.isOpen}
          openCamera={camera.openCamera}
          closeCamera={camera.closeCamera}
          takePhoto={camera.takePhoto}
          switchCamera={camera.switchCamera}
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
        />

        {/* Progress indicator */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: '600' }}>
            Progresso do registro:
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ 
              padding: '6px 12px', 
              borderRadius: '20px',
              background: audioDetalhe.audioUrl ? 'var(--color-success)' : 'var(--color-bg-input)',
              color: audioDetalhe.audioUrl ? 'white' : 'var(--color-text-muted)',
              fontSize: '13px',
            }}>
              {audioDetalhe.audioUrl ? '✓' : '○'} Áudio Detalhe
            </span>
            <span style={{ 
              padding: '6px 12px', 
              borderRadius: '20px',
              background: (audioObservacao.audioUrl || quickObservacao) ? 'var(--color-success)' : 'var(--color-bg-input)',
              color: (audioObservacao.audioUrl || quickObservacao) ? 'white' : 'var(--color-text-muted)',
              fontSize: '13px',
            }}>
              {(audioObservacao.audioUrl || quickObservacao) ? '✓' : '○'} Observação
            </span>
            <span style={{ 
              padding: '6px 12px', 
              borderRadius: '20px',
              background: camera.photoUrl ? 'var(--color-success)' : 'var(--color-bg-input)',
              color: camera.photoUrl ? 'white' : 'var(--color-text-muted)',
              fontSize: '13px',
            }}>
              {camera.photoUrl ? '✓' : '○'} Foto (opcional)
            </span>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="bottom-bar">
        <button 
          className="btn btn-secondary"
          onClick={handleCancelar}
          disabled={isSaving}
        >
          ✕ Cancelar
        </button>
        <button 
          className="btn btn-success"
          onClick={handleSalvar}
          disabled={!isValid || isSaving}
          style={{ flex: 2 }}
        >
          {isSaving ? `⏳ ${saveStatus}` : '✓ SALVAR REGISTRO'}
        </button>
      </div>

      {/* CSS for recording animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
