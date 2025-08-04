/**
 * TANCAT - Sistema de Administración
 * Archivo: controllers/clienteController.js
 * Descripción: Controlador para operaciones del cliente (consultas públicas) con Neon Database
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
                s.direccion as sede_direccion,
                d.nombre as deporte_nombre,
                d.descripcion as deporte_descripcion
            FROM canchas c
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE c.activo = true AND s.activo = true AND d.activo = true
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (sede_id) {
            query += ` AND c.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        if (deporte_id) {
            query += ` AND c.id_deporte = $${paramCount}`;
            params.push(parseInt(deporte_id));
            paramCount++;
        }
        
        query += ` ORDER BY s.nombre, d.nombre, c.numero`;
        
        const result = await req.db.query(query, params);
        
        const canchasFormateadas = result.rows.map(cancha => ({
            id: cancha.id_cancha,
            numero: cancha.numero,
            capacidad: cancha.capacidad_jugadores,
            precioPorHora: parseFloat(cancha.precio_por_hora),
            observaciones: cancha.observaciones,
            sede: {
                nombre: cancha.sede_nombre,
                direccion: cancha.sede_direccion
            },
            deporte: {
                nombre: cancha.deporte_nombre,
                descripcion: cancha.deporte_descripcion
            }
        }));
        
        res.json({
            success: true,
            data: canchasFormateadas,
            message: 'Canchas obtenidas correctamente',
            filtros: {
                sede_id: sede_id ? parseInt(sede_id) : null,
                deporte_id: deporte_id ? parseInt(deporte_id) : null
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener canchas:', error);
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
        const { validators } = req.db;
        if (!validators.isValidDate(fecha)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de fecha inválido',
                code: 'FECHA_INVALIDA',
                timestamp: new Date().toISOString()
            });
        }
        
        if (!validators.isFutureDate(fecha)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha no puede ser anterior a hoy',
                code: 'FECHA_PASADA',
                timestamp: new Date().toISOString()
            });
        }
        
        // Usar query común para obtener turnos disponibles
        const { commonQueries } = req.db;
        const turnosResult = await req.db.query(
            commonQueries.getAvailableCourts(sede_id, deporte_id, fecha), 
            [sede_id, deporte_id, fecha]
        );
        
        if (turnosResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay canchas disponibles para esta combinación de sede y deporte',
                code: 'NO_CANCHAS_DISPONIBLES',
                timestamp: new Date().toISOString()
            });
        }
        
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
        
        const infoResult = await req.db.query(infoQuery, [sede_id, deporte_id]);
        const info = infoResult.rows[0];
        
        if (!info) {
            return res.status(400).json({
                success: false,
                message: 'Sede o deporte no encontrado',
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
            precio: parseFloat(turno.precio_especial || turno.precio_por_hora),
            disponible: turno.disponible
        }));
        
        // Generar resumen
        const disponibles = turnosFormateados.filter(t => t.disponible).length;
        const ocupados = turnosFormateados.length - disponibles;
        const porcentajeDisponibilidad = turnosFormateados.length > 0 ? 
            Math.round((disponibles / turnosFormateados.length) * 100) : 0;
        
        // Formatear fecha
        const fechaObj = new Date(fecha + 'T00:00:00');
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fechaObj.getDay()];
        
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
                    nombre: info.sede_nombre,
                    direccion: info.direccion
                },
                deporte: {
                    id: parseInt(deporte_id),
                    nombre: info.deporte_nombre,
                    descripcion: info.deporte_descripcion
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

/**
 * Obtener detalles de un torneo específico
 * GET /api/cliente/torneos/:torneo_id
 */
