import sql from 'mssql';

// Configuração do SQL Server usando variáveis de ambiente
const sqlConfig = {
  server: import.meta.env.VITE_HOST_DB,
  port: parseInt(import.meta.env.VITE_PORT_DB) || 1433,
  user: import.meta.env.VITE_USER_DB,
  password: import.meta.env.VITE_PASSWORD_DB,
  database: import.meta.env.VITE_DATABASE,
  options: {
    encrypt: false, // Ajuste para true se usar Azure ou conexão segura
    trustServerCertificate: true, // Para desenvolvimento local
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Pool de conexões (singleton)
let pool = null;

/**
 * Obtém conexão com o SQL Server
 * Reutiliza o pool de conexões existente
 */
export async function getConnection() {
  try {
    if (pool) {
      return pool;
    }
    
    console.log('[SQL Server] Conectando ao banco de dados...');
    pool = await sql.connect(sqlConfig);
    console.log('[SQL Server] Conexão estabelecida com sucesso!');
    
    return pool;
  } catch (error) {
    console.error('[SQL Server] Erro ao conectar:', error.message);
    throw error;
  }
}

/**
 * Executa uma query SELECT e retorna os resultados
 */
export async function query(queryString, params = {}) {
  try {
    const pool = await getConnection();
    const request = pool.request();
    
    // Adicionar parâmetros à query
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    
    const result = await request.query(queryString);
    return { data: result.recordset, error: null };
  } catch (error) {
    console.error('[SQL Server] Erro na query:', error.message);
    return { data: null, error };
  }
}

/**
 * Executa uma stored procedure
 */
export async function executeStoredProcedure(procedureName, params = {}) {
  try {
    const pool = await getConnection();
    const request = pool.request();
    
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    
    const result = await request.execute(procedureName);
    return { data: result.recordset, error: null };
  } catch (error) {
    console.error('[SQL Server] Erro ao executar procedure:', error.message);
    return { data: null, error };
  }
}

/**
 * Fecha a conexão com o banco
 */
export async function closeConnection() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[SQL Server] Conexão fechada');
  }
}

/**
 * Testa a conexão com o banco de dados
 */
export async function testConnection() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT 1 as test');
    console.log('[SQL Server] Teste de conexão: OK');
    return { success: true, message: 'Conexão OK' };
  } catch (error) {
    console.error('[SQL Server] Teste de conexão falhou:', error.message);
    return { success: false, message: error.message };
  }
}

export default {
  getConnection,
  query,
  executeStoredProcedure,
  closeConnection,
  testConnection,
  sql, // Exporta o módulo sql para tipos de dados
};
