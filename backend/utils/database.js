/**
 * TANCAT - Sistema de Administración
 * Archivo: utils/database.js
 * Descripción: Configuración y conexión a la base de datos PostgreSQL/Supabase
 */

const { Pool } = require('pg');

// ====================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// ====================================

// Determinar si se usa Supabase o PostgreSQL local
const isSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

let poolConfig;

if (isSupabase) {
    // Configuración para Supabase
    const supabaseUrl = new URL(process.env.SUPABASE_URL);
    
    poolConfig = {
        host: supabaseUrl.hostname,
        port: supabaseUrl.port || 5432,
        database: supabaseUrl.pathname.split('/')[1],
        user: 'postgres',
        password: process.env.SUPABASE_SERVICE_KEY,
        ssl: {
            rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        maxUses: 7500
    };
    
    console.log('🔗 Configurando conexión a Supabase');
    
} else {
    // Configuración para PostgreSQL local
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'tancat_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        maxUses: 7500
    };
    
    console.log('🔗 Configurando conexión a PostgreSQL local');
}

// ====================================
// CREAR POOL DE CONEXIONES
// ====================================
const pool = new Pool(poolConfig);

// ====================================
// EVENTOS DEL POOL
// ====================================
pool.on('connect', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 Nueva conexión establecida a la base de datos');
    }
});

pool.on('error', (err, client) => {
    console.error('❌ Error inesperado en conexión de base de datos:', err);
});

pool.on('acquire', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Cliente de base de datos adquirido del pool');
    }
});

pool.on('remove', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🗑️  Cliente de base de datos removido del pool');
    }
});

// ====================================
// FUNCIONES DE UTILIDAD
// ====================================

/**
 * Ejecutar una consulta con manejo de errores
 * @param {string} text - Consulta SQL
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<Object>} Resultado de la consulta
 */
async function query(text, params = []) {
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development' && duration > 1000) {
            console.warn(`⚠️  Consulta lenta (${duration}ms): ${text.substring(0, 50)}...`);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error en consulta SQL:', {
            query: text.substring(0, 100) + '...',
            params: params,
            error: error.message
        });
        throw error;
    }
}

/**
 * Ejecutar múltiples consultas en una transacción
 * @param {Function} callback - Función que contiene las consultas
 * @returns {Promise<any>} Resultado de la transacción
 */
async function transaction(callback) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const result = await callback(client);
        
        await client.query('COMMIT');
        
        if (process.env.NODE_ENV === 'development') {
            console.log('✅ Transacción completada exitosamente');
        }
        
        return result;
        
    } catch (error) {
        await client.query('ROLLBACK');
        
        console.error('❌ Error en transacción, rollback ejecutado:', error.message);
        throw error;
        
    } finally {
        client.release();
    }
}

/**
 * Verificar si la base de datos está disponible
 * @returns {Promise<boolean>} true si la conexión es exitosa
 */
async function isHealthy() {
    try {
        const result = await query('SELECT 1 as health_check');
        return result.rows.length > 0;
    } catch (error) {
        console.error('❌ Health check falló:', error.message);
        return false;
    }
}

/**
 * Obtener estadísticas del pool de conexiones
 * @returns {Object} Estadísticas del pool
 */
function getPoolStats() {
    return {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        maxConnections: poolConfig.max
    };
}

/**
 * Cerrar todas las conexiones del pool
 * @returns {Promise<void>}
 */
async function closePool() {
    try {
        await pool.end();
        console.log('✅ Pool de conexiones cerrado');
    } catch (error) {
        console.error('❌ Error al cerrar pool:', error.message);
        throw error;
    }
}

/**
 * Escapar valores para consultas SQL (prevención de SQL injection)
 * @param {string} value - Valor a escapar
 * @returns {string} Valor escapado
 */
function escapeValue(value) {
    if (typeof value === 'string') {
        return value.replace(/'/g, "''");
    }
    return value;
}

/**
 * Construir cláusula WHERE dinámicamente
 * @param {Object} filters - Filtros a aplicar
 * @param {number} startIndex - Índice inicial para parámetros
 * @returns {Object} { whereClause, params, nextIndex }
 */
function buildWhereClause(filters, startIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startIndex;
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
                // Para arrays, usar IN
                const placeholders = value.map(() => `${paramIndex++}`).join(',');
                conditions.push(`${key} IN (${placeholders})`);
                params.push(...value);
            } else if (typeof value === 'string' && value.includes('%')) {
                // Para LIKE
                conditions.push(`${key} ILIKE ${paramIndex++}`);
                params.push(value);
            } else {
                // Comparación exacta
                conditions.push(`${key} = ${paramIndex++}`);
                params.push(value);
            }
        }
    });
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return {
        whereClause,
        params,
        nextIndex: paramIndex
    };
}

