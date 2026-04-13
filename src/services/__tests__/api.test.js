import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: '', PROD: false } } });

let api;

beforeEach(async () => {
  vi.clearAllMocks();
  // Importa o módulo fresco (vitest cacheia, mas o mock de fetch é limpo)
  api = await import('../api.js');
});

// ==================== buscarEventosPorEtiqueta ====================

describe('buscarEventosPorEtiqueta', () => {
  it('faz GET para /api/diario-eventos/etiqueta/:etiqueta', async () => {
    const fakeData = [{ evento_id: '123', etiqueta: '0016645564' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: fakeData, error: null }),
    });

    const result = await api.buscarEventosPorEtiqueta('0016645564');

    expect(result.data).toEqual(fakeData);
    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/diario-eventos/etiqueta/0016645564');
  });

  it('retorna erro para etiqueta vazia', async () => {
    const result = await api.buscarEventosPorEtiqueta('');

    expect(result.data).toBeNull();
    expect(result.error.message).toBe('Etiqueta inválida');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna erro para etiqueta null', async () => {
    const result = await api.buscarEventosPorEtiqueta(null);

    expect(result.data).toBeNull();
    expect(result.error.message).toBe('Etiqueta inválida');
  });
});

// ==================== buscarResumoKgraph ====================

describe('buscarResumoKgraph', () => {
  it('envia { tag } no payload POST', async () => {
    const fakeResumo = { tag: '0016645564', recommendations: 'Ajustar pressão' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: fakeResumo, error: null }),
    });

    const result = await api.buscarResumoKgraph('0016645564');

    expect(result.data).toEqual(fakeResumo);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/kgraph/taghistory');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body).toEqual({ tag: '0016645564' });
    // Garante que NÃO envia part_number
    expect(body).not.toHaveProperty('part_number');
  });

  it('faz trim na tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: {}, error: null }),
    });

    await api.buscarResumoKgraph('  0016645564  ');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tag).toBe('0016645564');
  });

  it('retorna erro para tag vazia', async () => {
    const result = await api.buscarResumoKgraph('');

    expect(result.data).toBeNull();
    expect(result.error.message).toBe('tag inválido');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ==================== enviarFeedbackUtil ====================

describe('enviarFeedbackUtil', () => {
  it('envia POST com { query_tag, diario_tag }', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { status: 'ok' }, error: null }),
    });

    const result = await api.enviarFeedbackUtil('0016645564', '0016702116');

    expect(result.data).toEqual({ status: 'ok' });
    expect(result.error).toBeNull();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/kgraph/feedback');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      query_tag: '0016645564',
      diario_tag: '0016702116',
    });
  });

  it('faz trim nas tags', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: {}, error: null }),
    });

    await api.enviarFeedbackUtil('  0016645564  ', '  0016702116  ');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.query_tag).toBe('0016645564');
    expect(body.diario_tag).toBe('0016702116');
  });

  it('retorna erro quando query_tag está vazio', async () => {
    const result = await api.enviarFeedbackUtil('', '0016702116');

    expect(result.data).toBeNull();
    expect(result.error.message).toContain('obrigatórios');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna erro quando diario_tag está vazio', async () => {
    const result = await api.enviarFeedbackUtil('0016645564', '');

    expect(result.data).toBeNull();
    expect(result.error.message).toContain('obrigatórios');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna erro quando ambos estão null', async () => {
    const result = await api.enviarFeedbackUtil(null, null);

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lida com erro HTTP do servidor', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Server error' } }),
    });

    const result = await api.enviarFeedbackUtil('0016645564', '0016702116');

    expect(result.error).toBeTruthy();
  });
});
