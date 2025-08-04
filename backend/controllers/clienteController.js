/**
 * TANCAT - Sistema de Administración
 * Archivo: controllers/clienteController.js
 * Descripción: Controlador para operaciones del cliente (consultas públicas)
 */

const { handleDbError } = require('../utils/database');

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
        
        const result = await req.db.query(query);
        
        const sedesFormateadas = result.rows.map(sede => ({
            id: sede.id_sede,
            nombre: sede.nombre,
            direccion: sede.direccion,
            telefono: sede.telefono,
            horarios: {
                apertura: sede.horario_apertura ? sede.horario_apertura.substring(0, 5) : null,
                cierre: sede.horario_cierre ? sede.horario_cierre.substring(0, 5) : null,
                textoCompleto: sede.dias_funcionamiento || 'Consultar horarios'
            }
        }));
        
        res.json({
            success: true,
            data: sedesFormateadas,
            message: 'Sedes obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener sedes:', error);
        const dbError = handleDbError(error);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? dbError : undefined,
            timestamp: new Date().toISOString()
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
        
        const result = await req.db.query(query);
        
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
            message: 'Deportes obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener deportes:', error);
        const dbError = handleDbError(error);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? dbError : undefined,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Obtener combinaciones válidas de sede-deporte
 * GET /api/cliente/combinaciones-disponibles
 */
