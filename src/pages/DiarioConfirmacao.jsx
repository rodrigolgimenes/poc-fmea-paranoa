import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function DiarioConfirmacao() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventoId, refugoData, success } = location.state || {};

  // Redirect if no state
  useEffect(() => {
    if (!success) {
      navigate('/', { replace: true });
    }
  }, [success, navigate]);

  if (!success) {
    return null;
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">✅ REGISTRO SALVO</h1>
          <p className="page-subtitle">Diário de Bordo</p>
        </div>
      </header>

      <div className="page-content">
        {/* Success message */}
        <div className="card" style={{ 
          textAlign: 'center',
          padding: '32px',
          background: 'rgba(46, 204, 113, 0.1)',
          borderLeft: '4px solid var(--color-success)',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--color-success)' }}>
            Registro salvo com sucesso!
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Os dados foram enviados e estão disponíveis para análise.
          </p>
        </div>

        {/* Summary */}
        {refugoData && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Resumo do Registro</span>
            </div>
            
            <div className="info-grid">
              <div className="info-item">
                <div className="label">Etiqueta</div>
                <div className="value" style={{ fontWeight: '700', letterSpacing: '1px' }}>
                  {refugoData.etiqueta}
                </div>
              </div>
              
              <div className="info-item">
                <div className="label">Defeito</div>
                <div className="value">{refugoData.desc_defeito}</div>
              </div>
              
              <div className="info-item">
                <div className="label">Produto</div>
                <div className="value">{refugoData.nome_produto || refugoData.cod_produto}</div>
              </div>
              
              <div className="info-item">
                <div className="label">OP</div>
                <div className="value">{refugoData.op}</div>
              </div>
              
              <div className="info-item">
                <div className="label">Linha/Máquina</div>
                <div className="value">{refugoData.linha} / {refugoData.maquina}</div>
              </div>
              
              <div className="info-item">
                <div className="label">Data/Hora</div>
                <div className="value">
                  {new Date().toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event ID */}
        {eventoId && (
          <div className="card" style={{ 
            padding: '16px',
            background: 'rgba(72, 202, 228, 0.1)',
            borderLeft: '4px solid var(--color-info)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              ID do Evento (para referência):
            </div>
            <code style={{ 
              fontSize: '12px', 
              background: 'var(--color-bg-input)', 
              padding: '4px 8px',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {eventoId}
            </code>
          </div>
        )}

        {/* What happens next */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🤖 Próximos passos</span>
          </div>
          <ul style={{ 
            margin: '0', 
            paddingLeft: '20px', 
            fontSize: '14px',
            lineHeight: '1.8',
            color: 'var(--color-text-muted)',
          }}>
            <li>Os áudios serão transcritos automaticamente pela IA</li>
            <li>A foto será analisada para identificação de padrões</li>
            <li>Dados serão correlacionados com sinais CEP e FMEA</li>
            <li>Insights serão gerados para melhoria do processo</li>
          </ul>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="bottom-bar">
        <button 
          className="btn btn-primary btn-lg btn-block"
          onClick={() => navigate('/')}
        >
          📋 NOVO REGISTRO
        </button>
      </div>

      {/* Secondary navigation */}
      <div style={{ 
        padding: '12px 24px', 
        display: 'flex', 
        justifyContent: 'center',
        gap: '24px',
        fontSize: '14px',
      }}>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/consulta')}
          style={{ fontSize: '14px' }}
        >
          📋 Ver Todos os Registros
        </button>
      </div>
    </div>
  );
}
