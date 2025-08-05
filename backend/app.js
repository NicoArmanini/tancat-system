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
            : ['http://localhost:5173', 'http://127.0.0.1:5173'];
        
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

// ====================================
// IMPORTAR Y USAR RUTAS
// ====================================

// Función helper para cargar rutas de forma segura
function loadRoute(routePath, routeName) {
    try {
        const route = require(routePath);
        console.log(`✅ Ruta cargada: ${routeName}`);
        return route;
    } catch (error) {
        console.warn(`⚠️  No se pudo cargar ${routeName}: ${error.message}`);
        
        // Retornar un router básico que responda con mensaje de "no implementado"
        const express = require('express');
        const fallbackRouter = express.Router();
        
        fallbackRouter.all('*', (req, res) => {
            res.status(501).json({
                success: false,
                message: `${routeName} - Funcionalidad no implementada aún`,
                endpoint: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
        
        return fallbackRouter;
    }
}

// Cargar rutas principales (EXISTENTES)
const clienteRoutes = loadRoute('./routes/clientes', 'Cliente Routes');
app.use('/api/cliente', clienteRoutes);

const authRoutes = loadRoute('./routes/auth', 'Auth Routes');
app.use('/api/auth', authRoutes);

const adminRoutes = loadRoute('./routes/admin', 'Admin Routes');
app.use('/api/admin', adminRoutes);

const reservasRoutes = loadRoute('./routes/reservas', 'Reservas Routes');
app.use('/api/reservas', reservasRoutes);

// Cargar rutas secundarias (OPCIONALES)
const torneosRoutes = loadRoute('./routes/torneos', 'Torneos Routes');
app.use('/api/torneos', torneosRoutes);

const inventarioRoutes = loadRoute('./routes/inventario', 'Inventario Routes');
app.use('/api/inventario', inventarioRoutes);

const reportesRoutes = loadRoute('./routes/reportes', 'Reportes Routes');
app.use('/api/reportes', reportesRoutes);

// NOTA: ventas.js removido - no se carga

// ====================================
// DOCUMENTACIÓN API (SIN SWAGGER)
// ====================================
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'TANCAT API',
        version: '1.0.0',
        description: 'Sistema de administración para Complejo Deportivo TANCAT',
        endpoints: {
            health: '/api/health',
            sedes: '/api/cliente/sedes',
            deportes: '/api/cliente/deportes',
            disponibilidad: '/api/cliente/consulta-disponibilidad',
            auth: '/api/auth',
            admin: '/api/admin'
        },
        timestamp: new Date().toISOString()
    });
});

console.log('📖 Documentación básica disponible en /api/docs');

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        error: 'NOT_FOUND',
        availableEndpoints: [
            '/api/health',
            '/api/cliente/*',
            '/api/admin/*', 
            '/api/auth/*',
            '/api/reservas/*',
            '/api/torneos/*',
            '/api/inventario/*',
            '/api/reportes/*',
            '/api/docs'
        ],
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