/**
 * TANCAT - Backend Routes Cliente
 * Archivo: routes/cliente.js
 * Descripción: Rutas para el frontend del cliente
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Configurar conexión a la base de datos usando variables de entorno
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tancat_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ====================================
// MIDDLEWARE DE RESPUESTA ESTÁNDAR
// ====================================
const sendResponse = (res, success, data = null, message = 'OK', statusCode = 200) => {
    res.status(statusCode).json({
        success,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

const handleError = (res, error, message = 'Error interno del servidor') => {
    console.error('Error en API Cliente:', error);
    sendResponse(res, false, null, message, 500);
};

// ====================================
// RUTAS DE SEDES
// ====================================

/**
 * GET /api/cliente/sedes
 * Obtener todas las sedes activas
 */
router.get('/sedes', async (req, res) => {
    try {
        const query = `
            SELECT 
                id_sede,
                nombre,
                direccion,
                telefono,
                horario_apertura,
                horario_cierre,
                dias_funcionamiento,
                activo,
                fecha_creacion
            FROM sedes 
            WHERE activo = true 
            ORDER BY id_sede ASC
        `;

        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return sendResponse(res, true, [], 'No hay sedes disponibles', 200);
        }

        // Formatear datos de respuesta
        const sedes = result.rows.map(sede => ({
            id_sede: sede.id_sede,
            nombre: sede.nombre.trim(),
            direccion: sede.direccion,
            telefono: sede.telefono,
            horario_apertura: sede.horario_apertura,
            horario_cierre: sede.horario_cierre,
            dias_funcionamiento: sede.dias_funcionamiento,
            activo: sede.activo,
            fecha_creacion: sede.fecha_creacion
        }));

        sendResponse(res, true, sedes, `${sedes.length} sedes encontradas`);

    } catch (error) {
        handleError(res, error, 'Error al obtener las sedes');
    }
});

/**
 * GET /api/cliente/sedes/:id
 * Obtener información detallada de una sede específica
 */
router.get('/sedes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return sendResponse(res, false, null, 'ID de sede inválido', 400);
        }

        const query = `
            SELECT 
                s.id_sede,
                s.nombre,
                s.direccion,
                s.telefono,
                s.horario_apertura,
                s.horario_cierre,
                s.dias_funcionamiento,
                s.activo,
                COUNT(c.id_cancha) as total_canchas
            FROM sedes s
            LEFT JOIN canchas c ON s.id_sede = c.id_sede AND c.activo = true
            WHERE s.id_sede = $1 AND s.activo = true
            GROUP BY s.id_sede
        `;

        const result = await pool.query(query, [parseInt(id)]);
        
        if (result.rows.length === 0) {
            return sendResponse(res, false, null, 'Sede no encontrada', 404);
        }

        const sede = result.rows[0];
        sede.nombre = sede.nombre.trim();

        sendResponse(res, true, sede, 'Información de sede obtenida');

    } catch (error) {
        handleError(res, error, 'Error al obtener información de la sede');
    }
});

// ====================================
// RUTAS DE DEPORTES
// ====================================

/**
 * GET /api/cliente/deportes
 * Obtener todos los deportes activos
 */
router.get('/deportes', async (req, res) => {
    try {
        const query = `
            SELECT 
                id_deporte,
                nombre,
                descripcion,
                duracion_turno,
                precio_base,
                activo
            FROM deportes 
            WHERE activo = true 
            ORDER BY nombre ASC
        `;

        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return sendResponse(res, true, [], 'No hay deportes disponibles', 200);
        }

        // Formatear datos de respuesta
        const deportes = result.rows.map(deporte => ({
            id_deporte: deporte.id_deporte,
            nombre: deporte.nombre.trim(),
            descripcion: deporte.descripcion,
            duracion_turno: deporte.duracion_turno,
            precio_base: parseFloat(deporte.precio_base),
            activo: deporte.activo
        }));

        sendResponse(res, true, deportes, `${deportes.length} deportes encontrados`);

    } catch (error) {
        handleError(res, error, 'Error al obtener los deportes');
    }
});

/**
 * GET /api/cliente/deportes/:id
 * Obtener información detallada de un deporte específico
 */
router.get('/deportes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return sendResponse(res, false, null, 'ID de deporte inválido', 400);
        }

        const query = `
            SELECT 
                d.id_deporte,
                d.nombre,
                d.descripcion,
                d.duracion_turno,
                d.precio_base,
                d.activo,
                COUNT(c.id_cancha) as total_canchas
            FROM deportes d
            LEFT JOIN canchas c ON d.id_deporte = c.id_deporte AND c.activo = true
            WHERE d.id_deporte = $1 AND d.activo = true
            GROUP BY d.id_deporte
        `;

        const result = await pool.query(query, [parseInt(id)]);
        
        if (result.rows.length === 0) {
            return sendResponse(res, false, null, 'Deporte no encontrado', 404);
        }

        const deporte = result.rows[0];
        deporte.nombre = deporte.nombre.trim();
        deporte.precio_base = parseFloat(deporte.precio_base);

        sendResponse(res, true, deporte, 'Información de deporte obtenida');

    } catch (error) {
        handleError(res, error, 'Error al obtener información del deporte');
    }
});

