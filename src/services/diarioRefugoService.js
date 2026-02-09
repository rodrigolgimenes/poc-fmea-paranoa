/**
 * Serviço de Diário de Refugo - Usando API Express (SQL Server)
 * Migrado de Supabase para backend local
 */

import * as api from './api';

// Re-exportar funções da API
export const buscarRefugoPorEtiqueta = api.buscarRefugoPorEtiqueta;
export const criarEvento = api.criarEvento;
export const uploadMidia = api.uploadMidia;
export const finalizarEvento = api.finalizarEvento;
export const buscarEventoPorId = api.buscarEventoPorId;
export const listarEventosRecentes = api.listarEventosRecentes;
export const atualizarTranscricao = api.atualizarTranscricao;

/**
 * Exclui um evento (TODO: implementar no backend)
 */
export async function excluirEvento(eventoId) {
  console.warn('[diarioRefugoService] excluirEvento não implementado no backend');
  return { ok: false, error: { message: 'Funcionalidade não implementada' } };
}

/**
 * Transcrição retroativa (TODO: implementar no backend)
 */
export async function transcreverRetroativo(limit = 50) {
  console.warn('[diarioRefugoService] transcreverRetroativo não implementado no backend');
  return { ok: false, error: { message: 'Funcionalidade não implementada' } };
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
