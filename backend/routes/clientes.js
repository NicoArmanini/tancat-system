/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/clientes.js
 * Descripción: Rutas para operaciones del cliente (consultas públicas)
 */

const express = require('express');
const router = express.Router();

// Importar controladores
const clienteController = require('../controllers/clienteController');

// Middleware de base de datos
const { injectDbClient } = require('../utils/database');
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
 *               deporte_id:
 *                 type: integer
 *               fecha:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Disponibilidad consultada exitosamente
 */
router.post('/consulta-disponibilidad', clienteController.consultarDisponibilidad);

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

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================
router.use((error, req, res, next) => {
    console.error('Error en rutas de cliente:', error);
    
    let statusCode = 500;
    let message = 'Error interno del servidor';
    
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Error de validación';
    } else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Formato de datos inválido';
    } else if (error.code === '23505') {
        statusCode = 409;
        message = 'Conflicto: el recurso ya existe';
    } else if (error.code === '23503') {
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