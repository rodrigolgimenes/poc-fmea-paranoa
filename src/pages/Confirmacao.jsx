import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Labels for display
const MOMENTO_LABELS = {
  antes: 'Antes do desvio',
  durante: 'Durante',
  apos: 'Após'
};

const PERCEPCAO_LABELS = {
  som_agitador: 'Som do agitador',
  viscosidade: 'Viscosidade',
  brilho_aparencia: 'Brilho/aparência',
  bolha_visivel: 'Bolha visível',
  vibracao: 'Vibração'
};

const CAUSA_LABELS = {
  umidade_materia_prima: 'Umidade da matéria-prima',
  materia_prima_diferente: 'Matéria-prima diferente',
  setup_recente: 'Setup recente',
  manutencao_recente: 'Manutenção recente',
  ar_incorporado: 'Ar incorporado',
  pressao_injecao: 'Pressão de injeção'
};

export default function Confirmacao() {
  const { registroId } = useParams();
  const navigate = useNavigate();
  const { getObservacaoById, getEventById } = useApp();

  const observacao = getObservacaoById(registroId);
  const event = observacao ? getEventById(observacao.event_id) : null;

  if (!observacao) {
    return (
      <div className="page">
        <div className="success-message">
          <div className="success-icon">❓</div>
          <h2 className="success-title">Registro não encontrado</h2>
          <p>O registro {registroId} não foi encontrado.</p>
        </div>
        <div className="bottom-bar">
          <button 
            className="btn btn-primary btn-block"
            onClick={() => navigate('/monitor')}
          >
            Voltar ao Monitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Success Header */}
      <div className="success-message" style={{ padding: '32px 24px' }}>
        <div className="success-icon">✅</div>
        <h2 className="success-title">REGISTRO SALVO</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Obrigado! Sua percepção foi vinculada ao FMEA do processo.
        </p>
      </div>

      <div className="page-content">
        {/* Summary Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Resumo do Registro</span>
            <span style={{ 
              fontSize: '12px', 
              color: 'var(--color-text-muted)',
              fontFamily: 'monospace' 
            }}>
              {registroId}
            </span>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Event context */}
            {event && (
              <div className="info-item">
                <div className="label">Evento CEP</div>
                <div className="value" style={{ fontSize: '16px' }}>
                  {event.variavel_cep}: {event.valor_atual} {event.unidade}
                  <span className={`status-badge ${event.status}`} style={{ 
                    marginLeft: '12px', 
                    padding: '2px 8px',
                    fontSize: '12px' 
                  }}>
                    {event.status}
                  </span>
                </div>
              </div>
            )}

            {/* Momento */}
            <div className="info-item">
              <div className="label">Momento da percepção</div>
              <div className="value">{MOMENTO_LABELS[observacao.momento] || observacao.momento}</div>
            </div>

            {/* Percepções */}
            <div className="info-item">
              <div className="label">Sinais percebidos</div>
              <div className="value" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {observacao.percepcao?.length > 0 ? (
                  observacao.percepcao.map(p => (
                    <span 
                      key={p}
                      style={{
                        background: 'var(--color-bg)',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      {PERCEPCAO_LABELS[p] || p}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>Nenhum informado</span>
                )}
              </div>
            </div>

            {/* Ajustes */}
            {observacao.acao?.ajuste && (
              <div className="info-item">
                <div className="label">Ajustes realizados</div>
                <div className="value" style={{ fontSize: '16px' }}>
                  {observacao.acao.frequencia_agitador_hz && (
                    <span style={{ marginRight: '16px' }}>
                      Freq. agitador: {observacao.acao.frequencia_agitador_hz} Hz
                    </span>
                  )}
                  {observacao.acao.pressao_injecao_bar && (
                    <span style={{ marginRight: '16px' }}>
                      Pressão: {observacao.acao.pressao_injecao_bar} bar
                    </span>
                  )}
                  {observacao.acao.massa_g && (
                    <span>Massa: {observacao.acao.massa_g} g</span>
                  )}
                </div>
              </div>
            )}

            {/* Causa */}
            {observacao.causa_percebida && (
              <div className="info-item">
                <div className="label">Causa percebida</div>
                <div className="value" style={{ color: 'var(--color-warning)' }}>
                  {CAUSA_LABELS[observacao.causa_percebida] || observacao.causa_percebida}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="info-item">
              <div className="label">Data/Hora</div>
              <div className="value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                {new Date(observacao.timestamp).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="card-title" style={{ marginBottom: '12px', color: 'var(--color-success)' }}>
            📊 Próximo passo do sistema
          </div>
          <ul style={{ 
            paddingLeft: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            color: 'var(--color-text-muted)'
          }}>
            <li>Entrada adicionada ao histórico do modo de falha</li>
            <li>Vai aparecer no painel de recorrência</li>
            <li>Contribui para análise de correlação CEP × Percepção</li>
            <li>FMEA Vivo atualiza estatísticas em tempo real</li>
          </ul>
        </div>

        {/* JSON preview (dev mode) */}
        <details style={{ marginTop: '16px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            color: 'var(--color-text-muted)',
            fontSize: '14px'
          }}>
            Ver payload JSON (modo desenvolvedor)
          </summary>
          <pre style={{
            background: 'var(--color-bg-input)',
            padding: '16px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            marginTop: '8px'
          }}>
            {JSON.stringify(observacao, null, 2)}
          </pre>
        </details>
      </div>

      {/* Bottom actions */}
      <div className="bottom-bar">
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/monitor')}
        >
          🏠 Voltar ao Monitor
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/fmea-aprendendo')}
        >
          📊 Ver FMEA Aprendendo →
        </button>
      </div>
    </div>
  );
}
