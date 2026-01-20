import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { insights, pfmeaBolhas } from '../mock';

// Labels for display
const PERCEPCAO_LABELS = {
  som_agitador: 'Som do agitador',
  viscosidade: 'Viscosidade',
  brilho_aparencia: 'Brilho/aparência',
  bolha_visivel: 'Bolha visível',
  vibracao: 'Vibração'
};

const CAUSA_LABELS = {
  umidade_materia_prima: 'Umidade matéria-prima',
  materia_prima_diferente: 'Matéria-prima diferente',
  setup_recente: 'Setup recente',
  manutencao_recente: 'Manutenção recente',
  ar_incorporado: 'Ar incorporado',
  pressao_injecao: 'Pressão de injeção',
  frequencia_agitador_fora: 'Freq. agitador fora'
};

const ACAO_LABELS = {
  ajustar_agitador: 'Ajustar frequência agitador',
  reduzir_pressao: 'Reduzir pressão',
  ajustar_massa: 'Ajustar quantidade de massa'
};

export default function FmeaAprendendo() {
  const { getStats, observacoes } = useApp();
  const stats = getStats();
  const [activeTab, setActiveTab] = useState('resumo');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">FMEA APRENDENDO</h1>
          <p className="page-subtitle">
            Modo de falha: {insights.modo_falha} | Período: {insights.periodo}
          </p>
        </div>
        <Link to="/monitor" className="btn btn-secondary">
          ← Monitor
        </Link>
      </header>

      {/* Stats summary */}
      <div className="info-grid" style={{ marginBottom: '16px' }}>
        <div className="info-item">
          <div className="label">Registros</div>
          <div className="value" style={{ color: 'var(--color-primary)' }}>
            {stats.totalRegistros}
          </div>
        </div>
        <div className="info-item">
          <div className="label">Tendências</div>
          <div className="value" style={{ color: 'var(--color-warning)' }}>
            {stats.totalTendencias}
          </div>
        </div>
        <div className="info-item">
          <div className="label">Desvios</div>
          <div className="value" style={{ color: 'var(--color-danger)' }}>
            {stats.totalDesvios}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'resumo' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumo')}
        >
          📊 Resumo
        </button>
        <button 
          className={`tab ${activeTab === 'clusters' ? 'active' : ''}`}
          onClick={() => setActiveTab('clusters')}
        >
          🔍 Clusters
        </button>
        <button 
          className={`tab ${activeTab === 'grafo' ? 'active' : ''}`}
          onClick={() => setActiveTab('grafo')}
        >
          🕸️ Knowledge Graph
        </button>
        <button 
          className={`tab ${activeTab === 'pfmea' ? 'active' : ''}`}
          onClick={() => setActiveTab('pfmea')}
        >
          📋 Atualização PFMEA
        </button>
      </div>

      <div className="page-content">
        {/* Resumo Tab */}
        {activeTab === 'resumo' && (
          <>
            {/* Top perceptions */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '16px' }}>
                🎯 Top Sinais Percebidos (operador)
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sinal</th>
                    <th style={{ textAlign: 'right' }}>Contagem</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPercepcoes.map(([key, count]) => (
                    <tr key={key}>
                      <td>{PERCEPCAO_LABELS[key] || key}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top causes */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '16px' }}>
                ⚠️ Top Causas Percebidas
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Causa</th>
                    <th style={{ textAlign: 'right' }}>Contagem</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topCausas.map(([key, count]) => (
                    <tr key={key}>
                      <td>{CAUSA_LABELS[key] || key}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Effective actions */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '16px' }}>
                ✅ Ações Mais Efetivas (auto relato)
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th style={{ textAlign: 'right' }}>Resolveu?</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.acoesEfetivas.map(item => (
                    <tr key={item.acao}>
                      <td>{ACAO_LABELS[item.acao] || item.acao}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        <span style={{ color: 'var(--color-success)' }}>
                          {item.resolveu}/{item.total}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PFMEA link */}
            <div className="card" style={{ borderLeft: '4px solid var(--color-info)' }}>
              <div className="card-title" style={{ marginBottom: '8px' }}>
                🔗 Link com PFMEA
              </div>
              <p style={{ marginBottom: '8px' }}>
                <strong>Linha relacionada:</strong> "{pfmeaBolhas.causas_conhecidas[0].descricao}"
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                PFMEA: {pfmeaBolhas.pfmea_id} | Revisão: {pfmeaBolhas.revisao}
              </p>
            </div>
          </>
        )}

        {/* Clusters Tab */}
        {activeTab === 'clusters' && (
          <>
            <div style={{ 
              background: 'rgba(72, 202, 228, 0.1)', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              💡 <strong>Clusterização (beta):</strong> Agrupamento automático de percepções similares
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {insights.clusters.map((cluster, index) => (
                <div 
                  key={cluster.cluster_id}
                  className="cluster-card"
                  style={{ 
                    borderLeftColor: index === 0 ? 'var(--color-warning)' : 
                                    index === 1 ? 'var(--color-info)' : 'var(--color-success)'
                  }}
                >
                  <div className="cluster-label">{cluster.rotulo}</div>
                  <div className="cluster-count">{cluster.qtd_registros} registros</div>
                  <div className="cluster-tags">
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginRight: '8px' }}>
                      Sinais:
                    </span>
                    {cluster.sinais.map(s => (
                      <span key={s} className="tag">{PERCEPCAO_LABELS[s] || s}</span>
                    ))}
                  </div>
                  <div className="cluster-tags" style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginRight: '8px' }}>
                      Causas:
                    </span>
                    {cluster.causas_associadas.map(c => (
                      <span key={c} className="tag">{CAUSA_LABELS[c] || c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div className="card" style={{ 
              marginTop: '24px',
              background: 'rgba(255, 195, 0, 0.1)',
              borderLeft: '4px solid var(--color-warning)'
            }}>
              <div className="card-title" style={{ marginBottom: '12px' }}>
                🎯 Recomendação de Causa Provável
              </div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '700',
                marginBottom: '8px'
              }}>
                {CAUSA_LABELS[insights.recomendacao_causa_provavel.causa]}
                <span style={{ 
                  fontSize: '16px',
                  fontWeight: '400',
                  color: 'var(--color-text-muted)',
                  marginLeft: '12px'
                }}>
                  {Math.round(insights.recomendacao_causa_provavel.confianca * 100)}% confiança
                </span>
              </div>
              <ul style={{ paddingLeft: '20px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                {insights.recomendacao_causa_provavel.explicacao_curta.map((exp, i) => (
                  <li key={i}>{exp}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Knowledge Graph Tab */}
        {activeTab === 'grafo' && (
          <>
            <div style={{ 
              background: 'rgba(72, 202, 228, 0.1)', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              🕸️ <strong>Knowledge Graph (beta):</strong> Visualização das relações entre sinais, causas e ações
            </div>

            <div className="knowledge-graph">
              {/* Center node */}
              <div className="graph-center">
                🔴 {insights.modo_falha}
              </div>

              {/* Connected nodes */}
              <div className="graph-nodes">
                {/* Sinais */}
                {insights.knowledge_graph.nodes
                  .filter(n => n.type === 'sinal')
                  .map(node => {
                    const edge = insights.knowledge_graph.edges.find(e => e.from === node.id);
                    return (
                      <div key={node.id} className="graph-node sinal">
                        <div className="node-circle">{edge?.weight || 0}</div>
                        <div className="node-label">{node.label}</div>
                      </div>
                    );
                  })}
              </div>

              <div className="graph-nodes" style={{ marginTop: '16px' }}>
                {/* Causas */}
                {insights.knowledge_graph.nodes
                  .filter(n => n.type === 'causa')
                  .map(node => {
                    const edge = insights.knowledge_graph.edges.find(e => e.from === node.id);
                    return (
                      <div key={node.id} className="graph-node causa">
                        <div className="node-circle">{edge?.weight || 0}</div>
                        <div className="node-label">{node.label}</div>
                      </div>
                    );
                  })}
              </div>

              <div className="graph-nodes" style={{ marginTop: '16px' }}>
                {/* Ações */}
                {insights.knowledge_graph.nodes
                  .filter(n => n.type === 'acao')
                  .map(node => {
                    const edge = insights.knowledge_graph.edges.find(e => e.from === node.id);
                    return (
                      <div key={node.id} className="graph-node acao">
                        <div className="node-circle">{edge?.weight || 0}</div>
                        <div className="node-label">{node.label}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '24px',
              marginTop: '16px',
              fontSize: '14px'
            }}>
              <span><span style={{ color: 'var(--color-info)' }}>●</span> Sinais</span>
              <span><span style={{ color: 'var(--color-warning)' }}>●</span> Causas</span>
              <span><span style={{ color: 'var(--color-success)' }}>●</span> Ações</span>
            </div>
          </>
        )}

        {/* PFMEA Update Tab */}
        {activeTab === 'pfmea' && (
          <>
            <div style={{ 
              background: 'rgba(0, 191, 99, 0.1)', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              📋 <strong>Atualização Assistida (beta):</strong> Sugestões baseadas nas percepções registradas
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Sugestão de Atualização do PFMEA</span>
                <span className="status-badge tendencia" style={{ padding: '4px 12px' }}>
                  {insights.atualizacao_assistida_pfmea.status.replace('_', ' ')}
                </span>
              </div>

              <div style={{ 
                background: 'var(--color-bg)',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                {insights.atualizacao_assistida_pfmea.diff_texto.map((line, i) => (
                  <div key={i} style={{ 
                    padding: '8px',
                    borderBottom: i < insights.atualizacao_assistida_pfmea.diff_texto.length - 1 
                      ? '1px solid var(--color-bg-input)' 
                      : 'none'
                  }}>
                    <span style={{ color: 'var(--color-success)', marginRight: '8px' }}>+</span>
                    {line}
                  </div>
                ))}
              </div>

              <button 
                className="btn btn-success btn-block"
                style={{ marginTop: '16px' }}
                onClick={() => setShowApprovalModal(true)}
              >
                ✓ {insights.atualizacao_assistida_pfmea.acao_mock}
              </button>
            </div>

            {/* Current PFMEA info */}
            <div className="card" style={{ marginTop: '16px' }}>
              <div className="card-title" style={{ marginBottom: '16px' }}>
                PFMEA Atual — {pfmeaBolhas.pfmea_id}
              </div>
              
              <div className="info-grid">
                <div className="info-item">
                  <div className="label">Modo de Falha</div>
                  <div className="value" style={{ fontSize: '16px' }}>{pfmeaBolhas.modo_falha}</div>
                </div>
                <div className="info-item">
                  <div className="label">Efeito</div>
                  <div className="value" style={{ fontSize: '16px' }}>{pfmeaBolhas.efeito}</div>
                </div>
                <div className="info-item">
                  <div className="label">Severidade</div>
                  <div className="value">{pfmeaBolhas.severidade}</div>
                </div>
                <div className="info-item">
                  <div className="label">Ocorrência</div>
                  <div className="value">{pfmeaBolhas.ocorrencia}</div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div className="label" style={{ marginBottom: '8px' }}>Causas Conhecidas</div>
                {pfmeaBolhas.causas_conhecidas.map(causa => (
                  <div 
                    key={causa.causa_id}
                    style={{
                      background: 'var(--color-bg)',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <strong>{causa.causa_id}:</strong> {causa.descricao}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 100
        }}>
          <div className="card" style={{ 
            maxWidth: '500px', 
            width: '100%',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div className="success-icon" style={{ textAlign: 'center' }}>✅</div>
            <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>
              Sugestão Aprovada (Mock)
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              Em uma implementação real, esta sugestão seria enviada para revisão 
              do Engenheiro de Processo/Qualidade antes de atualizar o PFMEA oficial.
            </p>
            <button 
              className="btn btn-primary btn-block"
              onClick={() => setShowApprovalModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
