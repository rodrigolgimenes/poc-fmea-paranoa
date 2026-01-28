import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarRefugoPorEtiqueta } from '../services/diarioRefugoService';

export default function LerEtiqueta() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  
  const [etiqueta, setEtiqueta] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBuscar = async (codigoOverride) => {
    const codigo = codigoOverride || etiqueta;
    if (!codigo.trim()) {
      setError('Digite ou escaneie uma etiqueta');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await buscarRefugoPorEtiqueta(codigo);
      
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      
      // Etiqueta encontrada → navega direto para o Diário de Bordo
      navigate('/diario-bordo', { state: { refugoData: data } });
    } catch (err) {
      setError('Erro ao buscar etiqueta. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBuscar();
    }
  };

  const handleLimpar = () => {
    setEtiqueta('');
    setError(null);
    inputRef.current?.focus();
  };

  const handleUsarExemplo = (codigo) => {
    setEtiqueta(codigo);
    handleBuscar(codigo);
  };

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      background: '#18191a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Exo', sans-serif",
    }}>
      {/* Header - DataDriven Style */}
      <header style={{
        padding: '12px 16px',
        background: '#242526',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
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

      <div style={{ flex: 1, padding: '16px', overflow: 'auto', minHeight: 0 }}>
        {/* Input Card */}
        <div style={{
          background: '#242526',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          border: '1px solid #3a3b3c',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#ccc',
            marginBottom: '12px',
          }}>
            🏷️ Ler Etiqueta
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block',
              fontSize: '13px',
              color: '#707070',
              marginBottom: '6px',
            }}>Código da Etiqueta</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="Escaneie ou digite a etiqueta..."
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              style={{ 
                width: '100%',
                fontSize: '20px', 
                padding: '14px',
                textAlign: 'center',
                letterSpacing: '2px',
                fontWeight: '700',
                background: '#3a3b3c',
                border: '2px solid #3a3b3c',
                borderRadius: '8px',
                color: '#FDB913',
                fontFamily: "'Exo', monospace",
              }}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <p style={{ 
              fontSize: '11px', 
              color: '#707070', 
              marginTop: '6px',
              textAlign: 'center' 
            }}>
              Use o leitor de código de barras ou digite manualmente
            </p>
          </div>

          <button 
            onClick={() => handleBuscar()}
            disabled={isLoading || !etiqueta.trim()}
            style={{ 
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '700',
              fontFamily: "'Exo', sans-serif",
              background: isLoading || !etiqueta.trim() ? '#3a3b3c' : '#FDB913',
              color: isLoading || !etiqueta.trim() ? '#707070' : '#18191a',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !etiqueta.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {isLoading ? '⏳ Buscando...' : '🔍 BUSCAR'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card" style={{ 
            background: 'rgba(230, 57, 70, 0.1)', 
            borderLeft: '4px solid var(--color-danger)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>{error}</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleLimpar}
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick tips */}
        {!error && (
          <div className="card" style={{ 
            background: 'rgba(23, 162, 184, 0.1)', 
            borderLeft: '4px solid #17a2b8',
            padding: '12px',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '13px', color: '#707070' }}>
              <p style={{ marginBottom: '6px', color: '#ccc' }}>💡 <strong>Dica:</strong></p>
              <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.4' }}>
                <li>Posicione o código de barras na frente do leitor</li>
                <li>A etiqueta será lida automaticamente</li>
                <li>Etiquetas de teste: {['0002509836', '0002502834', '0002502789'].map((tag, i) => (
                  <span key={tag}>
                    {i > 0 && ', '}
                    <span 
                      onClick={() => { setEtiqueta(tag); inputRef.current?.focus(); }} 
                      style={{ cursor: 'pointer', color: '#FDB913', textDecoration: 'underline' }}
                    >{tag}</span>
                  </span>
                ))}</li>
              </ul>
              <button
                onClick={() => handleUsarExemplo('0002509836')}
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  padding: '8px 14px',
                  fontFamily: "'Exo', sans-serif",
                  background: isLoading ? '#3a3b3c' : '#FDB913',
                  color: isLoading ? '#707070' : '#18191a',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                }}
              >
                🚀 Usar Etiqueta 0002509836 como exemplo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation - fixo no rodapé */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px',
        background: '#242526',
        borderTop: '1px solid #3a3b3c',
      }}>
        <button 
          onClick={() => navigate('/consulta')}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '15px',
            fontWeight: '600',
            fontFamily: "'Exo', sans-serif",
            background: '#3a3b3c',
            color: '#ccc',
            border: '1px solid #3a3b3c',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📋 Consultar Registros
        </button>
      </div>
    </div>
  );
}
