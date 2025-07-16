/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/reservas.js
 * Descripción: Rutas para gestión de reservas
 */

const express = require('express');
const router = express.Router();
const { injectDbClient } = require('../utils/database');

// Aplicar middleware de base de datos
router.use(injectDbClient);

// ====================================
// RUTAS DE RESERVAS
// ====================================

/**
 * @swagger
 * /api/reservas/{id}:
 *   put:
 *     summary: Actualizar una reserva
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [confirmada, cancelada, finalizada, no_show]
 *               seña_pagada:
 *                 type: number
 *               observaciones:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reserva actualizada exitosamente
 *       404:
 *         description: Reserva no encontrada
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, seña_pagada, observaciones } = req.body;
        
        // Verificar que la reserva existe
        const existeQuery = `SELECT id_reserva FROM reservas WHERE id_reserva = $1`;
        const existe = await req.db.query(existeQuery, [id]);
        
        if (existe.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada',
                timestamp: new Date().toISOString()
            });
        }
        
        // Construir query de actualización dinámicamente
        const campos = [];
        const valores = [];
        let paramCount = 1;
        
        if (estado !== undefined) {
            campos.push(`estado = ${paramCount}`);
            valores.push(estado);
            paramCount++;
        }
        
        if (seña_pagada !== undefined) {
            campos.push(`seña_pagada = ${paramCount}`);
            valores.push(seña_pagada);
            paramCount++;
        }
        
        if (observaciones !== undefined) {
            campos.push(`observaciones = ${paramCount}`);
            valores.push(observaciones);
            paramCount++;
        }
        
        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron campos para actualizar',
                timestamp: new Date().toISOString()
            });
        }
        
        // Agregar fecha de modificación y ID
        campos.push(`fecha_modificacion = CURRENT_TIMESTAMP`);
        valores.push(id);
        
        const updateQuery = `
            UPDATE reservas 
            SET ${campos.join(', ')}
            WHERE id_reserva = ${paramCount}
            RETURNING *
        `;
        
        const result = await req.db.query(updateQuery, valores);
        const reservaActualizada = result.rows[0];
        
        res.json({
            success: true,
            data: {
                id: reservaActualizada.id_reserva,
                estado: reservaActualizada.estado,
                precioTotal: parseFloat(reservaActualizada.precio_total),
                señaPagada: parseFloat(reservaActualizada.seña_pagada),
                saldoPendiente: parseFloat(reservaActualizada.saldo_pendiente),
                observaciones: reservaActualizada.observaciones,
                fechaModificacion: reservaActualizada.fecha_modificacion
            },
            message: 'Reserva actualizada correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al actualizar reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/reservas/{id}/cancelar:
 *   patch:
 *     summary: Cancelar una reserva
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reserva cancelada exitosamente
 */
