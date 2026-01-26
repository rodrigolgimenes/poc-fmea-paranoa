import { supabase } from './supabase';

/**
 * Busca dados de refugo pela etiqueta na tabela dw_refugo_evento
 * Retorna o registro mais recente se houver múltiplos
 */
export async function buscarRefugoPorEtiqueta(etiqueta) {
  if (!etiqueta?.trim()) {
    return { data: null, error: { message: 'Etiqueta inválida' } };
  }

  const etiquetaLimpa = etiqueta.trim();

  // Busca na tabela dw_refugo_evento (origem: ELIPSE)
  const { data, error } = await supabase
    .from('dw_refugo_evento')
    .select('*')
    .eq('etiqueta', etiquetaLimpa)
    .order('dt_refugo', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // Se não encontrou, retorna mensagem amigável
    if (error.code === 'PGRST116') {
      return { 
        data: null, 
        error: { message: 'Etiqueta não encontrada / refugo não registrado ainda' } 
      };
    }
    console.error('Erro ao buscar refugo:', error);
    return { data: null, error };
  }

  // Formata os dados para o formato esperado pelo frontend
  const refugoFormatado = {
    id: data.id,
    etiqueta: data.etiqueta,
    cod_defeito: data.cod_defeito,
    desc_defeito: data.desc_defeito,
    cod_produto: data.cod_produto,
    nome_produto: data.cod_produto, // Pode ser enriquecido com lookup em tabela de produtos
    op: data.op,
    dt_refugo: data.dt_refugo,
    data_refugo: data.data_refugo,
    centro_custo: data.centro_custo,
    filial: data.filial,
    usuario: data.usuario,
    qtd_retrabalho: data.qtd_retrabalho,
    origem: data.origem,
    // Campos que podem ser adicionados futuramente
    linha: null,
    maquina: null,
    posto: null,
  };

  return { data: refugoFormatado, error: null };
}

/**
 * Cria um novo evento de diário de refugo
 */