const obtenerCombinacionesDisponibles = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT
                s.id_sede,
                s.nombre as sede_nombre,
                d.id_deporte,
                d.nombre as deporte_nombre,
                COUNT(c.id_cancha) as cantidad_canchas
            FROM sedes s
            INNER JOIN canchas c ON s.id_sede = c.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE s.activo = true AND d.activo = true AND c.activo = true
            GROUP BY s.id_sede, s.nombre, d.id_deporte, d.nombre
            ORDER BY s.nombre, d.nombre
        `;
        
        const result = await req.db.query(query);
        
        // Agrupar por sede
        const combinacionesAgrupadas = result.rows.reduce((acc, combinacion) => {
            if (!acc[combinacion.id_sede]) {
                acc[combinacion.id_sede] = {
                    sede: {
                        id: combinacion.id_sede,
                        nombre: combinacion.sede_nombre
                    },
                    deportes: []
                };
            }
            
            acc[combinacion.id_sede].deportes.push({
                id: combinacion.id_deporte,
                nombre: combinacion.deporte_nombre,
                canchas: parseInt(combinacion.cantidad_canchas)
            });
            
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: Object.values(combinacionesAgrupadas),
            message: 'Combinaciones disponibles obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener combinaciones disponibles:', error);
        const dbError = handleDbError(error);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? dbError : undefined,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Consultar disponibilidad de turnos
 * POST /api/cliente/consulta-disponibilidad
 */
const consultarDisponibilidad = async (req, res) => {
    try {
        const { sede_id, deporte_id, fecha } = req.body;
        
        // Validaciones básicas
        if (!sede_id || !deporte_id || !fecha) {
            return res.status(400).json({
                success: false,
                message: 'sede_id, deporte_id y fecha son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        // Validar fecha
        const fechaConsulta = new Date(fecha + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fechaConsulta < hoy) {
            return res.status(400).json({
                success: false,
                message: 'La fecha no puede ser anterior a hoy',
                code: 'FECHA_INVALIDA',
                timestamp: new Date().toISOString()
            });
        }
        
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
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre,
                CASE 
                    WHEN r.id_reserva IS NOT NULL THEN false 
                    ELSE true 
                END as disponible
            FROM turnos t
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            LEFT JOIN reservas r ON t.id_turno = r.id_turno 
                AND r.fecha_reserva = $1 
                AND r.estado IN ('confirmada', 'finalizada')
            WHERE c.id_sede = $2 
                AND c.id_deporte = $3
                AND t.activo = true
                AND c.activo = true
                AND s.activo = true
                AND d.activo = true
            ORDER BY t.hora_inicio, c.numero
        `;
        
        const turnosResult = await req.db.query(turnosQuery, [fecha, sede_id, deporte_id]);
        
        if (turnosResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay canchas disponibles para esta combinación de sede y deporte',
                code: 'NO_CANCHAS_DISPONIBLES',
                timestamp: new Date().toISOString()
            });
        }
        
        // Formatear respuesta
        const turnosFormateados = turnosResult.rows.map(turno => ({
            id: turno.id_turno,
            horaInicio: turno.hora_inicio.substring(0, 5),
            horaFin: turno.hora_fin.substring(0, 5),
            cancha: {
                id: turno.id_cancha,
                numero: turno.cancha_numero
            },
            precio: parseFloat(turno.precio_especial || turno.precio_por_hora || turno.precio_base),
            disponible: turno.disponible
        }));
        
        // Generar resumen
        const disponibles = turnosFormateados.filter(t => t.disponible).length;
        const ocupados = turnosFormateados.length - disponibles;
        const porcentajeDisponibilidad = turnosFormateados.length > 0 ? 
            Math.round((disponibles / turnosFormateados.length) * 100) : 0;
        
        // Obtener nombres para la respuesta
        const sedeNombre = turnosResult.rows[0].sede_nombre;
        const deporteNombre = turnosResult.rows[0].deporte_nombre;
        
        // Formatear fecha
        const fechaFormateada = fechaConsulta.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fechaConsulta.getDay()];
        
        res.json({
            success: true,
            data: {
                fecha: {
                    valor: fecha,
                    nombreDia: nombreDia,
                    formateada: fechaFormateada
                },
                sede: {
                    id: parseInt(sede_id),
                    nombre: sedeNombre
                },
                deporte: {
                    id: parseInt(deporte_id),
                    nombre: deporteNombre
                },
                turnos: turnosFormateados,
                resumen: {
                    total: turnosFormateados.length,
                    disponibles: disponibles,
                    ocupados: ocupados,
                    porcentajeDisponibilidad: porcentajeDisponibilidad
                }
            },
            message: 'Disponibilidad consultada correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al consultar disponibilidad:', error);
        const dbError = handleDbError(error);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? dbError : undefined,
            timestamp: new Date().toISOString()
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
                d.descripcion as deporte_descripcion,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                COUNT(pt.id_participante) as participantes_inscritos
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            LEFT JOIN participantes_torneo pt ON t.id_torneo = pt.id_torneo AND pt.activo = true
            WHERE t.estado IN ('abierto', 'en_curso')
                AND s.activo = true
                AND d.activo = true
            GROUP BY t.id_torneo, d.nombre, d.descripcion, s.nombre, s.direccion
            ORDER BY t.fecha_inicio ASC
        `;
        
        const result = await req.db.query(query);
        
        const torneosFormateados = result.rows.map((torneo) => {
            const participantesInscritos = parseInt(torneo.participantes_inscritos);
            const cuposDisponibles = torneo.max_participantes - participantesInscritos;
            
            return {
                id: torneo.id_torneo,
                nombre: torneo.nombre,
                descripcion: torneo.descripcion,
                fechaInicio: torneo.fecha_inicio,
                fechaFin: torneo.fecha_fin,
                precioInscripcion: parseFloat(torneo.precio_inscripcion),
                participantes: {
                    maximo: torneo.max_participantes,
                    inscritos: participantesInscritos,
                    disponibles: cuposDisponibles,
                    puedeInscribirse: torneo.estado === 'abierto' && cuposDisponibles > 0
                },
                tipoTorneo: torneo.tipo_torneo,
                estado: torneo.estado,
                premio: torneo.premio_descripcion,
                deporte: {
                    nombre: torneo.deporte_nombre,
                    descripcion: torneo.deporte_descripcion
                },
                sede: {
                    nombre: torneo.sede_nombre,
                    direccion: torneo.sede_direccion
                }
            };
        });
        
        res.json({
            success: true,
            data: torneosFormateados,
            message: 'Torneos activos obtenidos correctamente',
            resumen: {
                total: torneosFormateados.length,
                abiertos: torneosFormateados.filter(t => t.estado === 'abierto').length,
                enCurso: torneosFormateados.filter(t => t.estado === 'en_curso').length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener torneos:', error);
        const dbError = handleDbError(error);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? dbError : undefined,
            timestamp: new Date().toISOString()
        });
    }
};

// ====================================
// EXPORTAR FUNCIONES
// ====================================
module.exports = {
    obtenerSedes,
    obtenerDeportes,
    obtenerCombinacionesDisponibles,
    consultarDisponibilidad,
    obtenerTorneosActivos
};