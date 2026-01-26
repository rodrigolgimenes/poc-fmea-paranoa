import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarRefugoPorEtiqueta } from '../services/diarioRefugoService';

export default function LerEtiqueta() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  
  const [etiqueta, setEtiqueta] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refugoData, setRefugoData] = useState(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBuscar = async () => {
    if (!etiqueta.trim()) {
      setError('Digite ou escaneie uma etiqueta');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRefugoData(null);

    try {
      const { data, error: fetchError } = await buscarRefugoPorEtiqueta(etiqueta);
      
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      
      setRefugoData(data);
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

  const handleIniciarRegistro = () => {
    // Pass refugo data to the next screen via state
    navigate('/diario-bordo', { state: { refugoData } });
  };

  const handleLimpar = () => {
    setEtiqueta('');
    setRefugoData(null);
    setError(null);
    inputRef.current?.focus();
  };

  const handleUsarExemplo = async (codigo) => {
    setEtiqueta(codigo);
    setIsLoading(true);
    setError(null);
    setRefugoData(null);
    try {
      const { data, error: fetchError } = await buscarRefugoPorEtiqueta(codigo);
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setRefugoData(data);
    } catch (err) {
      setError('Erro ao buscar etiqueta. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px',
        borderBottom: '1px solid #3a3a3a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo_dw.png" alt="DataWake" style={{ height: 28 }} onError={(e) => { e.currentTarget.style.display='none'; }} />
            <strong style={{ color: '#fff', letterSpacing: 1 }}><span style={{ color: '#f5a623' }}>DATA</span>WAKE</strong>
            <span style={{ fontSize: 12, color: '#888' }}>Diário de Bordo</span>
          </div>
        </div>
        <div style={{
          background: '#242424',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#888',
          border: '1px solid #3a3a3a',
        }}>
          Ambiente: <span style={{ color: '#f5a623' }}>TESTES</span>
        </div>
      </header>

      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {/* Input Card */}
        <div style={{
          background: '#242424',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '16px',
          border: '1px solid #3a3a3a',
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#fff',
            marginBottom: '20px',
          }}>
            🏷️ Ler Etiqueta
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block',
              fontSize: '14px',
              color: '#888',
              marginBottom: '8px',
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
                fontSize: '24px', 
                padding: '20px',
                textAlign: 'center',
                letterSpacing: '3px',
                fontWeight: '700',
                background: '#2d2d2d',
                border: '2px solid #3a3a3a',
                borderRadius: '8px',
                color: '#f5a623',
                fontFamily: 'monospace',
              }}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <p style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '8px',
              textAlign: 'center' 
            }}>
              Use o leitor de código de barras ou digite manualmente
            </p>
          </div>

          <button 
            onClick={handleBuscar}
            disabled={isLoading || !etiqueta.trim()}
            style={{ 
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              fontWeight: '700',
              background: isLoading || !etiqueta.trim() ? '#3a3a3a' : '#f5a623',
              color: isLoading || !etiqueta.trim() ? '#666' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !etiqueta.trim() ? 'not-allowed' : 'pointer',
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

        {/* Refugo Data Display */}
        {refugoData && (
          <>
            <div className="card" style={{ 
              borderLeft: '4px solid var(--color-success)',
              background: 'rgba(46, 204, 113, 0.05)',
            }}>
              <div className="card-header">
                <span className="card-title">✓ Etiqueta Encontrada</span>
                <span className="status-badge" style={{ 
                  background: 'var(--color-success)', 
                  color: 'white' 
                }}>
                  {refugoData.etiqueta}
                </span>
              </div>

              <div className="info-grid" style={{ marginTop: '16px' }}>
                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="label">Defeito Identificado</div>
                  <div className="value" style={{ 
                    fontSize: '24px', 
                    color: 'var(--color-warning)',
                    fontWeight: '700',
                  }}>
                    🔴 {refugoData.desc_defeito}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--color-text-muted)',
                    marginTop: '4px' 
                  }}>
                    Código: {refugoData.cod_defeito}
                  </div>
                </div>

                <div className="info-item">
                  <div className="label">Produto</div>
                  <div className="value">{refugoData.cod_produto}</div>
                </div>

                <div className="info-item">
                  <div className="label">OP</div>
                  <div className="value">{refugoData.op}</div>
                </div>

                <div className="info-item">
                  <div className="label">Filial</div>
                  <div className="value">{refugoData.filial || '-'}</div>
                </div>

                <div className="info-item">
                  <div className="label">Usuário</div>
                  <div className="value">{refugoData.usuario || '-'}</div>
                </div>

                <div className="info-item">
                  <div className="label">Data/Hora</div>
                  <div className="value">
                    {refugoData.dt_refugo 
                      ? new Date(refugoData.dt_refugo).toLocaleString('pt-BR')
                      : refugoData.data_refugo || '-'}
                  </div>
                </div>

                <div className="info-item">
                  <div className="label">Centro de Custo</div>
                  <div className="value">{refugoData.centro_custo || '-'}</div>
                </div>

                <div className="info-item">
                  <div className="label">Qtd Retrabalho</div>
                  <div className="value">{refugoData.qtd_retrabalho || 1}</div>
                </div>

                <div className="info-item">
                  <div className="label">Origem</div>
                  <div className="value" style={{ fontSize: '11px' }}>
                    {refugoData.origem || 'ELIPSE_E3.v_Refugo'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleLimpar}
                style={{ flex: 1 }}
              >
                🔄 Nova Etiqueta
              </button>
              <button 
                className="btn btn-warning btn-lg"
                onClick={handleIniciarRegistro}
                style={{ flex: 2 }}
              >
                📝 INICIAR REGISTRO
              </button>
            </div>
          </>
        )}

        {/* Quick tips */}
        {!refugoData && !error && (
          <div className="card" style={{ 
            background: 'rgba(72, 202, 228, 0.1)', 
            borderLeft: '4px solid var(--color-info)',
          }}>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <p style={{ marginBottom: '8px' }}>💡 <strong>Dica:</strong></p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Posicione o código de barras na frente do leitor</li>
                <li>A etiqueta será lida automaticamente</li>
                <li>Etiquetas de teste: {['0002509836', '0002502834', '0002502789'].map((tag, i) => (
                  <span key={tag}>
                    {i > 0 && ', '}
                    <span 
                      onClick={() => { setEtiqueta(tag); inputRef.current?.focus(); }} 
                      style={{ cursor: 'pointer', color: '#f5a623', textDecoration: 'underline' }}
                    >{tag}</span>
                  </span>
                ))}</li>
              </ul>
              <button
                onClick={() => handleUsarExemplo('0002509836')}
                disabled={isLoading}
                style={{
                  marginTop: '12px',
                  padding: '10px 16px',
                  background: isLoading ? '#3a3a3a' : '#f5a623',
                  color: isLoading ? '#666' : '#1a1a1a',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                🚀 Usar Etiqueta 0002509836 como exemplo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="bottom-bar">
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/consulta')}
        >
          📋 Consultar Registros
        </button>
      </div>
    </div>
  );
}
