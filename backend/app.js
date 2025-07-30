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

// Importar configuración de base de datos
const { injectDb, isHealthy } = require('./config/database');

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
            scriptSrc: ["'self'", "'unsafe-inline'"],
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

// CORS configurado para desarrollo y producción
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',')
            : [
                'http://localhost:3000', 
                'http://localhost:5173', 
                'http://127.0.0.1:5173',
                'http://localhost:5500', 
                'http://127.0.0.1:5500'
            ];
        
        // Permitir requests sin origin (ej: aplicaciones móviles, Postman)
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

// Rate Limiting para APIs
const apiLimiter = rateLimit({
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
        if (process.env.NODE_ENV === 'development' && 
            (req.path.startsWith('/api/docs') || req.path === '/api/health')) {
            return true;
        }
        return false;
    }
});

// Aplicar rate limiting solo a rutas API
app.use('/api/', apiLimiter);

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

// Inyectar conexión de base de datos en todas las rutas
app.use(injectDb);

// Trust proxy para aplicaciones detrás de proxy reverso
app.set('trust proxy', 1);

// ====================================
// SERVIR ARCHIVOS ESTÁTICOS (SPA)
// ====================================

// Servir archivos estáticos del frontend con MIME types correctos
app.use(express.static(path.join(__dirname, '../frontend'), {
    index: false, // No servir index.html automáticamente
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    setHeaders: (res, path) => {
        // Configurar MIME types correctos
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====================================
// RUTAS DE LA API
// ====================================

// Health Check
app.get('/api/health', async (req, res) => {
    const dbHealth = await isHealthy();
    
    res.json({
        status: dbHealth.healthy ? 'OK' : 'ERROR',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        database: dbHealth.healthy ? 'Connected' : 'Disconnected',
        dbDetails: dbHealth
    });
});

// Información del API
app.get('/api', (req, res) => {
    res.json({
        name: 'TANCAT API',
        version: '1.0.0',
        description: 'Sistema de administración para Complejo Deportivo TANCAT',
        endpoints: {
            auth: '/api/auth',
            cliente: '/api/cliente',
            admin: '/api/admin',
            reservas: '/api/reservas',
            torneos: '/api/torneos',
            inventario: '/api/inventario',
            ventas: '/api/ventas',
            reportes: '/api/reportes',
            health: '/api/health',
            docs: '/api/docs'
        },
        timestamp: new Date().toISOString()
    });
});

// Importar y usar rutas
try {
    // Rutas de autenticación (DEBE IR PRIMERA)
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Rutas de autenticación cargadas');
    
    // Rutas del cliente (públicas)
    const clienteRoutes = require('./routes/clientes');
    app.use('/api/cliente', clienteRoutes);
    console.log('✅ Rutas de cliente cargadas');
    
    // Rutas de administración (protegidas)
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Rutas de administración cargadas');
    
    // Rutas específicas de módulos
    try {
        const reservasRoutes = require('./routes/reservas');
        app.use('/api/reservas', reservasRoutes);
        console.log('✅ Rutas de reservas cargadas');
    } catch (err) {
        console.warn('⚠️ Rutas de reservas no disponibles:', err.message);
    }
    
    try {
        const torneosRoutes = require('./routes/torneos');
        app.use('/api/torneos', torneosRoutes);
        console.log('✅ Rutas de torneos cargadas');
    } catch (err) {
        console.warn('⚠️ Rutas de torneos no disponibles:', err.message);
    }
    
    try {
        const inventarioRoutes = require('./routes/inventario');
        app.use('/api/inventario', inventarioRoutes);
        console.log('✅ Rutas de inventario cargadas');
    } catch (err) {
        console.warn('⚠️ Rutas de inventario no disponibles:', err.message);
    }
    
    try {
        const ventasRoutes = require('./routes/ventas');
        app.use('/api/ventas', ventasRoutes);
        console.log('✅ Rutas de ventas cargadas');
    } catch (err) {
        console.warn('⚠️ Rutas de ventas no disponibles:', err.message);
    }
    
    try {
        const reportesRoutes = require('./routes/reportes');
        app.use('/api/reportes', reportesRoutes);
        console.log('✅ Rutas de reportes cargadas');
    } catch (err) {
        console.warn('⚠️ Rutas de reportes no disponibles:', err.message);
    }
    
} catch (error) {
    console.error('❌ Error crítico cargando rutas principales:', error.message);
}

// ====================================
// DOCUMENTACIÓN API (SWAGGER) - SOLO DESARROLLO
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
                ],
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT'
                        }
                    }
                }
            },
            apis: ['./routes/*.js', './controllers/*.js']
        };
        
        const specs = swaggerJsdoc(options);
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'TANCAT API Documentation'
        }));
        
        console.log('✅ Documentación Swagger disponible en /api/docs');
        
    } catch (error) {
        console.warn('⚠️ Swagger no disponible:', error.message);
    }
}

// ====================================
// SPA ROUTING - MANEJO DE RUTAS FRONTEND
// ====================================

// Manejar todas las rutas no-API como SPA
app.get('*', (req, res, next) => {
    // Si es una ruta de API que no existe, devolver 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: `Endpoint ${req.path} no encontrado`,
            error: 'ENDPOINT_NOT_FOUND',
            timestamp: new Date().toISOString()
        });
    }
    
    // Para todas las demás rutas, servir index.html (SPA)
    res.sendFile(path.join(__dirname, '../frontend/index.html'), (err) => {
        if (err) {
            console.error('❌ Error sirviendo index.html:', err);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: 'STATIC_FILE_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES GLOBAL
// ====================================
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
                message = 'El registro ya existe (valor duplicado)';
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
    
    // Error de JWT
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticación inválido',
            error: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
    
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticación expirado',
            error: 'EXPIRED_TOKEN',
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