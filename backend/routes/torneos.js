// ====================================
// routes/torneos.js
// ====================================
const express = require('express');
const torneosRouter = express.Router();
const { injectDbClient } = require('../utils/database');

torneosRouter.use(injectDbClient);

/**
 * @swagger
 * /api/torneos:
 *   get:
 *     summary: Obtener lista de torneos
 *     tags: [Torneos]
 */
torneosRouter.get('/', async (req, res) => {
    try {
        const { estado, sede_id, deporte_id } = req.query;
        
        let query = `
            SELECT 
                t.*,
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre,
                COUNT(pt.id_participante) as participantes_inscritos
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            LEFT JOIN participantes_torneo pt ON t.id_torneo = pt.id_torneo AND pt.activo = true
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (estado) {
            query += ` AND t.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }
        
        if (sede_id) {
            query += ` AND t.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        if (deporte_id) {
            query += ` AND t.id_deporte = $${paramCount}`;
            params.push(parseInt(deporte_id));
            paramCount++;
        }
        
        query += ` GROUP BY t.id_torneo, d.nombre, s.nombre ORDER BY t.fecha_inicio DESC`;
        
        const result = await req.db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows.map(torneo => ({
                id: torneo.id_torneo,
                nombre: torneo.nombre,
                descripcion: torneo.descripcion,
                fechaInicio: torneo.fecha_inicio,
                fechaFin: torneo.fecha_fin,
                estado: torneo.estado,
                precioInscripcion: parseFloat(torneo.precio_inscripcion),
                maxParticipantes: torneo.max_participantes,
                participantesInscritos: parseInt(torneo.participantes_inscritos),
                deporte: torneo.deporte_nombre,
                sede: torneo.sede_nombre
            })),
            message: 'Torneos obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener torneos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/torneos:
 *   post:
 *     summary: Crear nuevo torneo
 *     tags: [Torneos]
 */
torneosRouter.post('/', async (req, res) => {
    try {
        const {
            nombre,
            descripcion,
            id_deporte,
            id_sede,
            fecha_inicio,
            fecha_fin,
            precio_inscripcion,
            max_participantes,
            tipo_torneo = 'eliminacion_simple',
            premio_descripcion
        } = req.body;
        
        // Validaciones básicas
        if (!nombre || !id_deporte || !id_sede || !fecha_inicio || !precio_inscripcion || !max_participantes) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: nombre, id_deporte, id_sede, fecha_inicio, precio_inscripcion, max_participantes',
                timestamp: new Date().toISOString()
            });
        }
        
        const insertQuery = `
            INSERT INTO torneos (
                nombre, descripcion, id_deporte, id_sede, fecha_inicio, fecha_fin,
                precio_inscripcion, max_participantes, tipo_torneo, premio_descripcion, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'abierto')
            RETURNING *
        `;
        
        const result = await req.db.query(insertQuery, [
            nombre, descripcion, id_deporte, id_sede, fecha_inicio, fecha_fin,
            precio_inscripcion, max_participantes, tipo_torneo, premio_descripcion
        ]);
        
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id_torneo,
                nombre: result.rows[0].nombre,
                estado: result.rows[0].estado,
                fechaCreacion: result.rows[0].fecha_creacion
            },
            message: 'Torneo creado exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al crear torneo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// routes/inventario.js
// ====================================
const inventarioRouter = express.Router();
inventarioRouter.use(injectDbClient);

/**
 * @swagger
 * /api/inventario:
 *   get:
 *     summary: Obtener lista de productos del inventario
 *     tags: [Inventario]
 */
inventarioRouter.get('/', async (req, res) => {
    try {
        const { categoria_id, sede_id, bajo_stock } = req.query;
        
        let query = `
            SELECT 
                p.*,
                c.nombre as categoria_nombre,
                COALESCE(sp.cantidad_disponible, 0) as cantidad_disponible,
                COALESCE(sp.cantidad_alquilada, 0) as cantidad_alquilada
            FROM productos p
            LEFT JOIN categorias_productos c ON p.id_categoria = c.id_categoria
            LEFT JOIN stock_por_sede sp ON p.id_producto = sp.id_producto
        `;
        
        const conditions = ['p.activo = true'];
        const params = [];
        let paramCount = 1;
        
        if (categoria_id) {
            conditions.push(`p.id_categoria = $${paramCount}`);
            params.push(parseInt(categoria_id));
            paramCount++;
        }
        
        if (sede_id) {
            conditions.push(`sp.id_sede = $${paramCount}`);
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        if (bajo_stock === 'true') {
            conditions.push(`p.stock_actual <= p.stock_minimo`);
        }
        
        query += ` WHERE ${conditions.join(' AND ')} ORDER BY p.nombre`;
        
        const result = await req.db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows.map(producto => ({
                id: producto.id_producto,
                codigoBarras: producto.codigo_barras,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                categoria: producto.categoria_nombre,
                precioVenta: parseFloat(producto.precio_venta),
                precioCompra: parseFloat(producto.precio_compra || 0),
                stockActual: producto.stock_actual,
                stockMinimo: producto.stock_minimo,
                esAlquilable: producto.es_alquilable,
                precioAlquiler: parseFloat(producto.precio_alquiler || 0),
                cantidadDisponible: parseInt(producto.cantidad_disponible),
                cantidadAlquilada: parseInt(producto.cantidad_alquilada)
            })),
            message: 'Inventario obtenido correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/inventario:
 *   post:
 *     summary: Agregar nuevo producto al inventario
 *     tags: [Inventario]
 */
inventarioRouter.post('/', async (req, res) => {
    try {
        const {
            codigo_barras,
            nombre,
            descripcion,
            id_categoria,
            precio_venta,
            precio_compra,
            stock_actual = 0,
            stock_minimo = 5,
            es_alquilable = false,
            precio_alquiler
        } = req.body;
        
        if (!nombre || !precio_venta) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y precio de venta son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        const insertQuery = `
            INSERT INTO productos (
                codigo_barras, nombre, descripcion, id_categoria, precio_venta,
                precio_compra, stock_actual, stock_minimo, es_alquilable, precio_alquiler
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const result = await req.db.query(insertQuery, [
            codigo_barras, nombre, descripcion, id_categoria, precio_venta,
            precio_compra, stock_actual, stock_minimo, es_alquilable, precio_alquiler
        ]);
        
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id_producto,
                nombre: result.rows[0].nombre,
                precioVenta: parseFloat(result.rows[0].precio_venta),
                stockActual: result.rows[0].stock_actual
            },
            message: 'Producto agregado exitosamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al agregar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// routes/reportes.js
// ====================================
const reportesRouter = express.Router();
reportesRouter.use(injectDbClient);

/**
 * @swagger
 * /api/reportes:
 *   get:
 *     summary: Obtener lista de reportes disponibles
 *     tags: [Reportes]
 */
reportesRouter.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            disponibles: [
                {
                    id: 'reservas',
                    nombre: 'Reporte de Reservas',
                    descripcion: 'Reporte detallado de reservas por período',
                    endpoint: '/api/reportes/reservas'
                },
                {
                    id: 'ingresos',
                    nombre: 'Reporte de Ingresos',
                    descripcion: 'Análisis de ingresos por deporte, sede y período',
                    endpoint: '/api/reportes/ingresos'
                },
                {
                    id: 'ocupacion',
                    nombre: 'Reporte de Ocupación',
                    descripcion: 'Estadísticas de ocupación de canchas',
                    endpoint: '/api/reportes/ocupacion'
                },
                {
                    id: 'clientes',
                    nombre: 'Reporte de Clientes',
                    descripcion: 'Análisis de comportamiento de clientes',
                    endpoint: '/api/reportes/clientes'
                }
            ]
        },
        message: 'Reportes disponibles',
        timestamp: new Date().toISOString()
    });
});

