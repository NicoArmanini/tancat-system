/**
 * TANCAT - Sistema de Administración
 * Archivo: middleware/auth.js
 * Descripción: Middleware de autenticación JWT
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ====================================
// CONFIGURACIÓN JWT
// ====================================
const JWT_SECRET = process.env.JWT_SECRET || 'tancat_super_secret_key_cambiar_en_produccion';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// ====================================
// FUNCIONES DE TOKEN
// ====================================

/**
 * Generar token JWT
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRE,
        issuer: 'tancat-system',
        audience: 'tancat-users'
    });
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'tancat-system',
            audience: 'tancat-users'
        });
    } catch (error) {
        throw new Error('Token inválido');
    }
}

/**
 * Generar hash de contraseña
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verificar contraseña
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// ====================================
// MIDDLEWARE DE AUTENTICACIÓN
// ====================================

/**
 * Middleware para verificar token JWT
 */
function authenticateToken(req, res, next) {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acceso requerido',
            error: 'MISSING_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token inválido o expirado',
            error: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;
        } catch (error) {
            // No hacer nada, continuar sin usuario
            req.user = null;
        }
    } else {
        req.user = null;
    }
    
    next();
}

/**
 * Middleware para verificar roles específicos
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida',
                error: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString()
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Permisos insuficientes',
                error: 'INSUFFICIENT_PERMISSIONS',
                requiredRoles: roles,
                userRole: req.user.role,
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
}

/**
 * Middleware para verificar que el usuario esté activo
 */
function requireActiveUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida',
            error: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString()
        });
    }
    
    if (!req.user.activo) {
        return res.status(403).json({
            success: false,
            message: 'Usuario inactivo',
            error: 'USER_INACTIVE',
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

// ====================================
// FUNCIONES DE AUTENTICACIÓN
// ====================================

/**
 * Autenticar usuario con email/username y password
 */
async function authenticateUser(db, identifier, password) {
    try {
        // Buscar usuario por email o username
        const userQuery = `
            SELECT 
                e.id_empleado as id,
                e.nombre,
                e.apellido,
                e.email,
                e.password_hash,
                e.activo,
                r.nombre as role,
                s.nombre as sede_nombre,
                s.id_sede
            FROM empleados e
            INNER JOIN roles r ON e.id_rol = r.id_rol
            LEFT JOIN sedes s ON e.id_sede = s.id_sede
            WHERE (e.email = $1 OR e.username = $1) AND e.activo = true
        `;
        
        const result = await db.query(userQuery, [identifier]);
        
        if (result.rows.length === 0) {
            throw new Error('Usuario no encontrado o inactivo');
        }
        
        const user = result.rows[0];
        
        // Verificar contraseña
        const isValidPassword = await verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
            throw new Error('Contraseña incorrecta');
        }
        
        // Generar token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            nombre: user.nombre,
            apellido: user.apellido,
            sede_id: user.id_sede,
            sede_nombre: user.sede_nombre,
            activo: user.activo
        };
        
        const token = generateToken(tokenPayload);
        
        return {
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                role: user.role,
                sede: user.sede_nombre,
                sede_id: user.id_sede
            }
        };
        
    } catch (error) {
        throw new Error(`Error de autenticación: ${error.message}`);
    }
}

/**
 * Refrescar token JWT
 */
function refreshToken(oldToken) {
    try {
        const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        
        // Remover campos de tiempo del payload original
        const { iat, exp, ...payload } = decoded;
        
        return generateToken(payload);
    } catch (error) {
        throw new Error('No se puede refrescar el token');
    }
}

/**
 * Middleware de rate limiting para autenticación
 */
const loginAttempts = new Map();

function rateLimitAuth(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxAttempts = 5;
    
    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    const attempts = loginAttempts.get(ip);
    
    if (now > attempts.resetTime) {
        // Reset window
        loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    if (attempts.count >= maxAttempts) {
        return res.status(429).json({
            success: false,
            message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((attempts.resetTime - now) / 1000),
            timestamp: new Date().toISOString()
        });
    }
    
    attempts.count++;
    next();
}

// Limpiar cache de intentos cada hora
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now > attempts.resetTime) {
            loginAttempts.delete(ip);
        }
    }
}, 60 * 60 * 1000);

// ====================================
// EXPORTAR MÓDULO
// ====================================
module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    verifyPassword,
    authenticateToken,
    optionalAuth,
    requireRole,
    requireActiveUser,
    authenticateUser,
    refreshToken,
    rateLimitAuth
};