const obtenerDetallesTorneo = async (req, res) => {
    try {
        const { torneo_id } = req.params;
        
        // Validar que torneo_id sea un número
        if (!torneo_id || isNaN(parseInt(torneo_id))) {
            return res.status(400).json({
                success: false,
                message: 'ID de torneo inválido',
                timestamp: new Date().toISOString()
            });
        }
        
        // Obtener información del torneo
        const torneoQuery = `
            SELECT 
                t.*,
                d.nombre as deporte_nombre,
                d.descripcion as deporte_descripcion,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                s.telefono as sede_telefono
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            WHERE t.id_torneo = $1
        `;
        
        const torneoResult = await req.db.query(torneoQuery, [torneo_id]);
        
        if (torneoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Torneo no encontrado',
                timestamp: new Date().toISOString()
            });
        }
        
        const torneo = torneoResult.rows[0];
        
        // Obtener participantes usando Promise.all para optimizar
        const [participantesResult, partidosResult] = await Promise.all([
            req.db.query(`
                SELECT 
                    pt.id_participante,
                    pt.fecha_inscripcion,
                    pt.pagado,
                    c1.nombre as jugador1_nombre,
                    c1.apellido as jugador1_apellido,
                    c2.nombre as jugador2_nombre,
                    c2.apellido as jugador2_apellido
                FROM participantes_torneo pt
                INNER JOIN clientes c1 ON pt.id_cliente_1 = c1.id_cliente
                LEFT JOIN clientes c2 ON pt.id_cliente_2 = c2.id_cliente
                WHERE pt.id_torneo = $1 AND pt.activo = true
                ORDER BY pt.fecha_inscripcion
            `, [torneo_id]),
            
            req.db.query(`
                SELECT 
                    p.id_partido,
                    p.fecha_partido,
                    p.hora_partido,
                    p.estado,
                    c.numero as cancha_numero
                FROM partidos_torneo p
                INNER JOIN canchas c ON p.id_cancha = c.id_cancha
                WHERE p.id_torneo = $1 
                    AND p.estado IN ('programado', 'en_curso')
                    AND p.fecha_partido >= CURRENT_DATE
                ORDER BY p.fecha_partido, p.hora_partido
                LIMIT 10
            `, [torneo_id])
        ]);
        
        const participantesInscritos = participantesResult.rows.length;
        const cuposDisponibles = torneo.max_participantes - participantesInscritos;
        
        const torneoDetallado = {
            id: torneo.id_torneo,
            nombre: torneo.nombre,
            descripcion: torneo.descripcion,
            fechaInicio: torneo.fecha_inicio,
            fechaFin: torneo.fecha_fin,
            precioInscripcion: parseFloat(torneo.precio_inscripcion),
            tipoTorneo: torneo.tipo_torneo,
            estado: torneo.estado,
            premio: torneo.premio_descripcion,
            participantes: {
                maximo: torneo.max_participantes,
                inscritos: participantesInscritos,
                disponibles: cuposDisponibles,
                puedeInscribirse: torneo.estado === 'abierto' && cuposDisponibles > 0,
                lista: participantesResult.rows.map(p => ({
                    id: p.id_participante,
                    fechaInscripcion: p.fecha_inscripcion,
                    pagado: p.pagado,
                    jugadores: [
                        `${p.jugador1_nombre} ${p.jugador1_apellido}`,
                        p.jugador2_nombre ? `${p.jugador2_nombre} ${p.jugador2_apellido}` : null
                    ].filter(Boolean)
                }))
            },
            deporte: {
                nombre: torneo.deporte_nombre,
                descripcion: torneo.deporte_descripcion
            },
            sede: {
                nombre: torneo.sede_nombre,
                direccion: torneo.sede_direccion,
                telefono: torneo.sede_telefono
            },
            proximosPartidos: partidosResult.rows.map(partido => ({
                id: partido.id_partido,
                fecha: partido.fecha_partido,
                hora: partido.hora_partido ? partido.hora_partido.substring(0, 5) : null,
                cancha: partido.cancha_numero,
                estado: partido.estado
            }))
        };
        
        res.json({
            success: true,
            data: torneoDetallado,
            message: 'Detalles del torneo obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener detalles del torneo:', error);
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
 * Obtener estadísticas públicas del complejo
 * GET /api/cliente/estadisticas
 */
const obtenerEstadisticasPublicas = async (req, res) => {
    try {
        const queries = [
            // Canchas por sede
            `SELECT 
                s.nombre as sede,
                COUNT(c.id_cancha) as total_canchas
            FROM sedes s
            LEFT JOIN canchas c ON s.id_sede = c.id_sede AND c.activo = true
            WHERE s.activo = true
            GROUP BY s.id_sede, s.nombre
            ORDER BY s.nombre`,
            
            // Deportes disponibles
            `SELECT 
                d.nombre as deporte,
                COUNT(c.id_cancha) as total_canchas
            FROM deportes d
            LEFT JOIN canchas c ON d.id_deporte = c.id_deporte AND c.activo = true
            WHERE d.activo = true
            GROUP BY d.id_deporte, d.nombre
            ORDER BY total_canchas DESC, d.nombre`,
            
            // Torneos del año actual
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as finalizados,
                COUNT(CASE WHEN estado = 'en_curso' THEN 1 END) as en_curso,
                COUNT(CASE WHEN estado = 'abierto' THEN 1 END) as abiertos
            FROM torneos 
            WHERE EXTRACT(YEAR FROM fecha_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)`,
            
            // Resumen general
            `SELECT 
                (SELECT COUNT(*) FROM sedes WHERE activo = true) as total_sedes,
                (SELECT COUNT(*) FROM deportes WHERE activo = true) as total_deportes,
                (SELECT COUNT(*) FROM canchas WHERE activo = true) as total_canchas`
        ];
        
        const { executeParallelQueries } = req.db;
        const results = await executeParallelQueries(
            queries.map(query => ({ query }))
        );
        
        const [
            canchasPorSedeResult,
            deportesResult,
            torneosResult,
            resumenResult
        ] = results;
        
        const estadisticas = {
            resumen: {
                sedes: parseInt(resumenResult.rows[0].total_sedes),
                deportes: parseInt(resumenResult.rows[0].total_deportes),
                canchas: parseInt(resumenResult.rows[0].total_canchas)
            },
            canchasPorSede: canchasPorSedeResult.rows.map(row => ({
                sede: row.sede,
                canchas: parseInt(row.total_canchas)
            })),
            deportesDisponibles: deportesResult.rows.map(row => ({
                deporte: row.deporte,
                canchas: parseInt(row.total_canchas)
            })),
            torneosAnuales: {
                total: parseInt(torneosResult.rows[0].total),
                finalizados: parseInt(torneosResult.rows[0].finalizados),
                enCurso: parseInt(torneosResult.rows[0].en_curso),
                abiertos: parseInt(torneosResult.rows[0].abiertos)
            }
        };
        
        res.json({
            success: true,
            data: estadisticas,
            message: 'Estadísticas obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
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
    obtenerCanchas,
    consultarDisponibilidad,
    obtenerTorneosActivos,
    obtenerDetallesTorneo,
    obtenerEstadisticasPublicas,
    obtenerCombinacionesDisponibles
};