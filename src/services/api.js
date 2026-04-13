/**
 * Serviço de API para comunicação com o backend Express
 * Substitui chamadas diretas ao Supabase
 */

// Em produção (Docker), usa URL relativa pois Nginx faz proxy
// Em desenvolvimento, usa localhost:3001
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

/**
 * Helper para fazer requisições à API
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      return { data: null, error: data.error || { message: `HTTP ${response.status}` } };
    }
    
    return data;
  } catch (error) {
    console.error('[API] Erro:', error.message);
    return { data: null, error: { message: error.message } };
  }
}

// ==================== REFUGO ====================

/**
 * Busca dados de refugo pela etiqueta
 */
export async function buscarRefugoPorEtiqueta(etiqueta) {
  if (!etiqueta?.trim()) {
    return { data: null, error: { message: 'Etiqueta inválida' } };
  }
  
  const result = await fetchApi(`/api/refugo/${encodeURIComponent(etiqueta.trim())}`);
  
  if (result.error && result.error.message === 'Etiqueta não encontrada') {
    return { 
      data: null, 
      error: { message: 'Etiqueta não encontrada / refugo não registrado ainda' } 
    };
  }
  
  // Formata os dados para o formato esperado pelo frontend
  if (result.data) {
    result.data = {
      ...result.data,
      nome_produto: result.data.nome_produto || result.data.cod_produto,
      linha: result.data.linha || null,
      maquina: result.data.maquina || null,
      posto: result.data.posto || null,
    };
  }
  
  return result;
}

/**
 * Lista refugos recentes
 */
export async function listarRefugos(limite = 50) {
  return fetchApi(`/api/refugos?limit=${limite}`);
}

// ==================== DIÁRIO DE BORDO ====================

/**
 * Cria um novo evento de diário
 */
export async function criarEvento(dadosEvento) {
  return fetchApi('/api/diario-evento', {
    method: 'POST',
    body: JSON.stringify({
      etiqueta: dadosEvento.etiqueta,
      cod_defeito: dadosEvento.cod_defeito,
      desc_defeito: dadosEvento.desc_defeito,
      cod_produto: dadosEvento.cod_produto,
      op: dadosEvento.op,
      dt_refugo: dadosEvento.dt_refugo,
      centro_custo: dadosEvento.centro_custo,
      usuario_nome: dadosEvento.usuario_nome,
      usuario_matricula: dadosEvento.usuario_matricula,
    }),
  });
}

/**
 * Busca evento por ID
 */
export async function buscarEventoPorId(eventoId) {
  return fetchApi(`/api/diario-evento/${eventoId}`);
}

/**
 * Lista eventos recentes com mídias
 */
export async function listarEventosRecentes(limite = 100) {
  return fetchApi(`/api/diario-eventos?limit=${limite}`);
}

/**
 * Busca resumo IA + histórico da Kgraph por etiqueta (proxy servidor)
 */
export async function buscarResumoKgraph(tag) {
  if (!tag?.trim()) {
    return { data: null, error: { message: 'tag inválido' } };
  }
  return fetchApi('/api/kgraph/taghistory', {
    method: 'POST',
    body: JSON.stringify({ tag: tag.trim() }),
  });
}

/**
 * Busca histórico completo do diário por código de produto
 */
export async function buscarEventosPorProduto(codProduto) {
  if (!codProduto?.trim()) {
    return { data: null, error: { message: 'Código do produto inválido' } };
  }
  return fetchApi(`/api/diario-eventos/produto/${encodeURIComponent(codProduto.trim())}`);
}

/**
 * Busca histórico completo do diário por etiqueta
 */
export async function buscarEventosPorEtiqueta(etiqueta) {
  if (!etiqueta?.trim()) {
    return { data: null, error: { message: 'Etiqueta inválida' } };
  }
  return fetchApi(`/api/diario-eventos/etiqueta/${encodeURIComponent(etiqueta.trim())}`);
}

/**
 * Envia feedback de "Útil" para o Kgraph
 */
export async function enviarFeedbackUtil(queryTag, diarioTag) {
  if (!queryTag?.trim() || !diarioTag?.trim()) {
    return { data: null, error: { message: 'query_tag e diario_tag são obrigatórios' } };
  }
  return fetchApi('/api/kgraph/feedback', {
    method: 'POST',
    body: JSON.stringify({ query_tag: queryTag.trim(), diario_tag: diarioTag.trim() }),
  });
}

// ==================== FEEDBACK PERSISTIDO ====================

/**
 * Marcar observação como útil (persiste no banco + auditoria)
 */
