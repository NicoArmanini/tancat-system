/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/inventario.js
 * Descripción: Rutas para gestión de inventario
 */

const express = require('express');
const router = express.Router();
const { injectDbClient } = require('../utils/database');

// Aplicar middleware de base de datos
router.use(injectDbClient);

/**
 * @swagger
 * components:
 *   schemas:
 *     Producto:
 *       type: object
 *       required:
 *         - nombre
 *         - precio_venta
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del producto
 *         codigo_barras:
 *           type: string
 *           description: Código de barras del producto
 *         nombre:
 *           type: string
 *           description: Nombre del producto
 *         descripcion:
 *           type: string
 *           description: Descripción del producto
 *         id_categoria:
 *           type: integer
 *           description: ID de la categoría
 *         precio_venta:
 *           type: number
 *           description: Precio de venta
 *         precio_compra:
 *           type: number
 *           description: Precio de compra
 *         stock_actual:
 *           type: integer
 *           description: Stock actual
 *         stock_minimo:
 *           type: integer
 *           description: Stock mínimo
 *         es_alquilable:
 *           type: boolean
 *           description: Si el producto es alquilable
 *         precio_alquiler:
 *           type: number
 *           description: Precio de alquiler
 */

/**
 * @swagger
 * /api/inventario:
 *   get:
 *     summary: Obtener lista de productos del inventario
 *     tags: [Inventario]
 *     parameters:
 *       - in: query
 *         name: categoria_id
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *         description: Filtrar por sede
 *       - in: query
 *         name: bajo_stock
 *         schema:
 *           type: boolean
 *         description: Mostrar solo productos con bajo stock
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre o código
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Producto'
 */
router.get('/', async (req, res) => {
    try {
        const { categoria_id, sede_id, bajo_stock, search, page = 1, limit = 20 } = req.query;
        
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
        
        if (search) {
            conditions.push(`(p.nombre ILIKE $${paramCount} OR p.codigo_barras ILIKE $${paramCount})`);
            params.push(`%${search}%`);
            paramCount++;
        }
        
        query += ` WHERE ${conditions.join(' AND ')}`;
        query += ` ORDER BY p.nombre`;
        
        // Agregar paginación
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);
        
        const result = await req.db.query(query, params);
        
        const productosFormateados = result.rows.map(producto => ({
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
            cantidadDisponible: parseInt(producto.cantidad_disponible || 0),
            cantidadAlquilada: parseInt(producto.cantidad_alquilada || 0),
            alertaBajoStock: producto.stock_actual <= producto.stock_minimo
        }));
        
        res.json({
            success: true,
            data: productosFormateados,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: productosFormateados.length
            },
            message: 'Inventario obtenido correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener inventario:', error);
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
 * /api/inventario:
 *   post:
 *     summary: Agregar nuevo producto al inventario
 *     tags: [Inventario]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - precio_venta
 *             properties:
 *               codigo_barras:
 *                 type: string
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               id_categoria:
 *                 type: integer
 *               precio_venta:
 *                 type: number
 *               precio_compra:
 *                 type: number
 *               stock_actual:
 *                 type: integer
 *               stock_minimo:
 *                 type: integer
 *               es_alquilable:
 *                 type: boolean
 *               precio_alquiler:
 *                 type: number
 *     responses:
 *       201:
 *         description: Producto agregado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/', async (req, res) => {
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
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/inventario/categorias:
 *   get:
 *     summary: Obtener categorías de productos
 *     tags: [Inventario]
 *     responses:
 *       200:
 *         description: Categorías obtenidas exitosamente
 */
router.get('/categorias', async (req, res) => {
    try {
        const query = `
            SELECT 
                id_categoria,
                nombre,
                descripcion,
                COUNT(p.id_producto) as total_productos
            FROM categorias_productos cp
            LEFT JOIN productos p ON cp.id_categoria = p.id_categoria AND p.activo = true
            WHERE cp.activo = true
            GROUP BY cp.id_categoria, cp.nombre, cp.descripcion
            ORDER BY cp.nombre
        `;
        
        const result = await req.db.query(query);
        
        res.json({
            success: true,
            data: result.rows.map(cat => ({
                id: cat.id_categoria,
                nombre: cat.nombre,
                descripcion: cat.descripcion,
                totalProductos: parseInt(cat.total_productos)
            })),
            message: 'Categorías obtenidas correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener categorías:', error);
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
 * /api/inventario/bajo-stock:
 *   get:
 *     summary: Obtener productos con bajo stock
 *     tags: [Inventario]
 *     responses:
 *       200:
 *         description: Productos con bajo stock obtenidos exitosamente
 */
router.get('/bajo-stock', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_producto,
                p.nombre,
                p.stock_actual,
                p.stock_minimo,
                c.nombre as categoria_nombre
            FROM productos p
            LEFT JOIN categorias_productos c ON p.id_categoria = c.id_categoria
            WHERE p.activo = true AND p.stock_actual <= p.stock_minimo
            ORDER BY (p.stock_actual - p.stock_minimo) ASC
        `;
        
        const result = await req.db.query(query);
        
        res.json({
            success: true,
            data: result.rows.map(producto => ({
                id: producto.id_producto,
                nombre: producto.nombre,
                stockActual: producto.stock_actual,
                stockMinimo: producto.stock_minimo,
                deficit: producto.stock_minimo - producto.stock_actual,
                categoria: producto.categoria_nombre
            })),
            total: result.rows.length,
            message: `${result.rows.length} productos con bajo stock`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener productos con bajo stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;