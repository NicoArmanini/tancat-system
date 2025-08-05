/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/reportes.js
 * Descripción: Rutas para generación de reportes
 */

const express = require('express');
const router = express.Router();
const { injectDbClient } = require('../utils/database');

// Aplicar middleware de base de datos
router.use(injectDbClient);

/**
 * @swagger
 * /api/reportes:
 *   get:
 *     summary: Obtener lista de reportes disponibles
 *     tags: [Reportes]
 *     responses:
 *       200:
 *         description: Lista de reportes disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     disponibles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                           descripcion:
 *                             type: string
 *                           endpoint:
 *                             type: string
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            disponibles: [
                {
                    id: 'reservas',
                    nombre: 'Reporte de Reservas',
                    descripcion: 'Reporte detallado de reservas por período',
                    endpoint: '/api/reportes/reservas',
                    parametros: ['fecha_desde', 'fecha_hasta', 'sede_id']
                },
                {
                    id: 'ingresos',
                    nombre: 'Reporte de Ingresos',
                    descripcion: 'Análisis de ingresos por deporte, sede y período',
                    endpoint: '/api/reportes/ingresos',
                    parametros: ['fecha_desde', 'fecha_hasta', 'agrupacion']
                },
                {
                    id: 'ocupacion',
                    nombre: 'Reporte de Ocupación',
                    descripcion: 'Estadísticas de ocupación de canchas',
                    endpoint: '/api/reportes/ocupacion',
                    parametros: ['fecha_desde', 'fecha_hasta', 'sede_id']
                },
                {
                    id: 'clientes',
                    nombre: 'Reporte de Clientes',
                    descripcion: 'Análisis de comportamiento de clientes',
                    endpoint: '/api/reportes/clientes',
                    parametros: ['fecha_desde', 'fecha_hasta', 'tipo_analisis']
                },
                {
                    id: 'inventario',
                    nombre: 'Reporte de Inventario',
                    descripcion: 'Estado actual del inventario y movimientos',
                    endpoint: '/api/reportes/inventario',
                    parametros: ['categoria_id', 'bajo_stock']
                },
                {
                    id: 'ventas',
                    nombre: 'Reporte de Ventas',
                    descripcion: 'Análisis de ventas de productos',
                    endpoint: '/api/reportes/ventas',
                    parametros: ['fecha_desde', 'fecha_hasta', 'producto_id']
                }
            ]
        },
        message: 'Reportes disponibles obtenidos correctamente',
        timestamp: new Date().toISOString()
    });
});

/**
 * @swagger
 * /api/reportes/reservas:
 *   get:
 *     summary: Generar reporte de reservas
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del reporte
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin del reporte
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *         description: Filtrar por sede específica
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Formato de salida del reporte
 *     responses:
 *       200:
 *         description: Reporte de reservas generado exitosamente
 */