export async function marcarFeedbackUtil(eventoId, queryTag, diarioTag) {
  return fetchApi('/api/diario-feedback', {
    method: 'POST',
    body: JSON.stringify({ evento_id: eventoId, query_tag: queryTag, diario_tag: diarioTag }),
  });
}

/**
 * Desmarcar observação como útil (remove do banco + auditoria)
 */
export async function desmarcarFeedbackUtil(eventoId) {
  return fetchApi(`/api/diario-feedback/${eventoId}`, { method: 'DELETE' });
}

/**
 * Consultar feedback em lote por evento_ids
 */
export async function consultarFeedbackBatch(eventoIds) {
  if (!eventoIds?.length) return { data: [], error: null };
  return fetchApi('/api/diario-feedback/batch', {
    method: 'POST',
    body: JSON.stringify({ evento_ids: eventoIds }),
  });
}

/**
 * Atualiza transcrições do evento
 */
export async function atualizarTranscricao(eventoId, { detalhe = null, observacao = null }) {
  return fetchApi(`/api/diario-evento/${eventoId}/transcricao`, {
    method: 'PATCH',
    body: JSON.stringify({ detalhe, observacao }),
  });
}

/**
 * Finaliza o evento (marca como SAVED)
 */
export async function finalizarEvento(eventoId, transcricoes = {}) {
  // Primeiro atualiza transcrições se fornecidas
  if (transcricoes.detalhe !== undefined || transcricoes.observacao !== undefined) {
    await atualizarTranscricao(eventoId, transcricoes);
  }
  
  // Depois finaliza
  return fetchApi(`/api/diario-evento/${eventoId}/finalizar`, {
    method: 'PATCH',
  });
}

/**
 * Exclui um evento e suas mídias
 */
export async function excluirEvento(eventoId) {
  return fetchApi(`/api/diario-evento/${eventoId}`, {
    method: 'DELETE',
  });
}

// ==================== MÍDIA ====================

/**
 * Registra uma mídia no banco (metadados)
 * NOTA: O upload do arquivo real precisa ser tratado separadamente
 */
export async function registrarMidia(eventoId, tipo, metadados = {}) {
  return fetchApi('/api/diario-midia', {
    method: 'POST',
    body: JSON.stringify({
      evento_id: eventoId,
      tipo: tipo,
      arquivo_url: metadados.arquivo_url || null,
      arquivo_path: metadados.arquivo_path || null,
      mime_type: metadados.mime_type || null,
      duracao_seg: metadados.duracao_seg || null,
      tamanho_bytes: metadados.tamanho_bytes || null,
    }),
  });
}

/**
 * Upload de mídia para o servidor
 * Envia arquivo e registra metadados no banco
 */
export async function uploadMidia(eventoId, arquivo, tipo, metadados = {}) {
  const url = `${API_BASE_URL}/api/upload-midia`;
  
  const formData = new FormData();
  // IMPORTANTE: Enviar campos de texto ANTES do arquivo
  // para que o multer tenha acesso a req.body.tipo no callback destination
  formData.append('evento_id', eventoId);
  formData.append('tipo', tipo);
  if (metadados.duracao_seg) {
    formData.append('duracao_seg', metadados.duracao_seg.toString());
  }
  // Arquivo por último
  formData.append('file', arquivo);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Não definir Content-Type - o browser define automaticamente para multipart/form-data
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { data: null, error: data.error || { message: `HTTP ${response.status}` } };
    }
    
    console.log('[API] Upload concluído:', data.data?.arquivo_url);
    return data;
  } catch (error) {
    console.error('[API] Erro no upload:', error.message);
    return { data: null, error: { message: error.message } };
  }
}

// ==================== UTILITÁRIOS ====================

/**
 * Testa conexão com a API
 */
export async function testConnection() {
  return fetchApi('/api/test-connection');
}

/**
 * Health check
 */
export async function healthCheck() {
  return fetchApi('/api/health');
}

export default {
  buscarRefugoPorEtiqueta,
  listarRefugos,
  criarEvento,
  buscarEventoPorId,
  listarEventosRecentes,
  buscarEventosPorProduto,
  buscarEventosPorEtiqueta,
  buscarResumoKgraph,
  enviarFeedbackUtil,
  marcarFeedbackUtil,
  desmarcarFeedbackUtil,
  consultarFeedbackBatch,
  atualizarTranscricao,
  finalizarEvento,
  excluirEvento,
  registrarMidia,
  uploadMidia,
  testConnection,
  healthCheck,
};
