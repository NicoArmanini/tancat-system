/**
 * TANCAT - Backend Application
 * Archivo: app.js
 * Descripción: Configuración principal del servidor Express
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ====================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ====================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ====================================
// MIDDLEWARE DE SEGURIDAD
// ====================================

// Helmet para headers de seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS - Configuración para desarrollo y producción
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ];
        
        // En desarrollo, permitir todos los orígenes localhost
        if (NODE_ENV === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
    message: {
        success: false,
        message: 'Demasiadas peticiones, intenta más tarde',
        data: null
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// ====================================
// MIDDLEWARE DE PARSEO Y COMPRESIÓN
// ====================================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ====================================
// LOGGING
// ====================================
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ====================================
// MIDDLEWARE DE INFORMACIÓN DE REQUEST
// ====================================
app.use((req, res, next) => {
    req.startTime = Date.now();
    res.locals.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    next();
});

// ====================================
// RUTAS DE HEALTH CHECK PRINCIPAL
// ====================================
app.get('/api/health', async (req, res) => {
    const { Pool } = require('pg');
    
    try {
        // Configurar pool temporal para health check
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'tancat_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000
        });

        const result = await pool.query('SELECT NOW() as timestamp, version() as pg_version');
        await pool.end();
        
        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV,
            database: 'connected',
            database_timestamp: result.rows[0].timestamp,
            postgresql_version: result.rows[0].pg_version.split(' ')[0],
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '1.0.0'
        };

        res.status(200).json({
            success: true,
            message: 'Servicio funcionando correctamente',
            data: healthData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check failed:', error);
        
        const healthData = {
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV,
            database: 'disconnected',
            error: error.message,
            uptime: process.uptime(),
            version: '1.0.0'
        };

        res.status(503).json({
            success: false,
            message: 'Error en el servicio',
            data: healthData,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================================
// IMPORTAR Y CONFIGURAR RUTAS
// ====================================

// Rutas del cliente (frontend público)
const clienteRoutes = require('./routes/clientes');
app.use('/api/cliente', clienteRoutes);

// Ruta de información general de la API
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'TANCAT API - Sistema de Administración Complejo Deportivo',
        data: {
            version: '1.0.0',
            environment: NODE_ENV,
            endpoints: {
                health: '/api/health',
                cliente: {
                    sedes: '/api/cliente/sedes',
                    deportes: '/api/cliente/deportes',
                    canchas: '/api/cliente/canchas',
                    combinaciones: '/api/cliente/combinaciones-disponibles',
                    disponibilidad: '/api/cliente/consulta-disponibilidad',
                    torneos: '/api/cliente/torneos',
                    estadisticas: '/api/cliente/estadisticas'
                }
            },
            documentation: '/api/docs'
        },
        timestamp: new Date().toISOString()
    });
});

// Documentación básica de la API
app.get('/api/docs', (req, res) => {
    res.json({
        success: true,
        message: 'Documentación de la API TANCAT',
        data: {
            title: 'TANCAT API Documentation',
            version: '1.0.0',
            baseURL: `http://${HOST}:${PORT}/api`,
            endpoints: {
                'GET /health': 'Verificar estado del servicio',
                'GET /cliente/sedes': 'Obtener todas las sedes activas',
                'GET /cliente/sedes/:id': 'Obtener información de una sede específica',
                'GET /cliente/deportes': 'Obtener todos los deportes disponibles',
                'GET /cliente/deportes/:id': 'Obtener información de un deporte específico',
                'GET /cliente/canchas': 'Obtener canchas (filtrar por sede_id y/o deporte_id)',
                'GET /cliente/combinaciones-disponibles': 'Obtener combinaciones sede-deporte disponibles',
                'GET /cliente/consulta-disponibilidad': 'Consultar turnos disponibles (requiere sede_id, deporte_id, fecha)',
                'GET /cliente/torneos': 'Obtener torneos próximos y activos',
                'GET /cliente/estadisticas': 'Obtener estadísticas básicas del complejo'
            },
            examples: {
                'Consultar disponibilidad': `${req.protocol}://${req.get('host')}/api/cliente/consulta-disponibilidad?sede_id=1&deporte_id=1&fecha=2025-08-15`,
                'Obtener canchas por sede': `${req.protocol}://${req.get('host')}/api/cliente/canchas?sede_id=1`,
                'Obtener canchas por deporte': `${req.protocol}://${req.get('host')}/api/cliente/canchas?deporte_id=1`
            }
        },
        timestamp: new Date().toISOString()
    });
});

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================

// Manejar rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        data: null,
        timestamp: new Date().toISOString()
    });
});

// Manejar errores generales
app.use((error, req, res, next) => {
    console.error('Error no manejado:', error);
    
    // No enviar información sensible en producción
    const errorMessage = NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : error.message;
    
    res.status(error.status || 500).json({
        success: false,
        message: errorMessage,
        data: null,
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId
    });
});

// ====================================
// MANEJO DE PROCESOS
// ====================================

// Manejo de promesas rechazadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
    console.error('En promesa:', promise);
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
    console.error('El proceso se cerrará...');
    process.exit(1);
});

// Manejo de señales de cierre
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor...`);
    
    // Aquí puedes cerrar conexiones a base de datos, etc.
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ====================================
// EXPORTAR APP
// ====================================
module.exports = {
    app,
    PORT,
    HOST,
    NODE_ENV
};