/**
 * @swagger
 * /api/reportes/reservas:
 *   get:
 *     summary: Generar reporte de reservas
 *     tags: [Reportes]
 */
reportesRouter.get('/reservas', async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, sede_id, formato = 'json' } = req.query;
        
        // Por ahora retornamos estructura básica
        res.json({
            success: true,
            data: {
                tipo: 'reporte_reservas',
                periodo: { desde: fecha_desde, hasta: fecha_hasta },
                mensaje: 'Reporte de reservas - Implementación pendiente',
                parametros: { sede_id, formato }
            },
            message: 'Reporte generado - Funcionalidad en desarrollo',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al generar reporte de reservas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

reportesRouter.get('/ingresos', async (req, res) => {
    res.json({
        success: true,
        data: { mensaje: 'Reporte de ingresos - Implementación pendiente' },
        message: 'Funcionalidad en desarrollo',
        timestamp: new Date().toISOString()
    });
});

// ====================================
// routes/ventas.js
// ====================================
const ventasRouter = express.Router();
ventasRouter.use(injectDbClient);

/**
 * @swagger
 * /api/ventas:
 *   get:
 *     summary: Obtener lista de ventas
 *     tags: [Ventas]
 */
ventasRouter.get('/', async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, sede_id } = req.query;
        
        let query = `
            SELECT 
                v.*,
                s.nombre as sede_nombre,
                cl.nombre as cliente_nombre,
                cl.apellido as cliente_apellido,
                e.nombre as empleado_nombre,
                e.apellido as empleado_apellido
            FROM ventas v
            INNER JOIN sedes s ON v.id_sede = s.id_sede
            LEFT JOIN clientes cl ON v.id_cliente = cl.id_cliente
            LEFT JOIN empleados e ON v.id_empleado = e.id_empleado
            WHERE v.estado = 'completada'
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (fecha_desde) {
            query += ` AND DATE(v.fecha_venta) >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }
        
        if (fecha_hasta) {
            query += ` AND DATE(v.fecha_venta) <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }
        
        if (sede_id) {
            query += ` AND v.id_sede = $${paramCount}`;
            params.push(parseInt(sede_id));
            paramCount++;
        }
        
        query += ` ORDER BY v.fecha_venta DESC LIMIT 50`;
        
        const result = await req.db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows.map(venta => ({
                id: venta.id_venta,
                numeroTicket: venta.numero_ticket,
                fechaVenta: venta.fecha_venta,
                subtotal: parseFloat(venta.subtotal),
                descuento: parseFloat(venta.descuento || 0),
                total: parseFloat(venta.total),
                metodoPago: venta.metodo_pago,
                sede: venta.sede_nombre,
                cliente: venta.cliente_nombre ? `${venta.cliente_nombre} ${venta.cliente_apellido}` : null,
                empleado: venta.empleado_nombre ? `${venta.empleado_nombre} ${venta.empleado_apellido}` : null
            })),
            message: 'Ventas obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/ventas:
 *   post:
 *     summary: Registrar nueva venta
 *     tags: [Ventas]
 */
ventasRouter.post('/', async (req, res) => {
    try {
        const {
            id_sede,
            id_cliente,
            productos, // Array de { id_producto, cantidad, precio_unitario }
            descuento = 0,
            metodo_pago = 'efectivo',
            observaciones
        } = req.body;
        
        if (!id_sede || !productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'id_sede y productos son requeridos',
                timestamp: new Date().toISOString()
            });
        }
        
        // Calcular totales
        const subtotal = productos.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
        const total = subtotal - descuento;
        
        // Generar número de ticket
        const numeroTicket = `TKT-${Date.now()}`;
        
        // TODO: Implementar transacción completa con detalles de venta
        res.status(201).json({
            success: true,
            data: {
                numeroTicket,
                subtotal,
                descuento,
                total,
                mensaje: 'Funcionalidad de venta - Implementación completa pendiente'
            },
            message: 'Estructura de venta creada - Funcionalidad en desarrollo',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al registrar venta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

ventasRouter.get('/productos', async (req, res) => {
    try {
        const { categoria_id, disponibles_only } = req.query;
        
        let query = `
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio_venta,
                p.stock_actual,
                p.es_alquilable,
                p.precio_alquiler,
                c.nombre as categoria_nombre
            FROM productos p
            LEFT JOIN categorias_productos c ON p.id_categoria = c.id_categoria
            WHERE p.activo = true
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (categoria_id) {
            query += ` AND p.id_categoria = ${paramCount}`;
            params.push(parseInt(categoria_id));
            paramCount++;
        }
        
        if (disponibles_only === 'true') {
            query += ` AND p.stock_actual > 0`;
        }
        
        query += ` ORDER BY p.nombre`;
        
        const result = await req.db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows.map(producto => ({
                id: producto.id_producto,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precioVenta: parseFloat(producto.precio_venta),
                stockActual: producto.stock_actual,
                esAlquilable: producto.es_alquilable,
                precioAlquiler: parseFloat(producto.precio_alquiler || 0),
                categoria: producto.categoria_nombre
            })),
            message: 'Productos para venta obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener productos para venta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// EXPORTAR MÓDULOS COMO ARCHIVOS SEPARADOS
// ====================================

// Para usar estos archivos por separado, guarda cada sección en su archivo correspondiente:

/*
ARCHIVO: routes/torneos.js
- Copiar la sección de torneosRouter
- Agregar: module.exports = torneosRouter;

ARCHIVO: routes/inventario.js  
- Copiar la sección de inventarioRouter
- Agregar: module.exports = inventarioRouter;

ARCHIVO: routes/reportes.js
- Copiar la sección de reportesRouter  
- Agregar: module.exports = reportesRouter;

ARCHIVO: routes/ventas.js
- Copiar la sección de ventasRouter
- Agregar: module.exports = ventasRouter;
*/

module.exports = {
    torneos: torneosRouter,
    inventario: inventarioRouter,
    reportes: reportesRouter,
    ventas: ventasRouter
};