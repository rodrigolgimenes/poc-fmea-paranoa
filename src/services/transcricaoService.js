/**
 * Serviço de transcrição de áudio usando Supabase Edge Function
 * A Edge Function chama OpenAI Whisper e salva a transcrição no banco
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ermtbcmnokzhlzoyztou.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/transcribe-audio`;

/**
 * Transcreve um arquivo de áudio usando a Edge Function do Supabase
 * @param {Blob} audioBlob - Blob do arquivo de áudio
 * @param {string} eventoId - ID do evento para salvar a transcrição
 * @param {string} tipo - Tipo do áudio: 'detalhe' ou 'observacao'
 * @param {string} language - Idioma do áudio (default: pt)
 * @returns {Promise<{text: string, error: string|null}>}
 */
export async function transcreverAudio(audioBlob, eventoId = null, tipo = 'detalhe', language = 'pt') {
  console.log('[Transcrição] Iniciando transcrição via Edge Function...');
  console.log('[Transcrição] URL:', EDGE_FUNCTION_URL);
  
  if (!audioBlob) {
    console.error('[Transcrição] Blob de áudio não fornecido');
    return { text: null, error: 'Áudio não fornecido' };
  }

  console.log('[Transcrição] Audio blob:', {
    size: audioBlob.size,
    type: audioBlob.type,
  });

  try {
    // Criar FormData para enviar o arquivo
    const formData = new FormData();
    
    // Determinar extensão baseado no tipo MIME
    const extension = getExtensionFromMime(audioBlob.type);
    const fileName = `audio.${extension}`;
    
    console.log('[Transcrição] Enviando arquivo:', fileName);
    
    // Adicionar arquivo e metadados ao FormData
    formData.append('file', audioBlob, fileName);
    formData.append('language', language);
    
    // Adicionar evento_id e tipo se fornecidos (para salvar no banco)
    if (eventoId) {
      formData.append('evento_id', eventoId);
      formData.append('tipo', tipo);
    }

    // Enviar para Edge Function
    console.log('[Transcrição] Enviando para Edge Function...');
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      body: formData,
    });

    console.log('[Transcrição] Response status:', response.status);

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[Transcrição] Erro na Edge Function:', data);
      return { 
        text: null, 
        error: data.error || `Erro HTTP ${response.status}` 
      };
    }

    console.log('[Transcrição] Texto transcrito:', data.text);
    return { text: data.text, error: null };

  } catch (error) {
    console.error('[Transcrição] Erro ao transcrever áudio:', error);
    return { text: null, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Transcreve múltiplos áudios em paralelo
 * @param {Array<{blob: Blob, tipo: string}>} audios - Array de áudios para transcrever
 * @returns {Promise<Object>} - Objeto com transcrições por tipo
 */
export async function transcreverMultiplosAudios(audios) {
  const transcricoes = {};
  
  const promises = audios.map(async ({ blob, tipo }) => {
    if (!blob) return;
    
    const result = await transcreverAudio(blob);
    transcricoes[tipo] = {
      texto: result.text,
      erro: result.error,
    };
  });

  await Promise.all(promises);
  return transcricoes;
}

/**
 * Helper para obter extensão do arquivo pelo MIME type
 */
function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
  };
  return mimeMap[mimeType] || 'webm';
}

export default {
  transcreverAudio,
  transcreverMultiplosAudios,
};