router.patch('/:id/cancelar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo = 'Cancelación solicitada' } = req.body;
        
        const updateQuery = `
            UPDATE reservas 
            SET estado = 'cancelada',
                observaciones = COALESCE(observaciones, '') || ' - CANCELADA: ' || $2,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id_reserva = $1 AND estado != 'cancelada'
            RETURNING *
        `;
        
        const result = await req.db.query(updateQuery, [id, motivo]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada o ya cancelada',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            data: {
                id: result.rows[0].id_reserva,
                estado: result.rows[0].estado,
                observaciones: result.rows[0].observaciones
            },
            message: 'Reserva cancelada correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al cancelar reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/reservas/estadisticas:
 *   get:
 *     summary: Obtener estadísticas de reservas
 *     tags: [Reservas]
 *     parameters:
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 */
router.get('/estadisticas', async (req, res) => {
    try {
        const { fecha_desde = new Date().toISOString().split('T')[0], fecha_hasta = new Date().toISOString().split('T')[0] } = req.query;
        
        const estadisticasQuery = `
            SELECT 
                COUNT(*) as total_reservas,
                COUNT(CASE WHEN estado = 'confirmada' THEN 1 END) as confirmadas,
                COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as canceladas,
                COUNT(CASE WHEN estado = 'finalizada' THEN 1 END) as finalizadas,
                COUNT(CASE WHEN estado = 'no_show' THEN 1 END) as no_show,
                SUM(precio_total) as ingresos_totales,
                SUM(seña_pagada) as señas_cobradas,
                AVG(precio_total) as precio_promedio
            FROM reservas
            WHERE fecha_reserva BETWEEN $1 AND $2
        `;
        
        const reservasPorDeporteQuery = `
            SELECT 
                d.nombre as deporte,
                COUNT(r.id_reserva) as cantidad,
                SUM(r.precio_total) as ingresos
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE r.fecha_reserva BETWEEN $1 AND $2
            GROUP BY d.id_deporte, d.nombre
            ORDER BY cantidad DESC
        `;
        
        const reservasPorSedeQuery = `
            SELECT 
                s.nombre as sede,
                COUNT(r.id_reserva) as cantidad,
                SUM(r.precio_total) as ingresos
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            WHERE r.fecha_reserva BETWEEN $1 AND $2
            GROUP BY s.id_sede, s.nombre
            ORDER BY cantidad DESC
        `;
        
        const [estadisticas, porDeporte, porSede] = await Promise.all([
            req.db.query(estadisticasQuery, [fecha_desde, fecha_hasta]),
            req.db.query(reservasPorDeporteQuery, [fecha_desde, fecha_hasta]),
            req.db.query(reservasPorSedeQuery, [fecha_desde, fecha_hasta])
        ]);
        
        const stats = estadisticas.rows[0];
        
        res.json({
            success: true,
            data: {
                periodo: {
                    desde: fecha_desde,
                    hasta: fecha_hasta
                },
                resumen: {
                    totalReservas: parseInt(stats.total_reservas),
                    confirmadas: parseInt(stats.confirmadas),
                    canceladas: parseInt(stats.canceladas),
                    finalizadas: parseInt(stats.finalizadas),
                    noShow: parseInt(stats.no_show),
                    ingresosTotales: parseFloat(stats.ingresos_totales || 0),
                    señasCobradas: parseFloat(stats.señas_cobradas || 0),
                    precioPromedio: parseFloat(stats.precio_promedio || 0)
                },
                porDeporte: porDeporte.rows.map(row => ({
                    deporte: row.deporte,
                    cantidad: parseInt(row.cantidad),
                    ingresos: parseFloat(row.ingresos || 0)
                })),
                porSede: porSede.rows.map(row => ({
                    sede: row.sede,
                    cantidad: parseInt(row.cantidad),
                    ingresos: parseFloat(row.ingresos || 0)
                }))
            },
            message: 'Estadísticas de reservas obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener estadísticas de reservas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;api/reservas;
 /*   get:
 *     summary: Obtener lista de reservas
 *     tags: [Reservas]
 *     parameters:
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [confirmada, cancelada, finalizada, no_show]
 *     responses:
 *       200:
 *         description: Lista de reservas obtenida exitosamente
 */
router.get('/', async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, sede_id, estado, page = 1, limit = 20 } = req.query;
        
        let query = `
            SELECT 
                r.id_reserva,
                r.fecha_reserva,
                r.estado,
                r.precio_total,
                r.seña_pagada,
                r.saldo_pendiente,
                r.observaciones,
                r.fecha_creacion,
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
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (fecha_desde) {
            query += ` AND r.fecha_reserva >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }
        
        if (fecha_hasta) {
            query += ` AND r.fecha_reserva <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }
        
        if (sede_id) {
            query += ` AND s.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        if (estado) {
            query += ` AND r.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }
        
        query += ` ORDER BY r.fecha_reserva DESC, t.hora_inicio DESC`;
        
        // Agregar paginación
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);
        
        const result = await req.db.query(query, params);
        
        // Contar total para paginación
        let countQuery = `
            SELECT COUNT(*) as total
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            WHERE 1=1
        `;
        
        const countParams = params.slice(0, -2); // Remover limit y offset
        const countResult = await req.db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        const reservasFormateadas = result.rows.map(reserva => ({
            id: reserva.id_reserva,
            fechaReserva: reserva.fecha_reserva,
            estado: reserva.estado,
            precioTotal: parseFloat(reserva.precio_total),
            señaPagada: parseFloat(reserva.seña_pagada),
            saldoPendiente: parseFloat(reserva.saldo_pendiente),
            observaciones: reserva.observaciones,
            fechaCreacion: reserva.fecha_creacion,
            turno: {
                horaInicio: reserva.hora_inicio.substring(0, 5),
                horaFin: reserva.hora_fin.substring(0, 5)
            },
            cancha: {
                numero: reserva.cancha_numero,
                deporte: reserva.deporte_nombre,
                sede: reserva.sede_nombre
            },
            cliente: {
                nombre: `${reserva.cliente_nombre} ${reserva.cliente_apellido}`,
                telefono: reserva.cliente_telefono
            }
        }));
        
        res.json({
            success: true,
            data: reservasFormateadas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            },
            message: 'Reservas obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener reservas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/reservas:
 *   post:
 *     summary: Crear nueva reserva
 *     tags: [Reservas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_turno
 *               - id_cliente
 *               - fecha_reserva
 *               - precio_total
 *             properties:
 *               id_turno:
 *                 type: integer
 *               id_cliente:
 *                 type: integer
 *               fecha_reserva:
 *                 type: string
 *                 format: date
 *               precio_total:
 *                 type: number
 *               seña_pagada:
 *                 type: number
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reserva creada exitosamente
 *       400:
 *         description: Datos inválidos o turno no disponible
 */
router.post('/', async (req, res) => {
    try {
        const { id_turno, id_cliente, fecha_reserva, precio_total, seña_pagada = 0, observaciones = '' } = req.body;
        
        // Validaciones básicas
        if (!id_turno || !id_cliente || !fecha_reserva || !precio_total) {
            return res.status(400).json({
                success: false,
                message: 'id_turno, id_cliente, fecha_reserva y precio_total son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        // Verificar que el turno existe y está disponible
        const turnoQuery = `
            SELECT t.*, c.id_sede, d.nombre as deporte_nombre
            FROM turnos t
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE t.id_turno = $1 AND t.activo = true
        `;
        
        const turnoResult = await req.db.query(turnoQuery, [id_turno]);
        
        if (turnoResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Turno no encontrado o no activo',
                timestamp: new Date().toISOString()
            });
        }
        
        // Verificar que no existe una reserva para este turno y fecha
        const reservaExistenteQuery = `
            SELECT id_reserva 
            FROM reservas 
            WHERE id_turno = $1 AND fecha_reserva = $2 AND estado IN ('confirmada', 'finalizada')
        `;
        
        const reservaExistente = await req.db.query(reservaExistenteQuery, [id_turno, fecha_reserva]);
        
        if (reservaExistente.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El turno ya está reservado para esta fecha',
                code: 'TURNO_NO_DISPONIBLE',
                timestamp: new Date().toISOString()
            });
        }
        
        // Crear la reserva
        const insertQuery = `
            INSERT INTO reservas (
                id_turno, 
                id_cliente, 
                fecha_reserva, 
                precio_total, 
                seña_pagada, 
                observaciones,
                id_empleado,
                estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmada')
            RETURNING *
        `;
        
        // TODO: Obtener id_empleado del token de autenticación
        const id_empleado = 1; // Temporal
        
        const insertResult = await req.db.query(insertQuery, [
            id_turno,
            id_cliente,
            fecha_reserva,
            precio_total,
            seña_pagada,
            observaciones,
            id_empleado
        ]);
        
        const nuevaReserva = insertResult.rows[0];
        
        res.status(201).json({
            success: true,
            data: {
                id: nuevaReserva.id_reserva,
                fechaReserva: nuevaReserva.fecha_reserva,
                estado: nuevaReserva.estado,
                precioTotal: parseFloat(nuevaReserva.precio_total),
                señaPagada: parseFloat(nuevaReserva.seña_pagada),
                saldoPendiente: parseFloat(nuevaReserva.saldo_pendiente),
                observaciones: nuevaReserva.observaciones,
                fechaCreacion: nuevaReserva.fecha_creacion
            },
            message: 'Reserva creada exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al crear reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/reservas/{id}:
 *   get:
 *     summary: Obtener detalles de una reserva específica
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalles de la reserva obtenidos exitosamente
 *       404:
 *         description: Reserva no encontrada
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                r.*,
                t.hora_inicio,
                t.hora_fin,
                c.numero as cancha_numero,
                c.precio_por_hora,
                d.nombre as deporte_nombre,
                d.descripcion as deporte_descripcion,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                cl.nombre as cliente_nombre,
                cl.apellido as cliente_apellido,
                cl.telefono as cliente_telefono,
                cl.email as cliente_email,
                e.nombre as empleado_nombre,
                e.apellido as empleado_apellido
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN clientes cl ON r.id_cliente = cl.id_cliente
            LEFT JOIN empleados e ON r.id_empleado = e.id_empleado
            WHERE r.id_reserva = $1
        `;
        
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada',
                timestamp: new Date().toISOString()
            });
        }
        
        const reserva = result.rows[0];
        
        const reservaDetallada = {
            id: reserva.id_reserva,
            fechaReserva: reserva.fecha_reserva,
            estado: reserva.estado,
            precioTotal: parseFloat(reserva.precio_total),
            señaPagada: parseFloat(reserva.seña_pagada),
            saldoPendiente: parseFloat(reserva.saldo_pendiente),
            observaciones: reserva.observaciones,
            fechaCreacion: reserva.fecha_creacion,
            fechaModificacion: reserva.fecha_modificacion,
            turno: {
                id: reserva.id_turno,
                horaInicio: reserva.hora_inicio.substring(0, 5),
                horaFin: reserva.hora_fin.substring(0, 5)
            },
            cancha: {
                numero: reserva.cancha_numero,
                precioPorHora: parseFloat(reserva.precio_por_hora)
            },
            deporte: {
                nombre: reserva.deporte_nombre,
                descripcion: reserva.deporte_descripcion
            },
            sede: {
                nombre: reserva.sede_nombre,
                direccion: reserva.sede_direccion
            },
            cliente: {
                id: reserva.id_cliente,
                nombre: `${reserva.cliente_nombre} ${reserva.cliente_apellido}`,
                telefono: reserva.cliente_telefono,
                email: reserva.cliente_email
            },
            empleado: reserva.empleado_nombre ? {
                nombre: `${reserva.empleado_nombre} ${reserva.empleado_apellido}`
            } : null
        };
        
        res.json({
            success: true,
            data: reservaDetallada,
            message: 'Detalles de reserva obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener detalles de reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 */