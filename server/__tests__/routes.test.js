import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock mssql antes de importar o app
vi.mock('mssql', () => {
  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn(),
  };
  const mockPool = {
    request: () => mockRequest,
    close: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockPool),
      VarChar: 'VarChar',
      Int: 'Int',
      UniqueIdentifier: 'UniqueIdentifier',
      NVarChar: 'NVarChar',
      DateTime: 'DateTime',
    },
    VarChar: 'VarChar',
    Int: 'Int',
    UniqueIdentifier: 'UniqueIdentifier',
    NVarChar: 'NVarChar',
    DateTime: 'DateTime',
    connect: vi.fn(),
  };
});

// Mock dotenv
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

// Mock fetch global
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper para obter o mockRequest do pool
let mockQuery;
let app;

beforeEach(async () => {
  vi.clearAllMocks();

  // Re-import para pegar o mock limpo
  const mssql = await import('mssql');
  const mockPool = await mssql.default.connect();
  mockQuery = mockPool.request().query;

  // Import app (servidor não inicia por causa do guard)
  const server = await import('../index.js');
  app = server.app;
});

// ==================== GET /api/diario-eventos/etiqueta/:etiqueta ====================

describe('GET /api/diario-eventos/etiqueta/:etiqueta', () => {
  it('retorna eventos agrupados com mídias para uma etiqueta', async () => {
    const fakeEvento = {
      evento_id: 'aaa-bbb-ccc',
      etiqueta: '0016645564',
      cod_defeito: 'T00040',
      desc_defeito: 'M. FORMACAO',
      created_at: '2026-04-01T07:14:30Z',
    };
    const fakeMidia = {
      midia_id: 'mmm-111',
      evento_id: 'aaa-bbb-ccc',
      tipo: 'AUDIO_DETALHE',
    };

    // Primeira query: eventos
    mockQuery.mockResolvedValueOnce({ recordset: [fakeEvento] });
    // Segunda query: mídias do evento
    mockQuery.mockResolvedValueOnce({ recordset: [fakeMidia] });

    const res = await request(app).get('/api/diario-eventos/etiqueta/0016645564');

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].etiqueta).toBe('0016645564');
    expect(res.body.data[0].midias).toHaveLength(1);
    expect(res.body.data[0].midias[0].tipo).toBe('AUDIO_DETALHE');
  });

  it('retorna lista vazia quando não há eventos para a etiqueta', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await request(app).get('/api/diario-eventos/etiqueta/9999999999');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.error).toBeNull();
  });
});

// ==================== POST /api/kgraph/taghistory ====================

describe('POST /api/kgraph/taghistory', () => {
  it('envia { tag } ao Kgraph e retorna dados', async () => {
    const kgraphResponse = {
      tag: '0016645564',
      recommendations: 'Verificar pressão',
      violations_recommended: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(kgraphResponse),
    });

    const res = await request(app)
      .post('/api/kgraph/taghistory')
      .send({ tag: '0016645564' });

    expect(res.status).toBe(200);
    expect(res.body.data.tag).toBe('0016645564');
    expect(res.body.error).toBeNull();

    // Verifica que o fetch foi chamado com { tag } no body
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://kgraph.anjuna-tech.com/tag-alert/taghistory');
    expect(JSON.parse(options.body)).toEqual({ tag: '0016645564' });
    expect(options.headers['Authorization']).toMatch(/^Bearer /);
  });

  it('retorna 400 quando tag não é fornecido', async () => {
    const res = await request(app)
      .post('/api/kgraph/taghistory')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('tag é obrigatório');
  });

  it('retorna 404 quando Kgraph responde INVALID_TAG', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'INVALID_TAG' }),
    });

    const res = await request(app)
      .post('/api/kgraph/taghistory')
      .send({ tag: 'INVALIDA' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('INVALIDA');
  });
});

// ==================== POST /api/kgraph/feedback ====================

describe('POST /api/kgraph/feedback', () => {
  it('envia feedback "Útil" com query_tag e diario_tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const res = await request(app)
      .post('/api/kgraph/feedback')
      .send({ query_tag: '0016645564', diario_tag: '0016702116' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    // Verifica o payload enviado ao Kgraph
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://kgraph.anjuna-tech.com/tag-alert/feedback');
    expect(JSON.parse(options.body)).toEqual({
      query_tag: '0016645564',
      diario_tag: '0016702116',
    });
    // Sem header de Authorization
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('retorna 400 quando query_tag está ausente', async () => {
    const res = await request(app)
      .post('/api/kgraph/feedback')
      .send({ diario_tag: '0016702116' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('obrigatórios');
  });

  it('retorna 400 quando diario_tag está ausente', async () => {
    const res = await request(app)
      .post('/api/kgraph/feedback')
      .send({ query_tag: '0016645564' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('obrigatórios');
  });

  it('repassa erro quando Kgraph retorna falha', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: 'bad gateway' }),
    });

    const res = await request(app)
      .post('/api/kgraph/feedback')
      .send({ query_tag: '0016645564', diario_tag: '0016702116' });

    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe('Erro ao enviar feedback');
  });
});
