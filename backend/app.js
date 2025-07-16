/**
 * TANCAT - Sistema de Administración
 * Archivo: app.js
 * Descripción: Configuración principal de la aplicación Express
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ====================================
// INICIALIZACIÓN DE EXPRESS
// ====================================
const app = express();

// ====================================
// MIDDLEWARES DE SEGURIDAD
// ====================================

// Helmet para headers de seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];
        
        // Permitir requests sin origin (ej: aplicaciones móviles)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Saltar rate limiting en desarrollo para ciertas rutas
        if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api/docs')) {
            return true;
        }
        return false;
    }
});

app.use('/api/', limiter);

// ====================================
// MIDDLEWARES DE APLICACIÓN
// ====================================

// Compresión de respuestas
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Parser de JSON y URL encoded
app.use(express.json({ 
    limit: '10mb',
    strict: true
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Trust proxy para aplicaciones detrás de proxy reverso
app.set('trust proxy', 1);

// ====================================
// RUTAS DE LA API
// ====================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        database: 'Connected' // TODO: verificar conexión real
    });
});

// Información del API
app.get('/api', (req, res) => {
    res.json({
        name: 'TANCAT API',
        version: '1.0.0',
        description: 'Sistema de administración para Complejo Deportivo TANCAT',
        endpoints: {
            client: '/api/cliente',
            admin: '/api/admin',
            auth: '/api/auth',
            docs: '/api/docs'
        },
        timestamp: new Date().toISOString()
    });
});

// Importar y usar rutas
try {
    // Rutas del cliente (públicas)
    const clienteRoutes = require('./routes/clientes');
    app.use('/api/cliente', clienteRoutes);
    
    // Rutas de autenticación
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    
    // Rutas de administración (protegidas)
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    
    // Rutas de reservas
    const reservasRoutes = require('./routes/reservas');
    app.use('/api/reservas', reservasRoutes);
    
    // Rutas de torneos
    const torneosRoutes = require('./routes/torneos');
    app.use('/api/torneos', torneosRoutes);
    
    // Rutas de inventario
    const inventarioRoutes = require('./routes/inventario');
    app.use('/api/inventario', inventarioRoutes);
    
    // Rutas de reportes
    const reportesRoutes = require('./routes/reportes');
    app.use('/api/reportes', reportesRoutes);
    
    // Rutas de ventas
    const ventasRoutes = require('./routes/ventas');
    app.use('/api/ventas', ventasRoutes);
    
    console.log('✅ Rutas cargadas exitosamente');
    
} catch (error) {
    console.warn('⚠️  Error al cargar algunas rutas:', error.message);
    console.log('💡 Algunas rutas pueden no estar disponibles hasta que se creen los archivos correspondientes');
}

// ====================================
// DOCUMENTACIÓN API (SWAGGER)
// ====================================
if (process.env.NODE_ENV === 'development') {
    try {
        const swaggerJsdoc = require('swagger-jsdoc');
        const swaggerUi = require('swagger-ui-express');
        
        const options = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: 'TANCAT API',
                    version: '1.0.0',
                    description: 'Sistema de administración para Complejo Deportivo TANCAT',
                    contact: {
                        name: 'TANCAT Development Team',
                        email: 'dev@tancat.com'
                    }
                },
                servers: [
                    {
                        url: `http://localhost:${process.env.PORT || 3000}`,
                        description: 'Servidor de desarrollo'
                    }
                ]
            },
            apis: ['./routes/*.js', './controllers/*.js']
        };
        
        const specs = swaggerJsdoc(options);
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }'
        }));
        
        console.log('✅ Documentación Swagger disponible en /api/docs');
        
    } catch (error) {
        console.warn('⚠️  Swagger no disponible:', error.message);
    }
}

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString()
    });
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', error);
    
    // Error de validación
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    // Error de CORS
    if (error.message && error.message.includes('CORS')) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado por CORS',
            error: 'CORS_ERROR',
            timestamp: new Date().toISOString()
        });
    }
    
    // Error de rate limiting
    if (error.status === 429) {
        return res.status(429).json({
            success: false,
            message: 'Demasiadas solicitudes',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: error.retryAfter,
            timestamp: new Date().toISOString()
        });
    }
    
    // Error de base de datos PostgreSQL
    if (error.code && error.code.startsWith('23')) {
        let message = 'Error de base de datos';
        
        switch (error.code) {
            case '23505':
                message = 'El registro ya existe (duplicado)';
                break;
            case '23503':
                message = 'Referencia inválida en los datos';
                break;
            case '23502':
                message = 'Campo requerido faltante';
                break;
            case '23514':
                message = 'Violación de restricción de datos';
                break;
        }
        
        return res.status(400).json({
            success: false,
            message: message,
            error: 'DATABASE_ERROR',
            code: error.code,
            timestamp: new Date().toISOString()
        });
    }
    
    // Error genérico del servidor
    const statusCode = error.status || error.statusCode || 500;
    
    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Error interno del servidor' : error.message,
        error: process.env.NODE_ENV === 'development' ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
    });
});

// ====================================
// EXPORTAR APLICACIÓN
// ====================================
module.exports = app;