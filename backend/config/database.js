/**
 * TANCAT - Sistema de Administración
 * Archivo: config/database.js
 * Descripción: Configuración de conexión a PostgreSQL/Supabase CORREGIDA
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// ====================================
// CONFIGURACIÓN POSTGRESQL DIRECTO (CORREGIDA)
// ====================================

// URL de Supabase parseada correctamente
const supabaseUrl = process.env.SUPABASE_URL;
let pgConfig;

if (supabaseUrl) {
    // Extraer host de la URL de Supabase
    const url = new URL(supabaseUrl);
    const projectRef = url.hostname.split('.')[0];
    
    pgConfig = {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: process.env.DB_PASSWORD,
        ssl: {
            rejectUnauthorized: false
        },
        // Configuración del pool
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        maxUses: 7500
    };
} else {
    // Fallback a configuración manual
    pgConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        maxUses: 7500
    };
}

console.log('🔗 Configurando conexión PostgreSQL:');
console.log(`   Host: ${pgConfig.host}`);
console.log(`   Database: ${pgConfig.database}`);
console.log(`   SSL: ${pgConfig.ssl ? 'Habilitado' : 'Deshabilitado'}`);

// Crear pool de conexiones PostgreSQL
const pool = new Pool(pgConfig);

// ====================================
// CONFIGURACIÓN SUPABASE CLIENT
// ====================================
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    console.log('✅ Cliente Supabase configurado');
} else {
    console.warn('⚠️ Cliente Supabase no configurado - variables de entorno faltantes');
}

// ====================================
// EVENTOS DEL POOL
// ====================================
pool.on('connect', (client) => {
    console.log('🔗 Nueva conexión PostgreSQL establecida');
});

pool.on('error', (err, client) => {
    console.error('❌ Error en pool PostgreSQL:', err.message);
    
    // Reintentar conexión en caso de error
    setTimeout(() => {
        console.log('🔄 Intentando reconectar...');
    }, 5000);
});

pool.on('acquire', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 Cliente PostgreSQL adquirido del pool');
    }
});

pool.on('remove', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Cliente PostgreSQL removido del pool');
    }
});

// ====================================
// FUNCIONES DE UTILIDAD
// ====================================

/**
 * Ejecutar consulta con manejo de errores mejorado
 */
async function query(text, params = []) {
    const start = Date.now();
    let client;
    
    try {
        client = await pool.connect();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development' && duration > 1000) {
            console.warn(`⚠️ Consulta lenta (${duration}ms): ${text.substring(0, 50)}...`);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error en consulta PostgreSQL:', {
            query: text.substring(0, 100) + '...',
            params: params,
            error: error.message,
            code: error.code
        });
        
        // Manejo específico de errores de conexión
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.error('🔌 Error de conectividad. Verificar:');
            console.error('   1. Conexión a internet');
            console.error('   2. Configuración de firewall');
            console.error('   3. Credenciales de Supabase');
            console.error('   4. URL de la base de datos');
        }
        
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Ejecutar transacción con manejo mejorado
 */
async function transaction(callback) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        
        console.log('✅ Transacción completada exitosamente');
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
 * Verificar salud de la base de datos con reintentos
 */