// ====================================
// RUTAS DE CANCHAS
// ====================================

/**
 * GET /api/cliente/canchas
 * Obtener canchas filtradas por sede y/o deporte
 */
router.get('/canchas', async (req, res) => {
    try {
        const { sede_id, deporte_id } = req.query;
        
        let query = `
            SELECT 
                c.id_cancha,
                c.numero,
                c.capacidad_jugadores,
                c.precio_por_hora,
                c.observaciones,
                s.nombre as sede_nombre,
                d.nombre as deporte_nombre,
                d.duracion_turno
            FROM canchas c
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE c.activo = true AND s.activo = true AND d.activo = true
        `;
        
        const params = [];
        let paramCount = 0;

        if (sede_id && !isNaN(parseInt(sede_id))) {
            paramCount++;
            query += ` AND c.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
        }

        if (deporte_id && !isNaN(parseInt(deporte_id))) {
            paramCount++;
            query += ` AND c.id_deporte = $${paramCount}`;
            params.push(parseInt(deporte_id));
        }

        query += ` ORDER BY s.nombre, d.nombre, c.numero`;

        const result = await pool.query(query, params);
        
        // Formatear datos de respuesta
        const canchas = result.rows.map(cancha => ({
            id_cancha: cancha.id_cancha,
            numero: cancha.numero,
            capacidad_jugadores: cancha.capacidad_jugadores,
            precio_por_hora: parseFloat(cancha.precio_por_hora),
            observaciones: cancha.observaciones,
            sede_nombre: cancha.sede_nombre.trim(),
            deporte_nombre: cancha.deporte_nombre.trim(),
            duracion_turno: cancha.duracion_turno
        }));

        sendResponse(res, true, canchas, `${canchas.length} canchas encontradas`);

    } catch (error) {
        handleError(res, error, 'Error al obtener las canchas');
    }
});

// ====================================
// RUTAS DE COMBINACIONES DISPONIBLES
// ====================================

/**
 * GET /api/cliente/combinaciones-disponibles
 * Obtener todas las combinaciones disponibles de sede-deporte
 */
router.get('/combinaciones-disponibles', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.id_sede,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                d.id_deporte,
                d.nombre as deporte_nombre,
                d.precio_base,
                d.duracion_turno,
                COUNT(c.id_cancha) as cantidad_canchas
            FROM sedes s
            INNER JOIN canchas c ON s.id_sede = c.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE s.activo = true AND c.activo = true AND d.activo = true
            GROUP BY s.id_sede, s.nombre, s.direccion, d.id_deporte, d.nombre, d.precio_base, d.duracion_turno
            ORDER BY s.nombre, d.nombre
        `;

        const result = await pool.query(query);
        
        // Agrupar por sede
        const combinaciones = {};
        
        result.rows.forEach(row => {
            const sedeId = row.id_sede;
            
            if (!combinaciones[sedeId]) {
                combinaciones[sedeId] = {
                    sede: {
                        id: row.id_sede,
                        nombre: row.sede_nombre.trim(),
                        direccion: row.sede_direccion
                    },
                    deportes: []
                };
            }
            
            combinaciones[sedeId].deportes.push({
                id: row.id_deporte,
                nombre: row.deporte_nombre.trim(),
                precio_base: parseFloat(row.precio_base),
                duracion_turno: row.duracion_turno,
                canchas: row.cantidad_canchas
            });
        });

        const combinacionesArray = Object.values(combinaciones);
        
        sendResponse(res, true, combinacionesArray, `${combinacionesArray.length} sedes con deportes disponibles`);

    } catch (error) {
        handleError(res, error, 'Error al obtener las combinaciones disponibles');
    }
});

// ====================================
// RUTAS DE CONSULTA DE DISPONIBILIDAD
// ====================================

/**
 * GET /api/cliente/consulta-disponibilidad
 * Consultar disponibilidad de turnos
 */
router.get('/consulta-disponibilidad', async (req, res) => {
    try {
        const { sede_id, deporte_id, fecha } = req.query;

        // Validar parámetros requeridos
        if (!sede_id || !deporte_id || !fecha) {
            return sendResponse(res, false, null, 'Se requieren sede_id, deporte_id y fecha', 400);
        }

        if (isNaN(parseInt(sede_id)) || isNaN(parseInt(deporte_id))) {
            return sendResponse(res, false, null, 'IDs de sede y deporte deben ser números válidos', 400);
        }

        // Validar formato de fecha
        const fechaConsulta = new Date(fecha);
        if (isNaN(fechaConsulta.getTime())) {
            return sendResponse(res, false, null, 'Formato de fecha inválido', 400);
        }

        // Obtener día de la semana (1=Lunes, 7=Domingo)
        const diaSemana = fechaConsulta.getDay() === 0 ? 7 : fechaConsulta.getDay();

        const query = `
            SELECT 
                t.id_turno,
                t.hora_inicio,
                t.hora_fin,
                t.precio_especial,
                c.precio_por_hora,
                c.id_cancha,
                c.numero as cancha_numero,
                d.precio_base,
                COALESCE(t.precio_especial, c.precio_por_hora, d.precio_base) as precio_final,
                CASE 
                    WHEN r.id_reserva IS NOT NULL THEN false 
                    ELSE true 
                END as disponible
            FROM turnos t
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            LEFT JOIN reservas r ON t.id_turno = r.id_turno 
                AND r.fecha_reserva = $3 
                AND r.estado NOT IN ('cancelada', 'no_presentado')
            WHERE c.id_sede = $1 
                AND c.id_deporte = $2 
                AND t.dia_semana = $4
                AND t.activo = true 
                AND c.activo = true
            ORDER BY t.hora_inicio ASC, c.numero ASC
        `;

        const result = await pool.query(query, [
            parseInt(sede_id),
            parseInt(deporte_id),
            fecha,
            diaSemana
        ]);

        // Formatear datos de respuesta
        const turnos = result.rows.map(turno => ({
            id_turno: turno.id_turno,
            hora_inicio: turno.hora_inicio,
            hora_fin: turno.hora_fin,
            cancha_numero: turno.cancha_numero,
            precio_final: parseFloat(turno.precio_final),
            disponible: turno.disponible
        }));

        sendResponse(res, true, turnos, `${turnos.length} turnos encontrados para la fecha ${fecha}`);

    } catch (error) {
        handleError(res, error, 'Error al consultar disponibilidad');
    }
});

// ====================================
// RUTAS DE ESTADÍSTICAS
// ====================================

/**
 * GET /api/cliente/estadisticas
 * Obtener estadísticas básicas para mostrar en el frontend
 */
router.get('/estadisticas', async (req, res) => {
    try {
        const queries = {
            sedes: 'SELECT COUNT(*) as total FROM sedes WHERE activo = true',
            deportes: 'SELECT COUNT(*) as total FROM deportes WHERE activo = true',
            canchas: 'SELECT COUNT(*) as total FROM canchas WHERE activo = true',
            reservas_mes: `
                SELECT COUNT(*) as total 
                FROM reservas 
                WHERE fecha_reserva >= DATE_TRUNC('month', CURRENT_DATE)
                AND estado NOT IN ('cancelada')
            `
        };

        const resultados = {};
        
        for (const [key, query] of Object.entries(queries)) {
            try {
                const result = await pool.query(query);
                resultados[key] = parseInt(result.rows[0].total);
            } catch (error) {
                console.error(`Error en consulta ${key}:`, error);
                resultados[key] = 0;
            }
        }

        sendResponse(res, true, resultados, 'Estadísticas obtenidas');

    } catch (error) {
        handleError(res, error, 'Error al obtener estadísticas');
    }
});

// ====================================
// RUTAS DE TORNEOS (INFORMACIÓN PÚBLICA)
// ====================================

/**
 * GET /api/cliente/torneos
 * Obtener torneos próximos y activos
 */
router.get('/torneos', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id_torneo,
                t.nombre,
                t.descripcion,
                t.fecha_inicio,
                t.fecha_fin,
                t.precio_inscripcion,
                t.max_participantes,
                t.estado,
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            WHERE t.estado IN ('inscripcion_abierta', 'proximo', 'en_curso')
                AND t.fecha_inicio >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY t.fecha_inicio ASC
        `;

        const result = await pool.query(query);
        
        const torneos = result.rows.map(torneo => ({
            id_torneo: torneo.id_torneo,
            nombre: torneo.nombre,
            descripcion: torneo.descripcion,
            fecha_inicio: torneo.fecha_inicio,
            fecha_fin: torneo.fecha_fin,
            precio_inscripcion: parseFloat(torneo.precio_inscripcion),
            max_participantes: torneo.max_participantes,
            estado: torneo.estado,
            deporte_nombre: torneo.deporte_nombre.trim(),
            sede_nombre: torneo.sede_nombre.trim()
        }));

        sendResponse(res, true, torneos, `${torneos.length} torneos encontrados`);

    } catch (error) {
        handleError(res, error, 'Error al obtener los torneos');
    }
});

// ====================================
// RUTA DE HEALTH CHECK
// ====================================

/**
 * GET /api/cliente/health
 * Verificar estado de salud del servicio
 */
router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a la base de datos
        const result = await pool.query('SELECT NOW() as timestamp');
        
        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: 'connected',
            database_timestamp: result.rows[0].timestamp,
            version: '1.0.0'
        };

        sendResponse(res, true, healthData, 'Servicio funcionando correctamente');

    } catch (error) {
        const healthData = {
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        };

        sendResponse(res, false, healthData, 'Error en el servicio', 503);
    }
});

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES 404
// ====================================
router.use('*', (req, res) => {
    sendResponse(res, false, null, `Ruta no encontrada: ${req.originalUrl}`, 404);
});

module.exports = router;