/**
 * Construir consulta de paginación
 * @param {string} baseQuery - Consulta base
 * @param {number} page - Número de página (empezando en 1)
 * @param {number} limit - Elementos por página
 * @param {string} orderBy - Campo para ordenar
 * @param {string} orderDirection - Dirección del orden (ASC/DESC)
 * @returns {Object} { query, offset, limit }
 */
function buildPaginationQuery(baseQuery, page = 1, limit = 10, orderBy = 'id', orderDirection = 'DESC') {
    const offset = (page - 1) * limit;
    const order = `ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
    const pagination = `${order} LIMIT ${limit} OFFSET ${offset}`;
    
    return {
        query: `${baseQuery} ${pagination}`,
        offset,
        limit: parseInt(limit),
        page: parseInt(page)
    };
}

/**
 * Verificar si una tabla existe
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<boolean>} true si la tabla existe
 */
async function tableExists(tableName) {
    try {
        const result = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )
        `, [tableName]);
        
        return result.rows[0].exists;
    } catch (error) {
        console.error(`❌ Error verificando tabla ${tableName}:`, error.message);
        return false;
    }
}

/**
 * Obtener información de columnas de una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<Array>} Array con información de columnas
 */
async function getTableColumns(tableName) {
    try {
        const result = await query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);
        
        return result.rows;
    } catch (error) {
        console.error(`❌ Error obteniendo columnas de ${tableName}:`, error.message);
        return [];
    }
}

// ====================================
// MIDDLEWARE PARA EXPRESS
// ====================================

/**
 * Middleware para inyectar cliente de base de datos en req
 */
function injectDbClient(req, res, next) {
    req.db = {
        query,
        transaction,
        pool,
        isHealthy,
        buildWhereClause,
        buildPaginationQuery,
        escapeValue
    };
    next();
}

// ====================================
// CONSULTAS PREPARADAS COMUNES
// ====================================
const commonQueries = {
    // Verificar si un registro existe
    exists: (table, field, value) => `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = $1)`,
    
    // Contar registros con filtros
    count: (table, whereClause = '') => `SELECT COUNT(*) as total FROM ${table} ${whereClause}`,
    
    // Obtener registro por ID
    findById: (table, id = 'id') => `SELECT * FROM ${table} WHERE ${id} = $1`,
    
    // Insertar y retornar
    insertAndReturn: (table, fields) => {
        const placeholders = fields.map((_, index) => `${index + 1}`).join(', ');
        return `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    },
    
    // Actualizar por ID
    updateById: (table, fields, id = 'id') => {
        const setClause = fields.map((field, index) => `${field} = ${index + 1}`).join(', ');
        return `UPDATE ${table} SET ${setClause} WHERE ${id} = ${fields.length + 1} RETURNING *`;
    },
    
    // Eliminar (soft delete)
    softDelete: (table, id = 'id') => `UPDATE ${table} SET activo = false WHERE ${id} = $1 RETURNING *`,
    
    // Activar registro
    activate: (table, id = 'id') => `UPDATE ${table} SET activo = true WHERE ${id} = $1 RETURNING *`
};

// ====================================
// VALIDADORES DE DATOS
// ====================================
const validators = {
    isValidDate: (date) => {
        return date instanceof Date && !isNaN(date.getTime());
    },
    
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    isValidPhone: (phone) => {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    },
    
    isValidDNI: (dni) => {
        const dniRegex = /^\d{7,8}$/;
        return dniRegex.test(dni.toString());
    }
};

// ====================================
// MANEJO DE ERRORES ESPECÍFICOS DE DB
// ====================================
function handleDbError(error) {
    const dbError = {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
    };
    
    // Traducir errores comunes al español
    switch (error.code) {
        case '23505':
            dbError.friendlyMessage = 'El registro ya existe (valor duplicado)';
            break;
        case '23503':
            dbError.friendlyMessage = 'Referencia inválida - el registro relacionado no existe';
            break;
        case '23502':
            dbError.friendlyMessage = 'Campo requerido faltante';
            break;
        case '23514':
            dbError.friendlyMessage = 'Valor no permitido para este campo';
            break;
        case '42P01':
            dbError.friendlyMessage = 'Tabla o vista no existe';
            break;
        case '42703':
            dbError.friendlyMessage = 'Columna no existe';
            break;
        default:
            dbError.friendlyMessage = 'Error de base de datos';
    }
    
    return dbError;
}

// ====================================
// EXPORTAR MÓDULO
// ====================================
module.exports = {
    pool,
    query,
    transaction,
    isHealthy,
    getPoolStats,
    closePool,
    escapeValue,
    buildWhereClause,
    buildPaginationQuery,
    tableExists,
    getTableColumns,
    injectDbClient,
    commonQueries,
    validators,
    handleDbError,
    isSupabase
};