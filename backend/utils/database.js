/**
 * TANCAT - Sistema de Administración
 * Archivo: utils/database.js
 * Descripción: Utilidades de base de datos para Neon PostgreSQL
 */

const { 
    getNeonPool, 
    query, 
    transaction, 
    isHealthy, 
    getPoolStats, 
    handleDbError 
} = require('../config/database');

// ====================================
// MIDDLEWARE PARA EXPRESS
// ====================================

/**
 * Middleware para inyectar utilidades de base de datos en req
 */
function injectDbClient(req, res, next) {
    req.db = {
        query,
        transaction,
        pool: getNeonPool(),
        isHealthy,
        getPoolStats,
        handleDbError,
        buildWhereClause,
        buildPaginationQuery,
        escapeValue,
        validators,
        commonQueries
    };
    next();
}

// ====================================
// FUNCIONES DE CONSTRUCCIÓN DE CONSULTAS
// ====================================

/**
 * Construir cláusula WHERE dinámicamente
 */
function buildWhereClause(filters, startIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startIndex;
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
                const placeholders = value.map(() => `$${paramIndex++}`).join(',');
                conditions.push(`${key} IN (${placeholders})`);
                params.push(...value);
            } else if (typeof value === 'string' && value.includes('%')) {
                conditions.push(`${key} ILIKE $${paramIndex++}`);
                params.push(value);
            } else {
                conditions.push(`${key} = $${paramIndex++}`);
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
 */
function buildPaginationQuery(baseQuery, page = 1, limit = 10, orderBy = 'id', orderDirection = 'DESC') {
    const offset = (page - 1) * limit;
    const order = `ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
    const pagination = `${order} LIMIT $${1} OFFSET $${2}`;
    
    return {
        query: `${baseQuery} ${pagination}`,
        params: [parseInt(limit), offset],
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            offset
        }
    };
}

/**
 * Escapar valores para consultas SQL
 */
function escapeValue(value) {
    if (typeof value === 'string') {
        return value.replace(/'/g, "''");
    }
    return value;
}

// ====================================
// CONSULTAS PREPARADAS COMUNES
// ====================================

const commonQueries = {
    // Verificar si un registro existe
    exists: (table, field, value) => `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = $1)`,
    
    // Contar registros
    count: (table, whereClause = '') => `SELECT COUNT(*) as total FROM ${table} ${whereClause}`,
    
    // Obtener registro por ID
    findById: (table, idField = 'id') => `SELECT * FROM ${table} WHERE ${idField} = $1`,
    
    // Insertar y retornar
    insertAndReturn: (table, fields) => {
        const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
        return `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    },
    
    // Actualizar por ID
    updateById: (table, fields, idField = 'id') => {
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        return `UPDATE ${table} SET ${setClause}, fecha_modificacion = CURRENT_TIMESTAMP WHERE ${idField} = $${fields.length + 1} RETURNING *`;
    },
    
    // Soft delete
    softDelete: (table, idField = 'id') => `UPDATE ${table} SET activo = false, fecha_modificacion = CURRENT_TIMESTAMP WHERE ${idField} = $1 RETURNING *`,
    
    // Activar registro
    activate: (table, idField = 'id') => `UPDATE ${table} SET activo = true, fecha_modificacion = CURRENT_TIMESTAMP WHERE ${idField} = $1 RETURNING *`,
    
    // Consultas específicas de TANCAT
    getAvailableCourts: (sedeId, deporteId, fecha) => `
        SELECT 
            t.id_turno,
            t.hora_inicio,
            t.hora_fin,
            c.numero as cancha_numero,
            c.precio_por_hora,
            CASE WHEN r.id_reserva IS NULL THEN true ELSE false END as disponible
        FROM turnos t
        INNER JOIN canchas c ON t.id_cancha = c.id_cancha
        LEFT JOIN reservas r ON t.id_turno = r.id_turno 
            AND r.fecha_reserva = $3 
            AND r.estado IN ('confirmada', 'finalizada')
        WHERE c.id_sede = $1 
            AND c.id_deporte = $2
            AND t.activo = true
            AND c.activo = true
        ORDER BY t.hora_inicio, c.numero
    `,
    
    getReservationDetails: (reservaId) => `
        SELECT 
            r.*,
            t.hora_inicio,
            t.hora_fin,
            c.numero as cancha_numero,
            d.nombre as deporte_nombre,
            s.nombre as sede_nombre,
            cl.nombre as cliente_nombre,
            cl.apellido as cliente_apellido,
            cl.telefono as cliente_telefono
        FROM reservas r
        INNER JOIN turnos t ON r.id_turno = t.id_turno
        INNER JOIN canchas c ON t.id_cancha = c.id_cancha
        INNER JOIN deportes d ON c.id_deporte = d.id_deporte
        INNER JOIN sedes s ON c.id_sede = s.id_sede
        INNER JOIN clientes cl ON r.id_cliente = cl.id_cliente
        WHERE r.id_reserva = $1
    `
};

// ====================================
// VALIDADORES DE DATOS
// ====================================

const validators = {
    isValidDate: (date) => {
        const dateObj = new Date(date);
        return dateObj instanceof Date && !isNaN(dateObj.getTime());
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
    },
    
    isValidPrice: (price) => {
        return !isNaN(parseFloat(price)) && parseFloat(price) >= 0;
    },
    
    isValidTurnoTime: (time) => {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    },
    
    isFutureDate: (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        return checkDate >= today;
    }
};

// ====================================
// FUNCIONES DE UTILIDAD ESPECÍFICAS
// ====================================

/**
 * Verificar si una tabla existe
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
 */
async function getTableColumns(tableName) {
    try {
        const result = await query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default,
                character_maximum_length
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

/**
 * Ejecutar múltiples queries en paralelo de manera segura
 */
async function executeParallelQueries(queries) {
    try {
        const results = await Promise.all(
            queries.map(({ query: queryText, params = [] }) => 
                query(queryText, params)
            )
        );
        return results;
    } catch (error) {
        console.error('❌ Error ejecutando queries en paralelo:', error.message);
        throw error;
    }
}

/**
 * Formatear fecha para PostgreSQL
 */
function formatDateForDB(date) {
    if (!date) return null;
    const dateObj = new Date(date);
    return dateObj.toISOString().split('T')[0];
}

/**
 * Formatear tiempo para PostgreSQL
 */
function formatTimeForDB(time) {
    if (!time) return null;
    // Asegurar formato HH:MM
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (timeRegex.test(time)) {
        return time;
    }
    throw new Error(`Formato de tiempo inválido: ${time}`);
}

// ====================================
// EXPORTAR MÓDULO
// ====================================

module.exports = {
    // Middleware
    injectDbClient,
    
    // Funciones principales
    query,
    transaction,
    isHealthy,
    getPoolStats,
    handleDbError,
    
    // Builders
    buildWhereClause,
    buildPaginationQuery,
    escapeValue,
    
    // Utilidades
    tableExists,
    getTableColumns,
    executeParallelQueries,
    formatDateForDB,
    formatTimeForDB,
    
    // Consultas y validadores
    commonQueries,
    validators
};