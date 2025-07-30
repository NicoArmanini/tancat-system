/**
 * TANCAT - Sistema de Administración
 * Archivo: routes/auth.js
 * Descripción: Rutas de autenticación
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { injectDb } = require('../config/database');
const { 
    authenticateUser, 
    refreshToken, 
    authenticateToken,
    rateLimitAuth 
} = require('../middleware/auth');

// Aplicar middleware de base de datos
router.use(injectDb);

// ====================================
// VALIDADORES
// ====================================
const loginValidators = [
    body('email')
        .notEmpty()
        .withMessage('Email o usuario es requerido')
        .trim(),
    body('password')
        .isLength({ min: 4 })
        .withMessage('La contraseña debe tener al menos 4 caracteres')
];

// ====================================
// RUTAS DE AUTENTICACIÓN
// ====================================

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
router.post('/login', rateLimitAuth, loginValidators, async (req, res) => {
    try {
        // Verificar errores de validación
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array(),
                timestamp: new Date().toISOString()
            });
        }

        const { email, password, rememberMe = false } = req.body;

        // Autenticar usuario
        const authResult = await authenticateUser(req.db, email, password);

        // Log de inicio de sesión exitoso
        console.log(`✅ Login exitoso: ${authResult.user.email} (${authResult.user.role})`);

        // Registrar en base de datos (opcional)
        try {
            await req.db.query(`
                INSERT INTO login_logs (id_empleado, ip_address, user_agent, success, timestamp)
                VALUES ($1, $2, $3, true, NOW())
            `, [
                authResult.user.id,
                req.ip,
                req.get('User-Agent') || 'Unknown'
            ]);
        } catch (logError) {
            console.warn('⚠️ No se pudo registrar el log de login:', logError.message);
        }

        // Respuesta exitosa
        res.json({
            success: true,
            data: {
                token: authResult.token,
                user: authResult.user,
                expiresIn: '24h',
                rememberMe: rememberMe
            },
            message: 'Inicio de sesión exitoso',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error en login:', error.message);

        // Log de intento fallido
        try {
            await req.db.query(`
                INSERT INTO login_logs (ip_address, user_agent, success, error_message, timestamp)
                VALUES ($1, $2, false, $3, NOW())
            `, [
                req.ip,
                req.get('User-Agent') || 'Unknown',
                error.message
            ]);
        } catch (logError) {
            console.warn('⚠️ No se pudo registrar el log de error:', logError.message);
        }

        res.status(401).json({
            success: false,
            message: 'Credenciales inválidas',
            error: 'INVALID_CREDENTIALS',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Log de cierre de sesión
        console.log(`🚪 Logout: ${req.user.email}`);

        // Registrar logout en base de datos (opcional)
        try {
            await req.db.query(`
                INSERT INTO logout_logs (id_empleado, ip_address, timestamp)
                VALUES ($1, $2, NOW())
            `, [req.user.id, req.ip]);
        } catch (logError) {
            console.warn('⚠️ No se pudo registrar el log de logout:', logError.message);
        }

        res.json({
            success: true,
            message: 'Sesión cerrada correctamente',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error en logout:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error al cerrar sesión',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/verify
 * Verificar token de autenticación
 */
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        // Verificar que el usuario sigue activo en la base de datos
        const userQuery = `
            SELECT 
                e.id_empleado,
                e.activo,
                r.nombre as role,
                s.nombre as sede_nombre
            FROM empleados e
            INNER JOIN roles r ON e.id_rol = r.id_rol
            LEFT JOIN sedes s ON e.id_sede = s.id_sede
            WHERE e.id_empleado = $1
        `;

        const result = await req.db.query(userQuery, [req.user.id]);

        if (result.rows.length === 0 || !result.rows[0].activo) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado o inactivo',
                error: 'USER_INACTIVE',
                timestamp: new Date().toISOString()
            });
        }

        const userData = result.rows[0];

        res.json({
            success: true,
            data: {
                valid: true,
                user: {
                    id: req.user.id,
                    nombre: req.user.nombre,
                    apellido: req.user.apellido,
                    email: req.user.email,
                    role: userData.role,
                    sede: userData.sede_nombre,
                    activo: userData.activo
                }
            },
            message: 'Token válido',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error verificando token:', error.message);
        
        res.status(401).json({
            success: false,
            message: 'Token inválido',
            error: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/refresh
 * Renovar token de autenticación
 */
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const newToken = refreshToken(req.headers.authorization.split(' ')[1]);

        res.json({
            success: true,
            data: {
                token: newToken,
                expiresIn: '24h'
            },
            message: 'Token renovado correctamente',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error renovando token:', error.message);
        
        res.status(401).json({
            success: false,
            message: 'No se pudo renovar el token',
            error: 'REFRESH_FAILED',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/profile
 * Obtener perfil del usuario autenticado
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const profileQuery = `
            SELECT 
                e.id_empleado,
                e.nombre,
                e.apellido,
                e.email,
                e.telefono,
                e.fecha_ingreso,
                e.activo,
                r.nombre as role,
                r.descripcion as role_descripcion,
                s.nombre as sede_nombre,
                s.direccion as sede_direccion
            FROM empleados e
            INNER JOIN roles r ON e.id_rol = r.id_rol
            LEFT JOIN sedes s ON e.id_sede = s.id_sede
            WHERE e.id_empleado = $1
        `;

        const result = await req.db.query(profileQuery, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Perfil de usuario no encontrado',
                timestamp: new Date().toISOString()
            });
        }

        const profile = result.rows[0];

        res.json({
            success: true,
            data: {
                id: profile.id_empleado,
                nombre: profile.nombre,
                apellido: profile.apellido,
                email: profile.email,
                telefono: profile.telefono,
                fechaIngreso: profile.fecha_ingreso,
                activo: profile.activo,
                role: {
                    nombre: profile.role,
                    descripcion: profile.role_descripcion
                },
                sede: profile.sede_nombre ? {
                    nombre: profile.sede_nombre,
                    direccion: profile.sede_direccion
                } : null
            },
            message: 'Perfil obtenido correctamente',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error obteniendo perfil:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/permissions
 * Obtener permisos del usuario autenticado
 */
router.get('/permissions', authenticateToken, async (req, res) => {
    try {
        const permissionsQuery = `
            SELECT r.permisos
            FROM empleados e
            INNER JOIN roles r ON e.id_rol = r.id_rol
            WHERE e.id_empleado = $1
        `;

        const result = await req.db.query(permissionsQuery, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Permisos no encontrados',
                timestamp: new Date().toISOString()
            });
        }

        const permisos = result.rows[0].permisos || {};

        res.json({
            success: true,
            data: {
                permissions: permisos,
                role: req.user.role
            },
            message: 'Permisos obtenidos correctamente',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error obteniendo permisos:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;