/**
 * TANCAT - Sistema de Administración
 * Archivo: clienteController.js
 * Descripción: Controlador para operaciones del cliente (consultas públicas)
 */

const { pool } = require('../config/connection');
const { validationResult } = require('express-validator');

// ====================================
// CONSULTAS PÚBLICAS
// ====================================

/**
 * Obtener información de todas las sedes
 * GET /api/cliente/sedes
 */
const obtenerSedes = async (req, res) => {
    try {
        const query = `
            SELECT 
                id_sede,
                nombre,
                direccion,
                telefono,
                horario_apertura,
                horario_cierre,
                dias_funcionamiento
            FROM sedes 
            WHERE activo = true
            ORDER BY nombre
        `;
        
        const result = await pool.query(query);
        
        const sedesFormateadas = result.rows.map(sede => ({
            id: sede.id_sede,
            nombre: sede.nombre,
            direccion: sede.direccion,
            telefono: sede.telefono,
            horarios: {
                apertura: sede.horario_apertura,
                cierre: sede.horario_cierre,
                dias: sede.dias_funcionamiento
            }
        }));
        
        res.json({
            success: true,
            data: sedesFormateadas,
            message: 'Sedes obtenidas correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener sedes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener deportes disponibles
 * GET /api/cliente/deportes
 */
const obtenerDeportes = async (req, res) => {
    try {
        const query = `
            SELECT 
                id_deporte,
                nombre,
                descripcion,
                duracion_turno,
                precio_base
            FROM deportes 
            WHERE activo = true
            ORDER BY nombre
        `;
        
        const result = await pool.query(query);
        
        const deportesFormateados = result.rows.map(deporte => ({
            id: deporte.id_deporte,
            nombre: deporte.nombre,
            descripcion: deporte.descripcion,
            duracion: deporte.duracion_turno,
            precioBase: parseFloat(deporte.precio_base)
        }));
        
        res.json({
            success: true,
            data: deportesFormateados,
            message: 'Deportes obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener deportes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener canchas por sede y deporte
 * GET /api/cliente/canchas?sede_id=1&deporte_id=1
 */
const obtenerCanchas = async (req, res) => {
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
                d.nombre as deporte_nombre
            FROM canchas c
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE c.activo = true
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (sede_id) {
            query += ` AND c.id_sede = ${paramCount}`;
            params.push(sede_id);
            paramCount++;
        }
        
        if (deporte_id) {
            query += ` AND c.id_deporte = ${paramCount}`;
            params.push(deporte_id);
            paramCount++;
        }
        
        query += ` ORDER BY s.nombre, d.nombre, c.numero`;
        
        const result = await pool.query(query, params);
        
        const canchasFormateadas = result.rows.map(cancha => ({
            id: cancha.id_cancha,
            numero: cancha.numero,
            capacidad: cancha.capacidad_jugadores,
            precioPorHora: parseFloat(cancha.precio_por_hora),
            observaciones: cancha.observaciones,
            sede: cancha.sede_nombre,
            deporte: cancha.deporte_nombre
        }));
        
        res.json({
            success: true,
            data: canchasFormateadas,
            message: 'Canchas obtenidas correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener canchas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Consultar disponibilidad de turnos
 * POST /api/cliente/consulta-disponibilidad
 */
const consultarDisponibilidad = async (req, res) => {
    try {
        // Validar errores de entrada
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }
        
        const { sede_id, deporte_id, fecha } = req.body;
        
        // Obtener turnos disponibles para la fecha, sede y deporte
        const turnosQuery = `
            SELECT 
                t.id_turno,
                t.hora_inicio,
                t.hora_fin,
                t.precio_especial,
                c.id_cancha,
                c.numero as cancha_numero,
                c.precio_por_hora,
                d.precio_base,
                CASE 
                    WHEN r.id_reserva IS NOT NULL THEN false 
                    ELSE true 
                END as disponible
            FROM turnos t
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            LEFT JOIN reservas r ON t.id_turno = r.id_turno 
                AND r.fecha_reserva = $1 
                AND r.estado IN ('confirmada', 'finalizada')
            WHERE c.id_sede = $2 
                AND c.id_deporte = $3
                AND t.activo = true
                AND c.activo = true
            ORDER BY t.hora_inicio, c.numero
        `;
        
        const turnosResult = await pool.query(turnosQuery, [fecha, sede_id, deporte_id]);
        
        // Formatear respuesta
        const turnosFormateados = turnosResult.rows.map(turno => ({
            id: turno.id_turno,
            horaInicio: turno.hora_inicio,
            horaFin: turno.hora_fin,
            cancha: {
                id: turno.id_cancha,
                numero: turno.cancha_numero
            },
            precio: parseFloat(turno.precio_especial || turno.precio_por_hora || turno.precio_base),
            disponible: turno.disponible
        }));
        
        // Obtener información adicional
        const infoQuery = `
            SELECT 
                s.nombre as sede_nombre,
                s.direccion,
                d.nombre as deporte_nombre,
                d.descripcion as deporte_descripcion
            FROM sedes s, deportes d
            WHERE s.id_sede = $1 AND d.id_deporte = $2
        `;
        
        const infoResult = await pool.query(infoQuery, [sede_id, deporte_id]);
        const info = infoResult.rows[0];
        
        res.json({
            success: true,
            data: {
                fecha: fecha,
                sede: {
                    id: sede_id,
                    nombre: info.sede_nombre,
                    direccion: info.direccion
                },
                deporte: {
                    id: deporte_id,
                    nombre: info.deporte_nombre,
                    descripcion: info.deporte_descripcion
                },
                turnos: turnosFormateados,
                resumen: {
                    total: turnosFormateados.length,
                    disponibles: turnosFormateados.filter(t => t.disponible).length,
                    ocupados: turnosFormateados.filter(t => !t.disponible).length
                }
            },
            message: 'Disponibilidad consultada correctamente'
        });
        
    } catch (error) {
        console.error('Error al consultar disponibilidad:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener información de torneos activos
 * GET /api/cliente/torneos
 */
const obtenerTorneosActivos = async (req, res) => {
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
                t.tipo_torneo,
                t.estado,
                t.premio_descripcion,
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                COUNT(pt.id_participante) as participantes_inscritos
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            LEFT JOIN participantes_torneo pt ON t.id_torneo = pt.id_torneo AND pt.activo = true
            WHERE t.estado IN ('abierto', 'en_curso')
            GROUP BY t.id_torneo, d.nombre, s.nombre, s.direccion
            ORDER BY t.fecha_inicio ASC
        `;
        
        const result = await pool.query(query);
        
        const torneosFormateados = result.rows.map(torneo => ({
            id: torneo.id_torneo,
            nombre: torneo.nombre,
            descripcion: torneo.descripcion,
            fechaInicio: torneo.fecha_inicio,
            fechaFin: torneo.fecha_fin,
            precioInscripcion: parseFloat(torneo.precio_inscripcion),
            maxParticipantes: torneo.max_participantes,
            participantesInscritos: parseInt(torneo.participantes_inscritos),
            cuposDisponibles: torneo.max_participantes - parseInt(torneo.participantes_inscritos),
            tipoTorneo: torneo.tipo_torneo,
            estado: torneo.estado,
            premio: torneo.premio_descripcion,
            deporte: torneo.deporte_nombre,
            sede: {
                nombre: torneo.sede_nombre,
                direccion: torneo.sede_direccion
            }
        }));
        
        res.json({
            success: true,
            data: torneosFormateados,
            message: 'Torneos activos obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener torneos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener estadísticas públicas del complejo
 * GET /api/cliente/estadisticas
 */
const obtenerEstadisticasPublicas = async (req, res) => {
    try {
        const queries = {
            // Número total de canchas activas
            canchas: `SELECT COUNT(*) as total FROM canchas WHERE activo = true`,
            
            // Deportes disponibles
            deportes: `SELECT COUNT(*) as total FROM deportes WHERE activo = true`,
            
            // Sedes activas
            sedes: `SELECT COUNT(*) as total FROM sedes WHERE activo = true`,
            
            // Torneos realizados este año
            torneos: `
                SELECT COUNT(*) as total 
                FROM torneos 
                WHERE EXTRACT(YEAR FROM fecha_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)
            `
        };
        
        const results = await Promise.all([
            pool.query(queries.canchas),
            pool.query(queries.deportes),
            pool.query(queries.sedes),
            pool.query(queries.torneos)
        ]);
        
        const estadisticas = {
            canchas: parseInt(results[0].rows[0].total),
            deportes: parseInt(results[1].rows[0].total),
            sedes: parseInt(results[2].rows[0].total),
            torneosAnuales: parseInt(results[3].rows[0].total)
        };
        
        res.json({
            success: true,
            data: estadisticas,
            message: 'Estadísticas obtenidas correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ====================================
// EXPORTAR FUNCIONES
// ====================================
module.exports = {
    obtenerSedes,
    obtenerDeportes,
    obtenerCanchas,
    consultarDisponibilidad,
    obtenerTorneosActivos,
    obtenerEstadisticasPublicas
};