async function isHealthy(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await query('SELECT 1 as health_check, NOW() as timestamp, version() as version');
            
            return {
                healthy: true,
                timestamp: result.rows[0].timestamp,
                version: result.rows[0].version,
                connections: {
                    total: pool.totalCount,
                    idle: pool.idleCount,
                    waiting: pool.waitingCount
                },
                attempt: attempt
            };
        } catch (error) {
            console.error(`❌ Health check falló (intento ${attempt}/${maxRetries}):`, error.message);
            
            if (attempt === maxRetries) {
                return {
                    healthy: false,
                    error: error.message,
                    code: error.code,
                    attempts: maxRetries
                };
            }
            
            // Esperar antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

/**
 * Crear tablas esenciales si no existen
 */
async function ensureEssentialTables() {
    const essentialTables = [
        {
            name: 'roles',
            sql: `
                CREATE TABLE IF NOT EXISTS roles (
                    id_rol SERIAL PRIMARY KEY,
                    nombre VARCHAR(50) NOT NULL UNIQUE,
                    descripcion TEXT,
                    permisos JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `
        },
        {
            name: 'empleados',
            sql: `
                CREATE TABLE IF NOT EXISTS empleados (
                    id_empleado SERIAL PRIMARY KEY,
                    nombre VARCHAR(100) NOT NULL,
                    apellido VARCHAR(100) NOT NULL,
                    email VARCHAR(150) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    id_rol INTEGER REFERENCES roles(id_rol),
                    activo BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `
        }
    ];

    for (const table of essentialTables) {
        try {
            await query(table.sql);
            console.log(`✅ Tabla ${table.name} verificada/creada`);
        } catch (error) {
            console.error(`❌ Error creando tabla ${table.name}:`, error.message);
        }
    }
}

/**
 * Insertar datos iniciales si no existen
 */
async function ensureInitialData() {
    try {
        // Verificar si existe el rol de administrador
        const adminRoleExists = await query(
            'SELECT id_rol FROM roles WHERE nombre = $1',
            ['Administrador']
        );

        if (adminRoleExists.rows.length === 0) {
            console.log('📝 Creando rol de Administrador...');
            await query(`
                INSERT INTO roles (nombre, descripcion, permisos) 
                VALUES ($1, $2, $3)
            `, [
                'Administrador',
                'Acceso completo al sistema',
                JSON.stringify({
                    all: true,
                    reservas: { read: true, write: true, delete: true },
                    clientes: { read: true, write: true, delete: true },
                    ventas: { read: true, write: true, delete: true },
                    reportes: { read: true, write: true }
                })
            ]);
            console.log('✅ Rol Administrador creado');
        }

        // Verificar si existe el usuario administrador
        const adminUserExists = await query(
            'SELECT id_empleado FROM empleados WHERE email = $1',
            ['admin@tancat.com']
        );

        if (adminUserExists.rows.length === 0) {
            console.log('👤 Creando usuario administrador...');
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('admin123', 12);
            
            const adminRole = await query('SELECT id_rol FROM roles WHERE nombre = $1', ['Administrador']);
            
            await query(`
                INSERT INTO empleados (nombre, apellido, email, password_hash, id_rol) 
                VALUES ($1, $2, $3, $4, $5)
            `, [
                'Admin',
                'Sistema',
                'admin@tancat.com',
                hashedPassword,
                adminRole.rows[0].id_rol
            ]);
            console.log('✅ Usuario administrador creado');
            console.log('📧 Email: admin@tancat.com');
            console.log('🔐 Password: admin123');
        }

    } catch (error) {
        console.error('❌ Error creando datos iniciales:', error.message);
    }
}

/**
 * Cerrar todas las conexiones
 */
async function closeConnections() {
    try {
        await pool.end();
        console.log('✅ Pool PostgreSQL cerrado');
    } catch (error) {
        console.error('❌ Error al cerrar pool:', error.message);
        throw error;
    }
}

/**
 * Middleware para inyectar conexión en req
 */
function injectDb(req, res, next) {
    req.db = {
        query,
        transaction,
        pool,
        supabase,
        isHealthy
    };
    next();
}

/**
 * Inicializar base de datos
 */
async function initializeDatabase() {
    console.log('🚀 Inicializando base de datos...');
    
    try {
        // Verificar conexión
        const health = await isHealthy();
        
        if (!health.healthy) {
            throw new Error(`No se pudo conectar a la base de datos: ${health.error}`);
        }
        
        console.log('✅ Conexión a base de datos establecida');
        console.log(`📊 PostgreSQL: ${health.version.split(' ')[1]}`);
        
        // Crear tablas esenciales
        await ensureEssentialTables();
        
        // Crear datos iniciales
        await ensureInitialData();
        
        console.log('🎉 Base de datos inicializada correctamente');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error.message);
        
        // Mostrar sugerencias de solución
        console.log('\n🔧 Verificaciones sugeridas:');
        console.log('   1. ¿Están correctas las credenciales en .env?');
        console.log('   2. ¿Está activo el proyecto en Supabase?');
        console.log('   3. ¿Hay conexión a internet?');
        console.log('   4. ¿El firewall permite conexiones PostgreSQL?');
        
        return false;
    }
}

// ====================================
// EXPORTAR MÓDULO
// ====================================
module.exports = {
    pool,
    supabase,
    query,
    transaction,
    isHealthy,
    closeConnections,
    injectDb,
    initializeDatabase,
    ensureEssentialTables,
    ensureInitialData
};