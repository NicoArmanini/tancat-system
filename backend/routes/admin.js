/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/admin.js
 * Descripción: Rutas de administración (protegidas)
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { injectDbClient } = require('../utils/database'); // RUTA CORREGIDA

// Aplicar middleware de base de datos
router.use(injectDbClient);

// TODO: Agregar middleware de autenticación
// const { authenticateToken, requireRole } = require('../middleware/auth');
// router.use(authenticateToken);

// ====================================
// RUTAS DE DASHBOARD
// ====================================

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Obtener datos del dashboard administrativo
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard obtenidos exitosamente
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Obtener estadísticas del dashboard
        const reservasHoyQuery = `
            SELECT COUNT(*) as total 
            FROM reservas 
            WHERE fecha_reserva = CURRENT_DATE 
            AND estado IN ('confirmada', 'finalizada')
        `;
        
        const clientesActivosQuery = `
            SELECT COUNT(*) as total 
            FROM clientes 
            WHERE activo = true
        `;
        
        const ventasDelDiaQuery = `
            SELECT COALESCE(SUM(total), 0) as total_ventas
            FROM ventas 
            WHERE DATE(fecha_venta) = CURRENT_DATE 
            AND estado = 'completada'
        `;
        
        const canchasDisponiblesQuery = `
            SELECT 
                COUNT(*) as total_canchas,
                COUNT(CASE WHEN r.id_reserva IS NULL THEN 1 END) as disponibles
            FROM canchas c
            LEFT JOIN turnos t ON c.id_cancha = t.id_cancha
            LEFT JOIN reservas r ON t.id_turno = r.id_turno 
                AND r.fecha_reserva = CURRENT_DATE
                AND r.estado IN ('confirmada', 'finalizada')
            WHERE c.activo = true
        `;
        
        const [reservasHoy, clientesActivos, ventasDelDia, canchasEstado] = await Promise.all([
            req.db.query(reservasHoyQuery),
            req.db.query(clientesActivosQuery),
            req.db.query(ventasDelDiaQuery),
            req.db.query(canchasDisponiblesQuery)
        ]);
        
        const stats = {
            reservasHoy: parseInt(reservasHoy.rows[0].total),
            clientesActivos: parseInt(clientesActivos.rows[0].total),
            ventasDelDia: parseFloat(ventasDelDia.rows[0].total_ventas),
            canchasDisponibles: `${canchasEstado.rows[0].disponibles}/${canchasEstado.rows[0].total_canchas}`
        };
        
        res.json({
            success: true,
            data: {
                resumen: stats,
                graficos: {
                    reservasPorMes: [],
                    ingresosPorDeporte: [],
                    ocupacionPorCancha: []
                }
            },
            message: 'Dashboard obtenido correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// RUTAS DE GESTIÓN DE EMPLEADOS
// ====================================

/**
 * @swagger
 * /api/admin/empleados:
 *   get:
 *     summary: Obtener lista de empleados
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.get('/empleados', async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id_empleado,
                e.nombre,
                e.apellido,
                e.email,
                e.telefono,
                e.fecha_ingreso,
                e.activo,
                r.nombre as rol,
                s.nombre as sede
            FROM empleados e
            LEFT JOIN roles r ON e.id_rol = r.id_rol
            LEFT JOIN sedes s ON e.id_sede = s.id_sede
            ORDER BY e.nombre, e.apellido
        `;
        
        const result = await req.db.query(query);
        
        res.json({
            success: true,
            data: result.rows.map(emp => ({
                id: emp.id_empleado,
                nombre: `${emp.nombre} ${emp.apellido}`,
                email: emp.email,
                telefono: emp.telefono,
                fechaIngreso: emp.fecha_ingreso,
                activo: emp.activo,
                rol: emp.rol,
                sede: emp.sede
            })),
            message: 'Empleados obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener empleados:', error);
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
 * /api/admin/empleados:
 *   post:
 *     summary: Crear nuevo empleado
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.post('/empleados', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, id_rol, id_sede, salario } = req.body;
        
        if (!nombre || !apellido || !email || !id_rol) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, apellido, email y rol son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        const insertQuery = `
            INSERT INTO empleados (nombre, apellido, email, telefono, id_rol, id_sede, salario)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const result = await req.db.query(insertQuery, [
            nombre, apellido, email, telefono, id_rol, id_sede, salario
        ]);
        
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id_empleado,
                nombre: `${result.rows[0].nombre} ${result.rows[0].apellido}`,
                email: result.rows[0].email
            },
            message: 'Empleado creado exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al crear empleado:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// RUTAS DE GESTIÓN DE SEDES
// ====================================

/**
 * @swagger
 * /api/admin/sedes:
 *   get:
 *     summary: Obtener sedes para administración
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sedes', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.*,
                COUNT(c.id_cancha) as total_canchas
            FROM sedes s
            LEFT JOIN canchas c ON s.id_sede = c.id_sede AND c.activo = true
            WHERE s.activo = true
            GROUP BY s.id_sede
            ORDER BY s.nombre
        `;
        
        const result = await req.db.query(query);
        
        res.json({
            success: true,
            data: result.rows.map(sede => ({
                id: sede.id_sede,
                nombre: sede.nombre,
                direccion: sede.direccion,
                telefono: sede.telefono,
                horarios: {
                    apertura: sede.horario_apertura,
                    cierre: sede.horario_cierre,
                    dias: sede.dias_funcionamiento
                },
                totalCanchas: parseInt(sede.total_canchas),
                activo: sede.activo
            })),
            message: 'Sedes obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener sedes:', error);
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
 * /api/admin/sedes:
 *   post:
 *     summary: Crear nueva sede
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sedes', async (req, res) => {
    try {
        const { nombre, direccion, telefono, horario_apertura, horario_cierre, dias_funcionamiento } = req.body;
        
        if (!nombre || !direccion) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y dirección son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        const insertQuery = `
            INSERT INTO sedes (nombre, direccion, telefono, horario_apertura, horario_cierre, dias_funcionamiento)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await req.db.query(insertQuery, [
            nombre, direccion, telefono, horario_apertura, horario_cierre, dias_funcionamiento
        ]);
        
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id_sede,
                nombre: result.rows[0].nombre,
                direccion: result.rows[0].direccion
            },
            message: 'Sede creada exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al crear sede:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// RUTAS DE GESTIÓN DE CANCHAS
// ====================================

/**
 * @swagger
 * /api/admin/canchas:
 *   get:
 *     summary: Obtener canchas para administración
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.get('/canchas', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*,
                s.nombre as sede_nombre,
                d.nombre as deporte_nombre
            FROM canchas c
            INNER JOIN sedes s ON c.id_sede = s.id_sede
            INNER JOIN deportes d ON c.id_deporte = d.id_deporte
            WHERE c.activo = true
            ORDER BY s.nombre, d.nombre, c.numero
        `;
        
        const result = await req.db.query(query);
        
        res.json({
            success: true,
            data: result.rows.map(cancha => ({
                id: cancha.id_cancha,
                numero: cancha.numero,
                sede: cancha.sede_nombre,
                deporte: cancha.deporte_nombre,
                capacidad: cancha.capacidad_jugadores,
                precioPorHora: parseFloat(cancha.precio_por_hora),
                observaciones: cancha.observaciones,
                activo: cancha.activo
            })),
            message: 'Canchas obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener canchas:', error);
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
 * /api/admin/canchas:
 *   post:
 *     summary: Crear nueva cancha
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.post('/canchas', async (req, res) => {
    try {
        const { numero, id_sede, id_deporte, capacidad_jugadores, precio_por_hora, observaciones } = req.body;
        
        if (!numero || !id_sede || !id_deporte || !precio_por_hora) {
            return res.status(400).json({
                success: false,
                message: 'Número, sede, deporte y precio por hora son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        const insertQuery = `
            INSERT INTO canchas (numero, id_sede, id_deporte, capacidad_jugadores, precio_por_hora, observaciones)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await req.db.query(insertQuery, [
            numero, id_sede, id_deporte, capacidad_jugadores, precio_por_hora, observaciones
        ]);
        
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id_cancha,
                numero: result.rows[0].numero,
                precioPorHora: parseFloat(result.rows[0].precio_por_hora)
            },
            message: 'Cancha creada exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al crear cancha:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// RUTAS DE CONFIGURACIÓN
// ====================================

/**
 * @swagger
 * /api/admin/configuracion:
 *   get:
 *     summary: Obtener configuración del sistema
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 */
router.get('/configuracion', (req, res) => {
    res.json({
        success: true,
        message: 'Configuración - Pendiente de implementación',
        data: {
            general: {},
            reservas: {},
            pagos: {},
            notificaciones: {}
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;