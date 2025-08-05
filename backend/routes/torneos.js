/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/torneos.js
 * Descripción: Rutas para gestión de torneos
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
 *     Torneo:
 *       type: object
 *       required:
 *         - nombre
 *         - id_deporte
 *         - id_sede
 *         - fecha_inicio
 *         - precio_inscripcion
 *         - max_participantes
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del torneo
 *         nombre:
 *           type: string
 *           description: Nombre del torneo
 *         descripcion:
 *           type: string
 *           description: Descripción del torneo
 *         id_deporte:
 *           type: integer
 *           description: ID del deporte
 *         id_sede:
 *           type: integer
 *           description: ID de la sede
 *         fecha_inicio:
 *           type: string
 *           format: date
 *           description: Fecha de inicio del torneo
 *         fecha_fin:
 *           type: string
 *           format: date
 *           description: Fecha de finalización del torneo
 *         precio_inscripcion:
 *           type: number
 *           description: Precio de inscripción
 *         max_participantes:
 *           type: integer
 *           description: Máximo número de participantes
 *         estado:
 *           type: string
 *           enum: [abierto, en_curso, finalizado, cancelado]
 *           description: Estado del torneo
 */

/**
 * @swagger
 * /api/torneos:
 *   get:
 *     summary: Obtener lista de torneos
 *     tags: [Torneos]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [abierto, en_curso, finalizado, cancelado]
 *         description: Filtrar por estado del torneo
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *         description: Filtrar por sede
 *       - in: query
 *         name: deporte_id
 *         schema:
 *           type: integer
 *         description: Filtrar por deporte
 *     responses:
 *       200:
 *         description: Lista de torneos obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Torneo'
 */
router.get('/', async (req, res) => {
    try {
        const { estado, sede_id, deporte_id, page = 1, limit = 10 } = req.query;
        
        let query = `
            SELECT 
                t.*,
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
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
        
        query += ` GROUP BY t.id_torneo, d.nombre, s.nombre, s.direccion ORDER BY t.fecha_inicio DESC`;
        
        // Agregar paginación
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);
        
        const result = await req.db.query(query, params);
        
        const torneosFormateados = result.rows.map(torneo => ({
            id: torneo.id_torneo,
            nombre: torneo.nombre,
            descripcion: torneo.descripcion,
            fechaInicio: torneo.fecha_inicio,
            fechaFin: torneo.fecha_fin,
            estado: torneo.estado,
            precioInscripcion: parseFloat(torneo.precio_inscripcion),
            maxParticipantes: torneo.max_participantes,
            participantesInscritos: parseInt(torneo.participantes_inscritos),
            cuposDisponibles: torneo.max_participantes - parseInt(torneo.participantes_inscritos),
            deporte: torneo.deporte_nombre,
            sede: {
                nombre: torneo.sede_nombre,
                direccion: torneo.sede_direccion
            }
        }));
        
        res.json({
            success: true,
            data: torneosFormateados,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: torneosFormateados.length
            },
            message: 'Torneos obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener torneos:', error);
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
 * /api/torneos:
 *   post:
 *     summary: Crear nuevo torneo
 *     tags: [Torneos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - id_deporte
 *               - id_sede
 *               - fecha_inicio
 *               - precio_inscripcion
 *               - max_participantes
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               id_deporte:
 *                 type: integer
 *               id_sede:
 *                 type: integer
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *               precio_inscripcion:
 *                 type: number
 *               max_participantes:
 *                 type: integer
 *               tipo_torneo:
 *                 type: string
 *                 default: eliminacion_simple
 *               premio_descripcion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Torneo creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/', async (req, res) => {
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
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @swagger
 * /api/torneos/{id}:
 *   get:
 *     summary: Obtener detalles de un torneo específico
 *     tags: [Torneos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del torneo
 *     responses:
 *       200:
 *         description: Detalles del torneo obtenidos exitosamente
 *       404:
 *         description: Torneo no encontrado
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                t.*,
                d.nombre as deporte_nombre,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion,
                COUNT(pt.id_participante) as participantes_inscritos
            FROM torneos t
            INNER JOIN deportes d ON t.id_deporte = d.id_deporte
            INNER JOIN sedes s ON t.id_sede = s.id_sede
            LEFT JOIN participantes_torneo pt ON t.id_torneo = pt.id_torneo AND pt.activo = true
            WHERE t.id_torneo = $1
            GROUP BY t.id_torneo, d.nombre, s.nombre, s.direccion
        `;
        
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Torneo no encontrado',
                timestamp: new Date().toISOString()
            });
        }
        
        const torneo = result.rows[0];
        
        res.json({
            success: true,
            data: {
                id: torneo.id_torneo,
                nombre: torneo.nombre,
                descripcion: torneo.descripcion,
                fechaInicio: torneo.fecha_inicio,
                fechaFin: torneo.fecha_fin,
                estado: torneo.estado,
                precioInscripcion: parseFloat(torneo.precio_inscripcion),
                maxParticipantes: torneo.max_participantes,
                participantesInscritos: parseInt(torneo.participantes_inscritos),
                cuposDisponibles: torneo.max_participantes - parseInt(torneo.participantes_inscritos),
                tipoTorneo: torneo.tipo_torneo,
                premio: torneo.premio_descripcion,
                deporte: torneo.deporte_nombre,
                sede: {
                    nombre: torneo.sede_nombre,
                    direccion: torneo.sede_direccion
                }
            },
            message: 'Detalles del torneo obtenidos correctamente',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error al obtener torneo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;