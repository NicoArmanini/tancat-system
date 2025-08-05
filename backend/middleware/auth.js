/**
 * TANCAT - Sistema de Administración
 * Archivo: middleware/auth.js
 * Descripción: Middleware de autenticación y autorización
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ====================================
// CONFIGURACIÓN
// ====================================
const JWT_SECRET = process.env.JWT_SECRET || 'tancat_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ====================================
// RATE LIMITING PARA AUTENTICACIÓN
// ====================================
const authAttempts = new Map();

const rateLimitAuth = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxAttempts = 5;
    
    if (!authAttempts.has(ip)) {
        authAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    const attempts = authAttempts.get(ip);
    
    if (now > attempts.resetTime) {
        authAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    if (attempts.count >= maxAttempts) {
        return res.status(429).json({
            success: false,
            message: 'Demasiados intentos de autenticación. Intenta en 15 minutos.',
            retryAfter: Math.ceil((attempts.resetTime - now) / 1000),
            timestamp: new Date().toISOString()
        });
    }
    
    attempts.count++;
    next();
};

// ====================================
// FUNCIONES DE AUTENTICACIÓN
// ====================================

/**
 * Autenticar usuario con credenciales
 */
const authenticateUser = async (db, email, password) => {
    try {
        // Buscar usuario
        const userQuery = `
            SELECT 
                e.id_empleado,
                e.nombre,
                e.apellido,
                e.email,
                e.dni,
                e.password_hash,
                e.activo,
                r.nombre as rol,
                r.permisos,
                s.nombre as sede_nombre
            FROM empleados e
            INNER JOIN roles r ON e.id_rol = r.id_rol
            LEFT JOIN sedes s ON e.id_sede = s.id_sede
            WHERE (e.email = $1 OR e.dni = $1) AND e.activo = true
        `;
        
        const result = await db.query(userQuery, [email]);
        
        if (result.rows.length === 0) {
            throw new Error('Usuario no encontrado o inactivo');
        }
        
        const user = result.rows[0];
        
        // Verificar contraseña
        let passwordValid = false;
        
        if (user.password_hash) {
            passwordValid = await bcrypt.compare(password, user.password_hash);
        } else {
            // Modo desarrollo - usuarios sin hash
            if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ Usuario ${user.email} sin hash - usando contraseña de desarrollo`);
                passwordValid = (password === 'admin123' || password === 'empleado123');
            }
        }
        
        if (!passwordValid) {
            throw new Error('Contraseña incorrecta');
        }
        
        // Generar token JWT
        const token = jwt.sign(
            {
                id: user.id_empleado,
                email: user.email,
                nombre: user.nombre,
                apellido: user.apellido,
                rol: user.rol,
                permisos: user.permisos || {}
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        return {
            success: true,
            token,
            user: {
                id: user.id_empleado,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol,
                sede: user.sede_nombre,
                permisos: user.permisos || {}
            }
        };
        
    } catch (error) {
        console.error('Error en autenticación:', error.message);
        throw new Error('Credenciales inválidas');
    }
};

/**
 * Middleware para verificar token JWT
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acceso requerido',
            error: 'NO_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Error verificando token:', error.message);
        
        let message = 'Token inválido';
        let errorCode = 'INVALID_TOKEN';
        
        if (error.name === 'TokenExpiredError') {
            message = 'Token expirado';
            errorCode = 'TOKEN_EXPIRED';
        } else if (error.name === 'JsonWebTokenError') {
            message = 'Token malformado';
            errorCode = 'MALFORMED_TOKEN';
        }
        
        return res.status(403).json({
            success: false,
            message,
            error: errorCode,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Middleware para verificar rol específico
 */
const requireRole = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado',
                error: 'NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
        }
        
        const userRole = req.user.rol;
        
        // Convertir a array si es string
        const allowedRoles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Permisos insuficientes para esta operación',
                error: 'INSUFFICIENT_PERMISSIONS',
                userRole,
                requiredRoles: allowedRoles,
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

/**
 * Middleware para verificar permiso específico
 */
const requirePermission = (permiso) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado',
                error: 'NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
        }
        
        const userPermisos = req.user.permisos || {};
        
        if (!userPermisos[permiso]) {
            return res.status(403).json({
                success: false,
                message: `Permiso requerido: ${permiso}`,
                error: 'PERMISSION_DENIED',
                requiredPermission: permiso,
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

/**
 * Generar hash de contraseña
 */
const hashPassword = async (password) => {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Verificar contraseña
 */
const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Generar nuevo token
 */
const generateToken = (userData) => {
    return jwt.sign(userData, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Renovar token existente
 */
const refreshToken = (oldToken) => {
    try {
        const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        
        // Crear nuevo token con los mismos datos
        const newTokenData = {
            id: decoded.id,
            email: decoded.email,
            nombre: decoded.nombre,
            apellido: decoded.apellido,
            rol: decoded.rol,
            permisos: decoded.permisos
        };
        
        return generateToken(newTokenData);
    } catch (error) {
        throw new Error('No se puede renovar el token');
    }
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Ignorar errores en autenticación opcional
            console.warn('Token opcional inválido:', error.message);
        }
    }
    
    next();
};

// ====================================
// LIMPIEZA PERIÓDICA DE RATE LIMITING
// ====================================
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of authAttempts.entries()) {
        if (now > data.resetTime) {
            authAttempts.delete(ip);
        }
    }
}, 5 * 60 * 1000); // Limpiar cada 5 minutos

// ====================================
// EXPORTAR FUNCIONES
// ====================================
module.exports = {
    // Funciones principales
    authenticateUser,
    authenticateToken,
    requireRole,
    requirePermission,
    optionalAuth,
    
    // Rate limiting
    rateLimitAuth,
    
    // Utilidades de contraseña
    hashPassword,
    verifyPassword,
    
    // Utilidades de token
    generateToken,
    refreshToken,
    
    // Constantes
    JWT_SECRET,
    JWT_EXPIRES_IN
};