router.get('/reservas', async (req, res) => {
    try {
        const { 
            fecha_desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            fecha_hasta = new Date().toISOString().split('T')[0],
            sede_id,
            formato = 'json'
        } = req.query;
        
        let query = `
            SELECT 
                r.fecha_reserva,
                r.estado,
                r.precio_total,
                r.seña_pagada,
                t.hora_inicio,
                t.hora_fin,
                c.numero as cancha_numero,
                d.nombre as deporte,
                s.nombre as sede,
                cl.nombre as cliente_nombre,
                cl.apellido as cliente_apellido,
                cl.telefono as cliente_telefono
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN clientes cl ON r.id_cliente = cl.id_cliente
            WHERE r.fecha_reserva BETWEEN $1 AND $2
        `;
        
        const params = [fecha_desde, fecha_hasta];
        let paramCount = 3;
        
        if (sede_id) {
            query += ` AND s.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        query += ` ORDER BY r.fecha_reserva DESC, t.hora_inicio ASC`;
        
        const result = await req.db.query(query, params);
        
        // Generar estadísticas del reporte
        const estadisticas = {
            totalReservas: result.rows.length,
            ingresosTotales: result.rows.reduce((sum, row) => sum + parseFloat(row.precio_total), 0),
            señasCobradas: result.rows.reduce((sum, row) => sum + parseFloat(row.seña_pagada), 0),
            reservasPorEstado: result.rows.reduce((acc, row) => {
                acc[row.estado] = (acc[row.estado] || 0) + 1;
                return acc;
            }, {}),
            reservasPorDeporte: result.rows.reduce((acc, row) => {
                acc[row.deporte] = (acc[row.deporte] || 0) + 1;
                return acc;
            }, {})
        };
        
        const reporteData = {
            parametros: {
                fechaDesde: fecha_desde,
                fechaHasta: fecha_hasta,
                sede: sede_id || 'Todas las sedes'
            },
            estadisticas,
            reservas: result.rows.map(reserva => ({
                fecha: reserva.fecha_reserva,
                hora: `${reserva.hora_inicio.substring(0, 5)} - ${reserva.hora_fin.substring(0, 5)}`,
                cliente: `${reserva.cliente_nombre} ${reserva.cliente_apellido}`,
                telefono: reserva.cliente_telefono,
                cancha: `${reserva.deporte} - Cancha ${reserva.cancha_numero}`,
                sede: reserva.sede,
                estado: reserva.estado,
                precioTotal: parseFloat(reserva.precio_total),
                señaPagada: parseFloat(reserva.seña_pagada)
            }))
        };
        
        if (formato === 'csv') {
            // Generar CSV
            const csvHeaders = ['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Cancha', 'Sede', 'Estado', 'Precio Total', 'Seña Pagada'];
            const csvRows = reporteData.reservas.map(r => [
                r.fecha, r.hora, r.cliente, r.telefono, r.cancha, r.sede, r.estado, r.precioTotal, r.señaPagada
            ]);
            
            const csvContent = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=reporte_reservas_${fecha_desde}_${fecha_hasta}.csv`);
            res.send(csvContent);
        } else {
            res.json({
                success: true,
                data: reporteData,
                message: 'Reporte de reservas generado correctamente',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('Error al generar reporte de reservas:', error);
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
 * /api/reportes/ingresos:
 *   get:
 *     summary: Generar reporte de ingresos
 *     tags: [Reportes]
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
 *         name: agrupacion
 *         schema:
 *           type: string
 *           enum: [diario, semanal, mensual]
 *           default: diario
 *     responses:
 *       200:
 *         description: Reporte de ingresos generado exitosamente
 */
router.get('/ingresos', async (req, res) => {
    try {
        const { 
            fecha_desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            fecha_hasta = new Date().toISOString().split('T')[0],
            agrupacion = 'diario'
        } = req.query;
        
        let dateGroup;
        switch (agrupacion) {
            case 'semanal':
                dateGroup = "DATE_TRUNC('week', r.fecha_reserva)";
                break;
            case 'mensual':
                dateGroup = "DATE_TRUNC('month', r.fecha_reserva)";
                break;
            default:
                dateGroup = "r.fecha_reserva";
        }
        
        const ingresosPorPeriodoQuery = `
            SELECT 
                ${dateGroup} as periodo,
                COUNT(*) as total_reservas,
                SUM(r.precio_total) as ingresos_reservas,
                SUM(r.seña_pagada) as señas_cobradas
            FROM reservas r
            WHERE r.fecha_reserva BETWEEN $1 AND $2
                AND r.estado IN ('confirmada', 'finalizada')
            GROUP BY ${dateGroup}
            ORDER BY periodo
        `;
        
        const ingresosPorDeporteQuery = `
            SELECT 
                d.nombre as deporte,
                COUNT(*) as total_reservas,
                SUM(r.precio_total) as ingresos_totales,
                AVG(r.precio_total) as precio_promedio
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE r.fecha_reserva BETWEEN $1 AND $2
                AND r.estado IN ('confirmada', 'finalizada')
            GROUP BY d.id_deporte, d.nombre
            ORDER BY ingresos_totales DESC
        `;
        
        const ingresosPorSedeQuery = `
            SELECT 
                s.nombre as sede,
                COUNT(*) as total_reservas,
                SUM(r.precio_total) as ingresos_totales
            FROM reservas r
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas c ON t.id_cancha = c.id_cancha
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            WHERE r.fecha_reserva BETWEEN $1 AND $2
                AND r.estado IN ('confirmada', 'finalizada')
            GROUP BY s.id_sede, s.nombre
            ORDER BY ingresos_totales DESC
        `;
        
        const [periodoResult, deporteResult, sedeResult] = await Promise.all([
            req.db.query(ingresosPorPeriodoQuery, [fecha_desde, fecha_hasta]),
            req.db.query(ingresosPorDeporteQuery, [fecha_desde, fecha_hasta]),
            req.db.query(ingresosPorSedeQuery, [fecha_desde, fecha_hasta])
        ]);
        
        res.json({
            success: true,
            data: {
                parametros: {
                    fechaDesde: fecha_desde,
                    fechaHasta: fecha_hasta,
                    agrupacion: agrupacion
                },
                ingresosPorPeriodo: periodoResult.rows.map(row => ({
                    periodo: row.periodo,
                    totalReservas: parseInt(row.total_reservas),
                    ingresosReservas: parseFloat(row.ingresos_reservas),
                    señasCobradas: parseFloat(row.señas_cobradas)
                })),
                ingresosPorDeporte: deporteResult.rows.map(row => ({
                    deporte: row.deporte,
                    totalReservas: parseInt(row.total_reservas),
                    ingresosTotales: parseFloat(row.ingresos_totales),
                    precioPromedio: parseFloat(row.precio_promedio)
                })),
                ingresosPorSede: sedeResult.rows.map(row => ({
                    sede: row.sede,
                    totalReservas: parseInt(row.total_reservas),
                    ingresosTotales: parseFloat(row.ingresos_totales)
                }))
            },
            message: 'Reporte de ingresos generado correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al generar reporte de ingresos:', error);
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
 * /api/reportes/ocupacion:
 *   get:
 *     summary: Generar reporte de ocupación de canchas
 *     tags: [Reportes]
 *     responses:
 *       200:
 *         description: Reporte de ocupación generado exitosamente
 */
router.get('/ocupacion', async (req, res) => {
    try {
        const { 
            fecha_desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            fecha_hasta = new Date().toISOString().split('T')[0],
            sede_id
        } = req.query;
        
        let query = `
            WITH turnos_totales AS (
                SELECT 
                    c.id_cancha,
                    c.numero as cancha_numero,
                    d.nombre as deporte,
                    s.nombre as sede,
                    COUNT(DISTINCT t.id_turno) as turnos_disponibles
                FROM canchas c
                INNER JOIN deportes d ON c.id_deporte = d.id_deporte
                INNER JOIN sedes s ON c.id_sede = s.id_sede
                INNER JOIN turnos t ON c.id_cancha = t.id_cancha
                WHERE c.activo = true AND t.activo = true
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (sede_id) {
            query += ` AND s.id_sede = ${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        query += `
                GROUP BY c.id_cancha, c.numero, d.nombre, s.nombre
            ),
            turnos_ocupados AS (
                SELECT 
                    c.id_cancha,
                    COUNT(DISTINCT r.id_reserva) as reservas_realizadas
                FROM canchas c
                INNER JOIN turnos t ON c.id_cancha = t.id_cancha
                INNER JOIN reservas r ON t.id_turno = r.id_turno
                WHERE r.fecha_reserva BETWEEN ${paramCount} AND ${paramCount + 1}
                    AND r.estado IN ('confirmada', 'finalizada')
        `;
        
        params.push(fecha_desde, fecha_hasta);
        paramCount += 2;
        
        if (sede_id) {
            query += ` AND c.id_sede = ${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        query += `
                GROUP BY c.id_cancha
            )
            SELECT 
                tt.cancha_numero,
                tt.deporte,
                tt.sede,
                tt.turnos_disponibles,
                COALESCE(to.reservas_realizadas, 0) as turnos_ocupados,
                ROUND(
                    (COALESCE(to.reservas_realizadas, 0)::decimal / 
                     (tt.turnos_disponibles * (DATE '${paramCount - 1}' - DATE '${paramCount - 2}' + 1))) * 100, 2
                ) as porcentaje_ocupacion
            FROM turnos_totales tt
            LEFT JOIN turnos_ocupados to ON tt.id_cancha = to.id_cancha
            ORDER BY porcentaje_ocupacion DESC
        `;
        
        const result = await req.db.query(query, params);
        
        // Calcular estadísticas generales
        const ocupacionPromedio = result.rows.length > 0 
            ? result.rows.reduce((sum, row) => sum + parseFloat(row.porcentaje_ocupacion), 0) / result.rows.length
            : 0;
        
        const canchasMasOcupadas = result.rows.slice(0, 3);
        const canchasMenosOcupadas = result.rows.slice(-3).reverse();
        
        res.json({
            success: true,
            data: {
                parametros: {
                    fechaDesde: fecha_desde,
                    fechaHasta: fecha_hasta,
                    sede: sede_id || 'Todas las sedes'
                },
                estadisticas: {
                    ocupacionPromedio: parseFloat(ocupacionPromedio.toFixed(2)),
                    totalCanchas: result.rows.length,
                    canchasMasOcupadas,
                    canchasMenosOcupadas
                },
                ocupacionPorCancha: result.rows.map(row => ({
                    cancha: `${row.deporte} - Cancha ${row.cancha_numero}`,
                    sede: row.sede,
                    turnosDisponibles: parseInt(row.turnos_disponibles),
                    turnosOcupados: parseInt(row.turnos_ocupados),
                    porcentajeOcupacion: parseFloat(row.porcentaje_ocupacion)
                }))
            },
            message: 'Reporte de ocupación generado correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al generar reporte de ocupación:', error);
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
 * /api/reportes/clientes:
 *   get:
 *     summary: Generar reporte de análisis de clientes
 *     tags: [Reportes]
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
 *         name: tipo_analisis
 *         schema:
 *           type: string
 *           enum: [frecuencia, ingresos, deportes]
 *           default: frecuencia
 *     responses:
 *       200:
 *         description: Reporte de clientes generado exitosamente
 */
router.get('/clientes', async (req, res) => {
    try {
        const { 
            fecha_desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            fecha_hasta = new Date().toISOString().split('T')[0],
            tipo_analisis = 'frecuencia'
        } = req.query;
        
        const clientesFrecuentesQuery = `
            SELECT 
                c.id_cliente,
                c.nombre,
                c.apellido,
                c.telefono,
                c.email,
                COUNT(r.id_reserva) as total_reservas,
                SUM(r.precio_total) as gasto_total,
                AVG(r.precio_total) as gasto_promedio,
                MIN(r.fecha_reserva) as primera_reserva,
                MAX(r.fecha_reserva) as ultima_reserva
            FROM clientes c
            INNER JOIN reservas r ON c.id_cliente = r.id_cliente
            WHERE r.fecha_reserva BETWEEN $1 AND $2
                AND r.estado IN ('confirmada', 'finalizada')
            GROUP BY c.id_cliente, c.nombre, c.apellido, c.telefono, c.email
            ORDER BY total_reservas DESC
            LIMIT 20
        `;
        
        const clientesPorDeporteQuery = `
            SELECT 
                d.nombre as deporte,
                COUNT(DISTINCT c.id_cliente) as clientes_unicos,
                COUNT(r.id_reserva) as total_reservas,
                SUM(r.precio_total) as ingresos_totales
            FROM clientes c
            INNER JOIN reservas r ON c.id_cliente = r.id_cliente
            INNER JOIN turnos t ON r.id_turno = t.id_turno
            INNER JOIN canchas ca ON t.id_cancha = ca.id_cancha
            INNER JOIN deportes d ON ca.id_deporte = d.id_deporte
            WHERE r.fecha_reserva BETWEEN $1 AND $2
                AND r.estado IN ('confirmada', 'finalizada')
            GROUP BY d.id_deporte, d.nombre
            ORDER BY clientes_unicos DESC
        `;
        
        const nuevosClientesQuery = `
            SELECT 
                DATE_TRUNC('month', c.fecha_registro) as mes,
                COUNT(*) as nuevos_clientes
            FROM clientes c
            WHERE c.fecha_registro BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('month', c.fecha_registro)
            ORDER BY mes
        `;
        
        const [frecuentesResult, deportesResult, nuevosResult] = await Promise.all([
            req.db.query(clientesFrecuentesQuery, [fecha_desde, fecha_hasta]),
            req.db.query(clientesPorDeporteQuery, [fecha_desde, fecha_hasta]),
            req.db.query(nuevosClientesQuery, [fecha_desde, fecha_hasta])
        ]);
        
        res.json({
            success: true,
            data: {
                parametros: {
                    fechaDesde: fecha_desde,
                    fechaHasta: fecha_hasta,
                    tipoAnalisis: tipo_analisis
                },
                clientesFrecuentes: frecuentesResult.rows.map(cliente => ({
                    id: cliente.id_cliente,
                    nombre: `${cliente.nombre} ${cliente.apellido}`,
                    telefono: cliente.telefono,
                    email: cliente.email,
                    totalReservas: parseInt(cliente.total_reservas),
                    gastoTotal: parseFloat(cliente.gasto_total),
                    gastoPromedio: parseFloat(cliente.gasto_promedio),
                    primeraReserva: cliente.primera_reserva,
                    ultimaReserva: cliente.ultima_reserva
                })),
                clientesPorDeporte: deportesResult.rows.map(deporte => ({
                    deporte: deporte.deporte,
                    clientesUnicos: parseInt(deporte.clientes_unicos),
                    totalReservas: parseInt(deporte.total_reservas),
                    ingresosTotales: parseFloat(deporte.ingresos_totales)
                })),
                nuevosClientesPorMes: nuevosResult.rows.map(mes => ({
                    mes: mes.mes,
                    nuevosClientes: parseInt(mes.nuevos_clientes)
                }))
            },
            message: 'Reporte de clientes generado correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al generar reporte de clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;