export async function criarEvento(dadosEvento) {
  const { data, error } = await supabase
    .from('dw_diario_refugo_evento')
    .insert([{
      etiqueta: dadosEvento.etiqueta,
      refugo_origem: dadosEvento.refugo_origem || 'ELIPSE_E3.v_Refugo',
      cod_defeito: dadosEvento.cod_defeito,
      desc_defeito: dadosEvento.desc_defeito,
      cod_produto: dadosEvento.cod_produto,
      op: dadosEvento.op,
      dt_refugo: dadosEvento.dt_refugo,
      centro_custo: dadosEvento.centro_custo,
      linha: dadosEvento.linha,
      maquina: dadosEvento.maquina,
      posto: dadosEvento.posto,
      usuario_id: dadosEvento.usuario_id,
      usuario_matricula: dadosEvento.usuario_matricula,
      usuario_nome: dadosEvento.usuario_nome,
      status: 'PENDING',
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Faz upload de mídia (áudio ou foto) para o storage
 */
export async function uploadMidia(eventoId, arquivo, tipo, metadados = {}) {
  const timestamp = Date.now();
  const extensao = arquivo.name?.split('.').pop() || getExtensaoFromMime(arquivo.type);
  const nomeArquivo = `${tipo.toLowerCase()}_${timestamp}.${extensao}`;
  const caminho = `${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}/${eventoId}/${nomeArquivo}`;

  // Upload do arquivo para o storage
  const { error: uploadError } = await supabase.storage
    .from('diario-refugo')
    .upload(caminho, arquivo, {
      contentType: arquivo.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Erro no upload:', uploadError);
    return { data: null, error: uploadError };
  }

  // Obter URL pública
  const { data: urlData } = supabase.storage
    .from('diario-refugo')
    .getPublicUrl(caminho);

  // Registrar mídia no banco
  const { data: midiaData, error: midiaError } = await supabase
    .from('dw_diario_refugo_midia')
    .insert([{
      evento_id: eventoId,
      tipo: tipo,
      arquivo_url: urlData?.publicUrl,
      arquivo_path: caminho,
      mime_type: arquivo.type,
      duracao_seg: metadados.duracao_seg || null,
      tamanho_bytes: arquivo.size,
      hash_checksum: metadados.hash_checksum || null,
    }])
    .select()
    .single();

  if (midiaError) {
    console.error('Erro ao registrar mídia:', midiaError);
    return { data: null, error: midiaError };
  }

  return { data: { ...midiaData, arquivo_url: urlData?.publicUrl }, error: null };
}

/**
 * Finaliza o evento (marca como SAVED)
 * Nota: Só atualiza transcrições se forem explicitamente fornecidas
 * para não sobrescrever valores já salvos pela Edge Function
 */
export async function finalizarEvento(eventoId, transcricoes = {}) {
  // Construir objeto de update apenas com campos que devem ser atualizados
  const updateData = { status: 'SAVED' };
  
  // Só incluir transcrições se forem explicitamente fornecidas
  if (transcricoes.detalhe !== undefined) {
    updateData.transcricao_detalhe = transcricoes.detalhe;
  }
  if (transcricoes.observacao !== undefined) {
    updateData.transcricao_observacao = transcricoes.observacao;
  }

  const { data, error } = await supabase
    .from('dw_diario_refugo_evento')
    .update(updateData)
    .eq('evento_id', eventoId)
    .select()
    .single();

  return { data, error };
}

/**
 * Busca evento por ID
 */
export async function buscarEventoPorId(eventoId) {
  const { data, error } = await supabase
    .from('dw_diario_refugo_evento')
    .select(`
      *,
      midias:dw_diario_refugo_midia(*)
    `)
    .eq('evento_id', eventoId)
    .single();

  return { data, error };
}

/**
 * Lista eventos recentes
 */
export async function listarEventosRecentes(limite = 10) {
  const { data, error } = await supabase
    .from('dw_diario_refugo_evento')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);

  return { data, error };
}

/**
 * Helper para obter extensão do arquivo pelo MIME type
 */
function getExtensaoFromMime(mimeType) {
  const mimeMap = {
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return mimeMap[mimeType] || 'bin';
}

/**
 * Atualiza os campos de transcrição de um evento
 */
export async function atualizarTranscricao(eventoId, { detalhe = null, observacao = null }) {
  const updates = {};
  if (typeof detalhe === 'string') updates.transcricao_detalhe = detalhe;
  if (typeof observacao === 'string') updates.transcricao_observacao = observacao;

  const { data, error } = await supabase
    .from('dw_diario_refugo_evento')
    .update(updates)
    .eq('evento_id', eventoId)
    .select()
    .single();

  return { data, error };
}

/**
 * Exclui um evento e suas mídias (inclui remoção no storage)
 */
export async function excluirEvento(eventoId) {
  // 1) Buscar mídias para deletar do storage
  const { data: midias, error: midiasError } = await supabase
    .from('dw_diario_refugo_midia')
    .select('arquivo_path')
    .eq('evento_id', eventoId);
  if (midiasError) return { ok: false, error: midiasError };

  // 2) Remover arquivos do storage
  const paths = (midias || []).map(m => m.arquivo_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase
      .storage.from('diario-refugo').remove(paths);
    if (storageError) console.warn('[excluirEvento] erro removendo storage:', storageError);
  }

  // 3) Remover registros de mídias
  const { error: delMidiasError } = await supabase
    .from('dw_diario_refugo_midia')
    .delete()
    .eq('evento_id', eventoId);
  if (delMidiasError) return { ok: false, error: delMidiasError };

  // 4) Remover evento
  const { error: delEventoError } = await supabase
    .from('dw_diario_refugo_evento')
    .delete()
    .eq('evento_id', eventoId);
  if (delEventoError) return { ok: false, error: delEventoError };

  return { ok: true };
}

/**
 * Dispara função de transcrição retroativa (Edge Function)
 */
export async function transcreverRetroativo(limit = 50) {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const fnUrl = `${SUPABASE_URL}/functions/v1/transcribe-audio-batch?limit=${limit}`;
  const res = await fetch(fnUrl, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, data };
}

export default {
  buscarRefugoPorEtiqueta,
  criarEvento,
  uploadMidia,
  finalizarEvento,
  buscarEventoPorId,
  listarEventosRecentes,
  atualizarTranscricao,
  excluirEvento,
  transcreverRetroativo,
};
