/**
 * TANCAT - Sistema de Administración
 * Archivo: app.js
 * Descripción: Configuración principal de la aplicación Express con Neon Database
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

// CORS configurado para desarrollo y producción
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',').map(url => url.trim())
            : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
        
        // Permitir requests sin origin (ej: aplicaciones móviles, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS bloqueó origen: ${origin}`);
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
        // Saltar rate limiting en desarrollo para docs y health check
        if (process.env.NODE_ENV === 'development' && 
            (req.path.startsWith('/api/docs') || req.path === '/api/health')) {
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
// MIDDLEWARE DE CONEXIÓN A BASE DE DATOS
// ====================================

// Solo verificar conexión en desarrollo para evitar sobrecarga
if (process.env.NODE_ENV === 'development') {
    app.use('/api', async (req, res, next) => {
        // Solo verificar en rutas críticas para no sobrecargar
        if (req.method === 'GET' && req.path === '/health') {
            try {
                const { testNeonConnection } = require('./config/database');
                const isConnected = await testNeonConnection();
                if (!isConnected) {
                    console.warn('⚠️ Conexión a Neon inestable');
                }
            } catch (error) {
                console.error('❌ Error verificando conexión Neon:', error.message);
            }
        }
        next();
    });
}

// ====================================
// RUTAS DE LA API
// ====================================

// Health Check mejorado
app.get('/api/health', async (req, res) => {
    try {
        const { isHealthy, getPoolStats } = require('./utils/database');
        
        const dbHealthy = await isHealthy();
        const poolStats = getPoolStats();
        
        const healthStatus = {
            status: dbHealthy ? 'OK' : 'ERROR',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            version: '1.0.0',
            database: {
                connected: dbHealthy,
                provider: 'Neon PostgreSQL',
                pool: poolStats
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version
            }
        };
        
        const statusCode = dbHealthy ? 200 : 503;
        res.status(statusCode).json(healthStatus);
        
    } catch (error) {
        console.error('❌ Error en health check:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            message: error.message
        });
    }
});

// Información del API
app.get('/api', (req, res) => {
    res.json({
        name: 'TANCAT API',
        version: '1.0.0',
        description: 'Sistema de administración para Complejo Deportivo TANCAT',
        database: 'Neon PostgreSQL',
        endpoints: {
            client: '/api/cliente',
            admin: '/api/admin',
            auth: '/api/auth',
            docs: '/api/docs',
            health: '/api/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ====================================
// IMPORTAR Y CONFIGURAR RUTAS
// ====================================

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
    
    console.log('✅ Rutas principales cargadas exitosamente');
    
} catch (error) {
    console.warn('⚠️ Error al cargar algunas rutas:', error.message);
    console.log('💡 Algunas rutas pueden no estar disponibles hasta que se creen los archivos correspondientes');
}

// Intentar cargar rutas adicionales (pueden no existir aún)
const rutasOpcionales = [
    { path: '/api/torneos', file: './routes/torneos' },
    { path: '/api/inventario', file: './routes/inventario' },
    { path: '/api/reportes', file: './routes/reportes' },
    { path: '/api/ventas', file: './routes/ventas' }
];

rutasOpcionales.forEach(({ path, file }) => {
    try {
        const routes = require(file);
        app.use(path, routes);
        console.log(`✅ Ruta ${path} cargada`);
    } catch (error) {
        console.log(`⏳ Ruta ${path} no disponible (será implementada posteriormente)`);
    }
});

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
                    description: 'Sistema de administración para Complejo Deportivo TANCAT con Neon Database',
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
        console.warn('⚠️ Swagger no disponible (instalar swagger-jsdoc y swagger-ui-express):', error.message);
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
        suggestions: [
            'Verifica la URL',
            'Consulta la documentación en /api/docs',
            'Verifica el método HTTP utilizado'
        ],
        timestamp: new Date().toISOString()
    });
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    // Error de validación
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            error: error.message,
            details: error.details || null,
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
        try {
            const { handleDbError } = require('./utils/database');
            const dbError = handleDbError(error);
            
            return res.status(400).json({
                success: false,
                message: dbError.friendlyMessage,
                error: 'DATABASE_ERROR',
                code: error.code,
                details: process.env.NODE_ENV === 'development' ? dbError : null,
                timestamp: new Date().toISOString()
            });
        } catch (handlerError) {
            console.error('Error en handleDbError:', handlerError);
        }
    }
    
    // Error de conexión a base de datos
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            message: 'Servicio de base de datos no disponible',
            error: 'DATABASE_CONNECTION_ERROR',
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
// MANEJO GRACEFUL DE SHUTDOWN
// ====================================
process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM recibido, cerrando servidor gracefully...');
    try {
        const { closeConnections } = require('./config/database');
        await closeConnections();
    } catch (error) {
        console.error('Error cerrando conexiones:', error);
    }
});

process.on('SIGINT', async () => {
    console.log('🔄 SIGINT recibido, cerrando servidor gracefully...');
    try {
        const { closeConnections } = require('./config/database');
        await closeConnections();
    } catch (error) {
        console.error('Error cerrando conexiones:', error);
    }
});

// ====================================
// EXPORTAR APLICACIÓN
// ====================================
module.exports = app;