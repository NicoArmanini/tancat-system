/**
 * TANCAT - Sistema de Administración
 * Archivo: config/database.js
 * Descripción: Configuración de base de datos Neon PostgreSQL
 */

const { Pool } = require('pg');

// ====================================
// CONFIGURACIÓN NEON DATABASE
// ====================================

function createNeonConfig() {
    // Validar variables de entorno requeridas
    const requiredEnvVars = ['DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Variables de entorno faltantes para Neon: ${missingVars.join(', ')}`);
    }

    // Configuración optimizada para Neon
    const config = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            require: true,
            rejectUnauthorized: false
        },
        // Pool configuration optimizado para Neon
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        // Configuración específica para Neon
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
        application_name: 'tancat_system'
    };

    console.log('🔗 Configurando conexión a Neon Database');
    
    return config;
}

// ====================================
// CREAR POOL DE CONEXIONES
// ====================================

let pool = null;

function getNeonPool() {
    if (!pool) {
        try {
            const config = createNeonConfig();
            pool = new Pool(config);

            // Event listeners para monitoring
            pool.on('connect', (client) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('✅ Nueva conexión a Neon establecida');
                }
            });

            pool.on('error', (err, client) => {
                console.error('❌ Error en pool de Neon:', err.message);
                console.error('💡 Verifica la DATABASE_URL en variables de entorno');
            });

            pool.on('acquire', (client) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('🔄 Cliente Neon adquirido del pool');
                }
            });

            pool.on('remove', (client) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('🗑️ Cliente Neon removido del pool');
                }
            });

        } catch (error) {
            console.error('❌ Error creando pool de Neon:', error.message);
            throw error;
        }
    }
    
    return pool;
}

// ====================================
// FUNCIONES DE UTILIDAD
// ====================================

/**
 * Ejecutar consulta con pool de Neon
 */
async function query(text, params = []) {
    const start = Date.now();
    const neonPool = getNeonPool();
    
    try {
        const result = await neonPool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development' && duration > 1000) {
            console.warn(`⚠️ Consulta lenta en Neon (${duration}ms): ${text.substring(0, 50)}...`);
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error('❌ Error en consulta Neon:', {
            query: text.substring(0, 100) + '...',
            params: params,
            error: error.message,
            duration: `${duration}ms`
        });
        throw error;
    }
}

/**
 * Ejecutar transacción
 */
async function transaction(callback) {
    const neonPool = getNeonPool();
    const client = await neonPool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        
        if (process.env.NODE_ENV === 'development') {
            console.log('✅ Transacción Neon completada exitosamente');
        }
        
        return result;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en transacción Neon, rollback ejecutado:', error.message);
        throw error;
        
    } finally {
        client.release();
    }
}

/**
 * Verificar conexión a Neon
 */
async function testNeonConnection() {
    try {
        console.log('🔍 Probando conexión a Neon Database...');
        
        const result = await query('SELECT NOW() as timestamp, version() as version');
        
        console.log('✅ Conexión a Neon exitosa');
        console.log(`📅 Timestamp: ${result.rows[0].timestamp}`);
        console.log(`🐘 PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);
        
        // Verificar permisos
        try {
            await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                LIMIT 1
            `);
            console.log('✅ Permisos de lectura verificados en Neon');
        } catch (permError) {
            console.warn('⚠️ Permisos limitados en Neon:', permError.message);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error de conexión Neon:', error.message);
        console.error('🔧 Código de error:', error.code);
        
        // Guía de troubleshooting específica para Neon
        if (error.code === 'ENOTFOUND') {
            console.error('🆘 SOLUCIÓN: Verifica la DATABASE_URL de Neon en .env');
        } else if (error.code === '28P01') {
            console.error('🆘 SOLUCIÓN: Verifica las credenciales en DATABASE_URL');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🆘 SOLUCIÓN: Verifica la configuración de red o que Neon esté activo');
        }
        
        return false;
    }
}

/**
 * Verificar estado de salud de la base de datos
 */
async function isHealthy() {
    try {
        const result = await query('SELECT 1 as health_check');
        return result.rows.length > 0;
    } catch (error) {
        console.error('❌ Health check de Neon falló:', error.message);
        return false;
    }
}

/**
 * Obtener estadísticas del pool
 */
function getPoolStats() {
    const neonPool = getNeonPool();
    return {
        totalConnections: neonPool.totalCount,
        idleConnections: neonPool.idleCount,
        waitingClients: neonPool.waitingCount,
        maxConnections: 20
    };
}

/**
 * Cerrar todas las conexiones
 */
async function closeConnections() {
    if (pool) {
        try {
            await pool.end();
            pool = null;
            console.log('✅ Conexiones de Neon cerradas');
        } catch (error) {
            console.error('❌ Error cerrando conexiones Neon:', error.message);
        }
    }
}

// ====================================
// FUNCIONES DE MANEJO DE ERRORES
// ====================================

/**
 * Manejar errores específicos de PostgreSQL/Neon
 */
function handleDbError(error) {
    const dbError = {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
    };
    
    // Traducir errores comunes
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
        case '28P01':
            dbError.friendlyMessage = 'Autenticación falló';
            break;
        case 'ENOTFOUND':
            dbError.friendlyMessage = 'No se puede conectar a la base de datos';
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
    getNeonPool,
    query,
    transaction,
    testNeonConnection,
    isHealthy,
    getPoolStats,
    closeConnections,
    handleDbError
};