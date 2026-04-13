import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente do .env na raiz do projeto
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Pasta de uploads (configurável via .env)
const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
const UPLOAD_URL_BASE = process.env.UPLOAD_URL_BASE || `http://localhost:${PORT}/uploads`;

// Criar pastas de upload se não existirem
const uploadDirs = ['audio', 'fotos', 'outros'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(UPLOAD_PATH, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`[Upload] Pasta criada: ${fullPath}`);
  }
});

// Configuração do Multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tipo = req.body.tipo || 'outros';
    let subDir = 'outros';
    if (tipo.includes('AUDIO')) subDir = 'audio';
    else if (tipo === 'FOTO') subDir = 'fotos';
    
    const uploadDir = path.join(UPLOAD_PATH, subDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || getExtFromMime(file.mimetype);
    const filename = `${req.body.tipo || 'file'}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Aceitar áudio e imagens
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'), false);
    }
  }
});

function getExtFromMime(mime) {
  const map = {
    'audio/webm': '.webm',
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mime] || '.bin';
}

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos de upload estaticamente (local primeiro)
app.use('/uploads', express.static(UPLOAD_PATH));

// Fallback: proxy para VM/produção quando arquivo não existe localmente
const UPLOAD_PROXY_URL = process.env.UPLOAD_PROXY_URL || '';
app.use('/uploads', async (req, res) => {
  if (!UPLOAD_PROXY_URL) {
    return res.status(404).send('Arquivo não encontrado');
  }

  const vmUrl = `${UPLOAD_PROXY_URL}${req.path}`;
  console.log(`[Upload Proxy] Arquivo local não encontrado, buscando da VM: ${vmUrl}`);

  try {
    const vmResponse = await fetch(vmUrl);
    if (!vmResponse.ok) {
      return res.status(404).send('Arquivo não encontrado na VM');
    }

    const contentType = vmResponse.headers.get('content-type');
    if (contentType) res.set('Content-Type', contentType);

    const buffer = await vmResponse.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`[Upload Proxy] Erro ao buscar da VM: ${err.message}`);
    res.status(502).send('Erro ao buscar arquivo da VM');
  }
});

// Configuração do SQL Server
const sqlConfig = {
  server: process.env.HOST_DB,
  port: parseInt(process.env.PORT_DB) || 1433,
  user: process.env.USER_DB,
  password: process.env.PASSWORD_DB,
  database: process.env.DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Pool de conexões
let pool = null;

async function getPool() {
  if (!pool) {
    console.log('[SQL Server] Conectando...');
    pool = await sql.connect(sqlConfig);
    console.log('[SQL Server] Conectado!');
  }
  return pool;
}

// ==================== ROTAS ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== TRANSCRIÇÃO (OpenAI Whisper) ====================

// Configuração do multer para transcrição (arquivo em memória)
const transcribeUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (limite do Whisper)
});

// Endpoint de transcrição de áudio
app.post('/api/transcribe-audio', transcribeUpload.single('file'), async (req, res) => {
  try {
    const { evento_id, tipo, language = 'pt' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo de áudio enviado' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error('[Transcrição] OPENAI_API_KEY não configurada');
      return res.status(500).json({ success: false, error: 'API Key do OpenAI não configurada' });
    }

    console.log(`[Transcrição] Processando ${tipo} para evento ${evento_id}`);
    console.log(`[Transcrição] Arquivo: ${req.file.originalname}, Tamanho: ${req.file.size}, Tipo: ${req.file.mimetype}`);

    // Criar FormData para enviar ao OpenAI
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname || 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    // Chamar API do OpenAI Whisper
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('[Transcrição] Erro Whisper:', errorText);
      return res.status(500).json({ 
        success: false, 
        error: `Erro Whisper API: ${whisperResponse.status}`,
        details: errorText,
      });
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;

    console.log(`[Transcrição] Texto: ${transcription}`);

    // Salvar transcrição no banco se evento_id fornecido
    if (evento_id && tipo) {
      try {
        const pool = await getPool();
        const column = tipo === 'detalhe' ? 'transcricao_detalhe' : 'transcricao_observacao';
        
        await pool.request()
          .input('evento_id', sql.UniqueIdentifier, evento_id)
          .input('transcricao', sql.NVarChar, transcription)
          .query(`UPDATE dw_diariobordo_refugo_evento SET ${column} = @transcricao WHERE evento_id = @evento_id`);
        
        console.log(`[Transcrição] Salvo ${column} para evento ${evento_id}`);
      } catch (dbError) {
        console.error('[Transcrição] Erro ao salvar no banco:', dbError.message);
        // Continua e retorna a transcrição mesmo se falhar ao salvar
      }
    }

    res.json({ success: true, text: transcription });

  } catch (error) {
    console.error('[Transcrição] Erro:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Testar conexão com o banco
app.get('/api/test-connection', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 as connected');
    res.json({ 
      success: true, 
      message: 'Conexão com SQL Server OK!',
      server: process.env.HOST_DB,
      database: process.env.DATABASE,
    });
  } catch (error) {
    console.error('[SQL Server] Erro:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      server: process.env.HOST_DB,
    });
  }
});

// Buscar refugo por etiqueta
app.get('/api/refugo/:etiqueta', async (req, res) => {
  try {
    const { etiqueta } = req.params;
    const pool = await getPool();
    
    // View do SQL Server com dados de refugo (origem: ELIPSE)
    // Colunas: ID, Filial, [Data], [Dt. Refugo], Etiqueta, [Cod. Produto], OP, 
    //          [Centro de Custo], [Cod. Defeito], [Desc. Defeito], Usuario, etc.
    const result = await pool.request()
      .input('etiqueta', sql.VarChar, etiqueta)
      .query(`
        SELECT TOP 1 
          ID as id,
          Filial as filial,
          [Data] as data_registro,
          [Dt. Refugo] as dt_refugo,
          Etiqueta as etiqueta,
          [Cod. Produto] as cod_produto,
          OP as op,
          [Centro de Custo] as centro_custo,
          [Cod. Defeito] as cod_defeito,
          [Desc. Defeito] as desc_defeito,
          Usuario as usuario,
          [Qtd. Retrabalho] as qtd_retrabalho,
          [Qtd. Refugo] as qtd_refugo,
          Numseq as numseq,
          Turno as turno,
          RECURSO as recurso
        FROM v_Refugo
        WHERE Etiqueta = @etiqueta
        ORDER BY [Dt. Refugo] DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        data: null, 
        error: { message: 'Etiqueta não encontrada' } 
      });
    }
    
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[API] Erro ao buscar refugo:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Listar refugos recentes
app.get('/api/refugos', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) 
          ID as id,
          Filial as filial,
          [Data] as data_registro,
          [Dt. Refugo] as dt_refugo,
          Etiqueta as etiqueta,
          [Cod. Produto] as cod_produto,
          OP as op,
          [Centro de Custo] as centro_custo,
          [Cod. Defeito] as cod_defeito,
          [Desc. Defeito] as desc_defeito,
          Usuario as usuario,
          [Qtd. Retrabalho] as qtd_retrabalho,
          [Qtd. Refugo] as qtd_refugo,
          Turno as turno
        FROM v_Refugo
        ORDER BY [Dt. Refugo] DESC
      `);
    
    res.json({ data: result.recordset, error: null });
  } catch (error) {
    console.error('[API] Erro ao listar refugos:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Criar evento no diário
app.post('/api/diario-evento', async (req, res) => {
  try {
    const dados = req.body;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('etiqueta', sql.VarChar, dados.etiqueta)
      .input('cod_defeito', sql.VarChar, dados.cod_defeito)
      .input('desc_defeito', sql.VarChar, dados.desc_defeito)
      .input('cod_produto', sql.VarChar, dados.cod_produto)
      .input('op', sql.VarChar, dados.op)
      .input('dt_refugo', sql.DateTime, dados.dt_refugo)
      .input('centro_custo', sql.VarChar, dados.centro_custo)
      .input('usuario_nome', sql.VarChar, dados.usuario_nome)
      .input('transcricao_detalhe', sql.NVarChar, dados.transcricao_detalhe)
      .input('transcricao_observacao', sql.NVarChar, dados.transcricao_observacao)
      .query(`
        INSERT INTO dw_diariobordo_refugo_evento 
        (etiqueta, cod_defeito, desc_defeito, cod_produto, op, dt_refugo, 
         centro_custo, usuario_nome, transcricao_detalhe, transcricao_observacao, created_at)
        OUTPUT INSERTED.*
        VALUES 
        (@etiqueta, @cod_defeito, @desc_defeito, @cod_produto, @op, @dt_refugo,
         @centro_custo, @usuario_nome, @transcricao_detalhe, @transcricao_observacao, GETDATE())
      `);
    
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[API] Erro ao criar evento:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Listar eventos do diário com mídias
app.get('/api/diario-eventos', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const pool = await getPool();
    
    // Buscar eventos
    const eventos = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) *
        FROM dw_diariobordo_refugo_evento
        ORDER BY created_at DESC
      `);
    
    // Para cada evento, buscar mídias
    const eventosComMidias = await Promise.all(
      eventos.recordset.map(async (evento) => {
        const midias = await pool.request()
          .input('evento_id', sql.UniqueIdentifier, evento.evento_id)
          .query(`
            SELECT * FROM dw_diariobordo_refugo_midia
            WHERE evento_id = @evento_id
          `);
        return { ...evento, midias: midias.recordset };
      })
    );
    
    res.json({ data: eventosComMidias, error: null });
  } catch (error) {
    console.error('[API] Erro ao listar eventos:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Buscar evento por ID
app.get('/api/diario-evento/:eventoId', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const pool = await getPool();
    
    const evento = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query(`
        SELECT * FROM dw_diariobordo_refugo_evento
        WHERE evento_id = @evento_id
      `);
    
    if (evento.recordset.length === 0) {
      return res.status(404).json({ 
        data: null, 
        error: { message: 'Evento não encontrado' } 
      });
    }
    
    const midias = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query(`
        SELECT * FROM dw_diariobordo_refugo_midia
        WHERE evento_id = @evento_id
      `);
    
    res.json({ 
      data: { ...evento.recordset[0], midias: midias.recordset }, 
      error: null 
    });
  } catch (error) {
    console.error('[API] Erro ao buscar evento:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Buscar histórico do diário por produto
app.get('/api/diario-eventos/produto/:codProduto', async (req, res) => {
  try {
    const { codProduto } = req.params;
    const pool = await getPool();

    const eventos = await pool.request()
      .input('cod_produto', sql.VarChar, codProduto)
      .query(`
        SELECT *
        FROM dw_diariobordo_refugo_evento
        WHERE cod_produto = @cod_produto
        ORDER BY created_at DESC
      `);

    // Para cada evento, buscar mídias
    const eventosComMidias = await Promise.all(
      eventos.recordset.map(async (evento) => {
        const midias = await pool.request()
          .input('evento_id', sql.UniqueIdentifier, evento.evento_id)
          .query('SELECT * FROM dw_diariobordo_refugo_midia WHERE evento_id = @evento_id');
        return { ...evento, midias: midias.recordset };
      })
    );

    res.json({ data: eventosComMidias, error: null });
  } catch (error) {
    console.error('[API] Erro ao buscar eventos por produto:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Buscar histórico do diário por etiqueta
app.get('/api/diario-eventos/etiqueta/:etiqueta', async (req, res) => {
  try {
    const { etiqueta } = req.params;
    const pool = await getPool();

    const eventos = await pool.request()
      .input('etiqueta', sql.VarChar, etiqueta)
      .query(`
        SELECT *
        FROM dw_diariobordo_refugo_evento
        WHERE etiqueta = @etiqueta
        ORDER BY created_at DESC
      `);

    // Para cada evento, buscar mídias
    const eventosComMidias = await Promise.all(
      eventos.recordset.map(async (evento) => {
        const midias = await pool.request()
          .input('evento_id', sql.UniqueIdentifier, evento.evento_id)
          .query('SELECT * FROM dw_diariobordo_refugo_midia WHERE evento_id = @evento_id');
        return { ...evento, midias: midias.recordset };
      })
    );

    res.json({ data: eventosComMidias, error: null });
  } catch (error) {
    console.error('[API] Erro ao buscar eventos por etiqueta:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Upload de mídia (com arquivo)
app.post('/api/upload-midia', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ data: null, error: { message: 'Nenhum arquivo enviado' } });
    }

    const { evento_id, tipo, duracao_seg } = req.body;
    const pool = await getPool();
    
    // Determinar subpasta para URL
    let subDir = 'outros';
    if (tipo?.includes('AUDIO')) subDir = 'audio';
    else if (tipo === 'FOTO') subDir = 'fotos';
    
    const arquivo_url = `${UPLOAD_URL_BASE}/${subDir}/${req.file.filename}`;
    const arquivo_path = req.file.path;
    
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, evento_id)
      .input('tipo', sql.VarChar, tipo)
      .input('arquivo_url', sql.VarChar, arquivo_url)
      .input('arquivo_path', sql.VarChar, arquivo_path)
      .input('mime_type', sql.VarChar, req.file.mimetype)
      .input('duracao_seg', sql.Int, duracao_seg ? parseInt(duracao_seg) : null)
      .input('tamanho_bytes', sql.Int, req.file.size)
      .query(`
        INSERT INTO dw_diariobordo_refugo_midia
        (evento_id, tipo, arquivo_url, arquivo_path, mime_type, duracao_seg, tamanho_bytes, created_at)
        OUTPUT INSERTED.*
        VALUES
        (@evento_id, @tipo, @arquivo_url, @arquivo_path, @mime_type, @duracao_seg, @tamanho_bytes, GETDATE())
      `);
    
    console.log(`[Upload] Arquivo salvo: ${arquivo_url}`);
    res.json({ data: { ...result.recordset[0], arquivo_url }, error: null });
  } catch (error) {
    console.error('[API] Erro no upload:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Registrar mídia (sem arquivo - apenas metadados)
app.post('/api/diario-midia', async (req, res) => {
  try {
    const dados = req.body;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, dados.evento_id)
      .input('tipo', sql.VarChar, dados.tipo)
      .input('arquivo_url', sql.VarChar, dados.arquivo_url)
      .input('arquivo_path', sql.VarChar, dados.arquivo_path)
      .input('mime_type', sql.VarChar, dados.mime_type)
      .input('duracao_seg', sql.Int, dados.duracao_seg)
      .input('tamanho_bytes', sql.Int, dados.tamanho_bytes)
      .query(`
        INSERT INTO dw_diariobordo_refugo_midia
        (evento_id, tipo, arquivo_url, arquivo_path, mime_type, duracao_seg, tamanho_bytes, created_at)
        OUTPUT INSERTED.*
        VALUES
        (@evento_id, @tipo, @arquivo_url, @arquivo_path, @mime_type, @duracao_seg, @tamanho_bytes, GETDATE())
      `);
    
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[API] Erro ao registrar mídia:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Atualizar transcrição
app.patch('/api/diario-evento/:eventoId/transcricao', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const { detalhe, observacao } = req.body;
    const pool = await getPool();
    
    let query = 'UPDATE dw_diariobordo_refugo_evento SET ';
    const updates = [];
    const request = pool.request().input('evento_id', sql.UniqueIdentifier, eventoId);
    
    if (detalhe !== undefined) {
      updates.push('transcricao_detalhe = @detalhe');
      request.input('detalhe', sql.NVarChar, detalhe);
    }
    if (observacao !== undefined) {
      updates.push('transcricao_observacao = @observacao');
      request.input('observacao', sql.NVarChar, observacao);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ data: null, error: { message: 'Nenhum campo para atualizar' } });
    }
    
    query += updates.join(', ') + ' OUTPUT INSERTED.* WHERE evento_id = @evento_id';
    const result = await request.query(query);
    
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[API] Erro ao atualizar transcrição:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Finalizar evento (marcar como SAVED)
app.patch('/api/diario-evento/:eventoId/finalizar', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query(`
        UPDATE dw_diariobordo_refugo_evento
        SET status = 'SAVED'
        OUTPUT INSERTED.*
        WHERE evento_id = @evento_id
      `);
    
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[API] Erro ao finalizar evento:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Excluir evento e suas mídias
app.delete('/api/diario-evento/:eventoId', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const pool = await getPool();
    
    // Buscar mídias para deletar arquivos físicos
    const midias = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('SELECT arquivo_path FROM dw_diariobordo_refugo_midia WHERE evento_id = @evento_id');
    
    // Deletar arquivos físicos
    for (const midia of midias.recordset) {
      if (midia.arquivo_path && fs.existsSync(midia.arquivo_path)) {
        try {
          fs.unlinkSync(midia.arquivo_path);
          console.log(`[Delete] Arquivo removido: ${midia.arquivo_path}`);
        } catch (fileErr) {
          console.warn(`[Delete] Falha ao remover arquivo: ${midia.arquivo_path}`, fileErr.message);
        }
      }
    }
    
    // Deletar mídias do banco
    await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('DELETE FROM dw_diariobordo_refugo_midia WHERE evento_id = @evento_id');
    
    // Deletar evento
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('DELETE FROM dw_diariobordo_refugo_evento WHERE evento_id = @evento_id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ data: null, error: { message: 'Evento não encontrado' } });
    }
    
    console.log(`[Delete] Evento ${eventoId} excluído com sucesso`);
    res.json({ data: { deleted: true, evento_id: eventoId }, error: null });
  } catch (error) {
    console.error('[API] Erro ao excluir evento:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// ==================== FEEDBACK "ÚTIL" (persistido + auditado) ====================

// Auto-criar tabelas de feedback se não existirem
async function ensureFeedbackTables() {
  try {
    const p = await getPool();
    await p.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dw_diariobordo_feedback_util' AND xtype='U')
      CREATE TABLE dw_diariobordo_feedback_util (
        feedback_id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        evento_id UNIQUEIDENTIFIER NOT NULL,
        query_tag VARCHAR(50),
        diario_tag VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);
    await p.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dw_diariobordo_feedback_audit' AND xtype='U')
      CREATE TABLE dw_diariobordo_feedback_audit (
        audit_id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        evento_id UNIQUEIDENTIFIER NOT NULL,
        query_tag VARCHAR(50),
        diario_tag VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log('[Feedback] Tabelas verificadas/criadas.');
  } catch (err) {
    console.error('[Feedback] Erro ao criar tabelas:', err.message);
  }
}
// Chamar ao importar (não bloqueia startup)
ensureFeedbackTables();

// Consultar se evento já tem feedback
app.get('/api/diario-feedback/evento/:eventoId', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('SELECT feedback_id, query_tag, diario_tag, created_at FROM dw_diariobordo_feedback_util WHERE evento_id = @evento_id');
    
    res.json({ data: result.recordset[0] || null, error: null });
  } catch (error) {
    console.error('[Feedback] Erro ao consultar:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Consultar feedback em lote (por lista de evento_ids)
app.post('/api/diario-feedback/batch', async (req, res) => {
  try {
    const { evento_ids } = req.body;
    if (!evento_ids?.length) return res.json({ data: [], error: null });

    const pool = await getPool();
    // Criar TVP ou usar IN clause (limitado, mas ok para POC)
    const placeholders = evento_ids.map((_, i) => `@id${i}`).join(',');
    const request = pool.request();
    evento_ids.forEach((id, i) => request.input(`id${i}`, sql.UniqueIdentifier, id));

    const result = await request.query(
      `SELECT evento_id FROM dw_diariobordo_feedback_util WHERE evento_id IN (${placeholders})`
    );

    const feedbackSet = result.recordset.map(r => r.evento_id);
    res.json({ data: feedbackSet, error: null });
  } catch (error) {
    console.error('[Feedback] Erro batch:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Marcar como útil
app.post('/api/diario-feedback', async (req, res) => {
  try {
    const { evento_id, query_tag, diario_tag } = req.body;
    if (!evento_id || !diario_tag) {
      return res.status(400).json({ data: null, error: { message: 'evento_id e diario_tag são obrigatórios' } });
    }

    const pool = await getPool();

    // Verificar se já existe
    const existing = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, evento_id)
      .query('SELECT feedback_id FROM dw_diariobordo_feedback_util WHERE evento_id = @evento_id');
    
    if (existing.recordset.length > 0) {
      return res.json({ data: existing.recordset[0], error: null });
    }

    // Inserir feedback
    const result = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, evento_id)
      .input('query_tag', sql.VarChar, query_tag || null)
      .input('diario_tag', sql.VarChar, diario_tag)
      .query(`
        INSERT INTO dw_diariobordo_feedback_util (evento_id, query_tag, diario_tag)
        OUTPUT INSERTED.*
        VALUES (@evento_id, @query_tag, @diario_tag)
      `);

    // Auditoria
    await pool.request()
      .input('evento_id', sql.UniqueIdentifier, evento_id)
      .input('query_tag', sql.VarChar, query_tag || null)
      .input('diario_tag', sql.VarChar, diario_tag)
      .input('action', sql.VarChar, 'MARKED_USEFUL')
      .query(`
        INSERT INTO dw_diariobordo_feedback_audit (evento_id, query_tag, diario_tag, action)
        VALUES (@evento_id, @query_tag, @diario_tag, @action)
      `);

    console.log(`[Feedback] Marcado útil: evento=${evento_id}, diario_tag=${diario_tag}`);
    res.json({ data: result.recordset[0], error: null });
  } catch (error) {
    console.error('[Feedback] Erro ao marcar:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Desmarcar útil
app.delete('/api/diario-feedback/:eventoId', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const pool = await getPool();

    // Buscar dados para auditoria antes de deletar
    const existing = await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('SELECT * FROM dw_diariobordo_feedback_util WHERE evento_id = @evento_id');

    if (existing.recordset.length === 0) {
      return res.json({ data: { deleted: false }, error: null });
    }

    const fb = existing.recordset[0];

    // Deletar
    await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .query('DELETE FROM dw_diariobordo_feedback_util WHERE evento_id = @evento_id');

    // Auditoria
    await pool.request()
      .input('evento_id', sql.UniqueIdentifier, eventoId)
      .input('query_tag', sql.VarChar, fb.query_tag)
      .input('diario_tag', sql.VarChar, fb.diario_tag)
      .input('action', sql.VarChar, 'UNMARKED_USEFUL')
      .query(`
        INSERT INTO dw_diariobordo_feedback_audit (evento_id, query_tag, diario_tag, action)
        VALUES (@evento_id, @query_tag, @diario_tag, @action)
      `);

    console.log(`[Feedback] Desmarcado: evento=${eventoId}`);
    res.json({ data: { deleted: true, evento_id: eventoId }, error: null });
  } catch (error) {
    console.error('[Feedback] Erro ao desmarcar:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// ==================== KGRAPH API (PROXY) ====================

// Proxy para a API Kgraph - mantém o token server-side
app.post('/api/kgraph/taghistory', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json({ data: null, error: { message: 'tag é obrigatório' } });
    }

    const KGRAPH_TOKEN = process.env.KGRAPH_TOKEN || 'dev-token-paranoa-test-ensaio';
    const KGRAPH_URL = 'https://kgraph.anjuna-tech.com/tag-alert/taghistory';

    console.log(`[Kgraph] Buscando tag=${tag}`);

    const kgraphResponse = await fetch(KGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KGRAPH_TOKEN}`,
      },
      body: JSON.stringify({ tag }),
    });

    const kgraphData = await kgraphResponse.json();

    if (!kgraphResponse.ok || kgraphData.status === 'INVALID_TAG') {
      return res.status(404).json({ data: null, error: { message: `Etiqueta não encontrada na Kgraph: ${tag}` } });
    }

    res.json({ data: kgraphData, error: null });
  } catch (error) {
    console.error('[Kgraph] Erro:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// Proxy para feedback "Útil" do Kgraph
app.post('/api/kgraph/feedback', async (req, res) => {
  try {
    const { query_tag, diario_tag } = req.body;
    if (!query_tag || !diario_tag) {
      return res.status(400).json({ data: null, error: { message: 'query_tag e diario_tag são obrigatórios' } });
    }

    const KGRAPH_FEEDBACK_URL = process.env.KGRAPH_FEEDBACK_URL || 'https://kgraph.anjuna-tech.com/tag-alert/feedback';

    console.log(`[Kgraph Feedback] query_tag=${query_tag}, diario_tag=${diario_tag}`);

    const feedbackResponse = await fetch(KGRAPH_FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_tag, diario_tag }),
    });

    const feedbackData = await feedbackResponse.json().catch(() => ({}));

    if (!feedbackResponse.ok) {
      return res.status(feedbackResponse.status).json({ data: null, error: { message: 'Erro ao enviar feedback' } });
    }

    res.json({ data: feedbackData, error: null });
  } catch (error) {
    console.error('[Kgraph Feedback] Erro:', error.message);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

// ==================== EXPORTAR APP (para testes) ====================
export { app, getPool };

// ==================== INICIAR SERVIDOR ====================
// Só inicia o servidor quando executado diretamente (não quando importado por testes)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 API Server rodando na porta ${PORT}      ║
║   📡 http://localhost:${PORT}/api/health      ║
╚════════════════════════════════════════════╝
    `);
    
    // Testar conexão ao iniciar
    getPool().catch(err => {
      console.error('⚠️  Falha na conexão inicial:', err.message);
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Encerrando...');
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  });
}
