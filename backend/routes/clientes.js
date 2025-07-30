/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/clientes.js
 * Descripción: Rutas para operaciones del cliente (consultas públicas)
 */

const express = require('express');
const router = express.Router();

// Importar controladores y middlewares
const clienteController = require('../controllers/clientesController');

// Middleware de base de datos
const { injectDbClient } = require('../config/database');
router.use(injectDbClient);

// ====================================
// RUTAS PÚBLICAS - INFORMACIÓN GENERAL
// ====================================

/**
 * @swagger
 * /api/cliente/sedes:
 *   get:
 *     summary: Obtener información de todas las sedes activas
 *     tags: [Cliente]
 *     responses:
 *       200:
 *         description: Lista de sedes obtenida exitosamente
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       nombre:
 *                         type: string
 *                       direccion:
 *                         type: string
 *                       horarios:
 *                         type: object
 */
router.get('/sedes', clienteController.obtenerSedes);

/**
 * @swagger
 * /api/cliente/deportes:
 *   get:
 *     summary: Obtener todos los deportes disponibles
 *     tags: [Cliente]
 *     responses:
 *       200:
 *         description: Lista de deportes obtenida exitosamente
 */
router.get('/deportes', clienteController.obtenerDeportes);

/**
 * @swagger
 * /api/cliente/canchas:
 *   get:
 *     summary: Obtener canchas filtradas por sede y/o deporte
 *     tags: [Cliente]
 *     parameters:
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *         description: ID de la sede
 *       - in: query
 *         name: deporte_id
 *         schema:
 *           type: integer
 *         description: ID del deporte
 *     responses:
 *       200:
 *         description: Lista de canchas obtenida exitosamente
 */
router.get('/canchas', clienteController.obtenerCanchas);

/**
 * @swagger
 * /api/cliente/combinaciones-disponibles:
 *   get:
 *     summary: Obtener combinaciones válidas de sede-deporte
 *     tags: [Cliente]
 *     responses:
 *       200:
 *         description: Combinaciones obtenidas exitosamente
 */
router.get('/combinaciones-disponibles', clienteController.obtenerCombinacionesDisponibles);

/**
 * @swagger
 * /api/cliente/estadisticas:
 *   get:
 *     summary: Obtener estadísticas públicas del complejo
 *     tags: [Cliente]
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 */
router.get('/estadisticas', clienteController.obtenerEstadisticasPublicas);

// ====================================
// RUTAS PÚBLICAS - CONSULTAS DE DISPONIBILIDAD
// ====================================

/**
 * @swagger
 * /api/cliente/consulta-disponibilidad:
 *   post:
 *     summary: Consultar disponibilidad de turnos para una fecha específica
 *     tags: [Cliente]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sede_id
 *               - deporte_id
 *               - fecha
 *             properties:
 *               sede_id:
 *                 type: integer
 *                 description: ID de la sede
 *               deporte_id:
 *                 type: integer
 *                 description: ID del deporte
 *               fecha:
 *                 type: string
 *                 format: date
 *                 description: Fecha de consulta (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Disponibilidad consultada exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 */
router.post('/consulta-disponibilidad', clienteController.consultarDisponibilidad);

// ====================================
// RUTAS PÚBLICAS - TORNEOS
// ====================================

/**
 * @swagger
 * /api/cliente/torneos:
 *   get:
 *     summary: Obtener información de torneos activos
 *     tags: [Cliente]
 *     responses:
 *       200:
 *         description: Torneos activos obtenidos exitosamente
 */
router.get('/torneos', clienteController.obtenerTorneosActivos);

/**
 * @swagger
 * /api/cliente/torneos/{torneo_id}:
 *   get:
 *     summary: Obtener detalles de un torneo específico
 *     tags: [Cliente]
 *     parameters:
 *       - in: path
 *         name: torneo_id
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
router.get('/torneos/:torneo_id', clienteController.obtenerDetallesTorneo);

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================
router.use((error, req, res, next) => {
    console.error('Error en rutas de cliente:', error);
    
    // Determinar el tipo de error
    let statusCode = 500;
    let message = 'Error interno del servidor';
    
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Error de validación';
    } else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Formato de datos inválido';
    } else if (error.code === '23505') { // PostgreSQL unique violation
        statusCode = 409;
        message = 'Conflicto: el recurso ya existe';
    } else if (error.code === '23503') { // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Referencia inválida en los datos';
    }
    
    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? {
            message: error.message,
            stack: error.stack,
            code: error.code
        } : undefined,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;