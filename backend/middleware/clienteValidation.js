/**
 * TANCAT - Sistema de Administración
 * Archivo: clienteValidation.js
 * Descripción: Middleware de validación específico para operaciones del cliente
 */

const { body, query, param, validationResult } = require('express-validator');
const clienteService = require('../services/clienteService');

// ====================================
// VALIDADORES PERSONALIZADOS
// ====================================

/**
 * Validador personalizado para verificar que la sede existe y está activa
 */
const validarSedeExiste = async (sedeId) => {
    const sede = await clienteService.verificarSedeActiva(sedeId);
    if (!sede) {
        throw new Error('La sede seleccionada no existe o no está disponible');
    }
    return true;
};

/**
 * Validador personalizado para verificar que el deporte existe y está activo
 */
const validarDeporteExiste = async (deporteId) => {
    const deporte = await clienteService.verificarDeporteActivo(deporteId);
    if (!deporte) {
        throw new Error('El deporte seleccionado no existe o no está disponible');
    }
    return true;
};

/**
 * Validador personalizado para verificar combinación sede-deporte
 */
const validarCombinacionSedeDeporte = async (deporteId, { req }) => {
    const sedeId = req.body.sede_id || req.query.sede_id;
    
    if (!sedeId) {
        throw new Error('Se debe especificar una sede');
    }
    
    const combinaciones = await clienteService.obtenerCombinacionesSedeDeporte();
    const combinacionValida = combinaciones.some(
        c => c.id_sede == sedeId && c.id_deporte == deporteId
    );
    
    if (!combinacionValida) {
        throw new Error('La combinación de sede y deporte no está disponible');
    }
    
    return true;
};

/**
 * Validador para fecha de consulta
 */
const validarFechaConsulta = (fecha) => {
    // Verificar formato
    if (!clienteService.validarFormatoFecha(fecha)) {
        throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
    }
    
    // Verificar validez de la fecha
    const validacion = clienteService.verificarFechaValida(fecha);
    if (!validacion.valida) {
        throw new Error(validacion.mensaje);
    }
    
    return true;
};

// ====================================
// CONJUNTOS DE VALIDACIONES
// ====================================

/**
 * Validaciones para consulta de disponibilidad
 */
const validacionesConsultaDisponibilidad = [
    body('sede_id')
        .notEmpty()
        .withMessage('El ID de sede es requerido')
        .isInt({ min: 1 })
        .withMessage('El ID de sede debe ser un número entero positivo')
        .custom(validarSedeExiste),
    
    body('deporte_id')
        .notEmpty()
        .withMessage('El ID de deporte es requerido')
        .isInt({ min: 1 })
        .withMessage('El ID de deporte debe ser un número entero positivo')
        .custom(validarDeporteExiste)
        .custom(validarCombinacionSedeDeporte),
    
    body('fecha')
        .notEmpty()
        .withMessage('La fecha es requerida')
        .isISO8601({ strict: true })
        .withMessage('La fecha debe tener formato YYYY-MM-DD')
        .custom(validarFechaConsulta)
];

/**
 * Validaciones para consulta de canchas
 */
const validacionesConsultaCanchas = [
    query('sede_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El ID de sede debe ser un número entero positivo')
        .custom(async (value) => {
            if (value) {
                return await validarSedeExiste(value);
            }
            return true;
        }),
    
    query('deporte_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El ID de deporte debe ser un número entero positivo')
        .custom(async (value) => {
            if (value) {
                return await validarDeporteExiste(value);
            }
            return true;
        })
];

/**
 * Validaciones para consulta de torneo específico
 */
const validacionesTorneoEspecifico = [
    param('torneo_id')
        .isInt({ min: 1 })
        .withMessage('El ID del torneo debe ser un número entero positivo'),
];

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES DE VALIDACIÓN
// ====================================

/**
 * Middleware para manejar errores de validación
 */
const manejarErroresValidacion = (req, res, next) => {
    const errores = validationResult(req);
    
    if (!errores.isEmpty()) {
        const erroresFormateados = errores.array().map(error => ({
            campo: error.param || error.path,
            valor: error.value,
            mensaje: error.msg,
            ubicacion: error.location
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Errores de validación en los datos enviados',
            errors: erroresFormateados,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// ====================================
// MIDDLEWARE DE SANITIZACIÓN
// ====================================

/**
 * Sanitizar datos de entrada para consultas del cliente
 */
const sanitizarDatosCliente = (req, res, next) => {
    // Sanitizar números enteros
    ['sede_id', 'deporte_id', 'torneo_id'].forEach(campo => {
        if (req.body[campo]) {
            req.body[campo] = parseInt(req.body[campo], 10);
        }
        if (req.query[campo]) {
            req.query[campo] = parseInt(req.query[campo], 10);
        }
        if (req.params[campo]) {
            req.params[campo] = parseInt(req.params[campo], 10);
        }
    });
    
    // Sanitizar fechas
    if (req.body.fecha) {
        req.body.fecha = req.body.fecha.trim();
    }
    if (req.query.fecha) {
        req.query.fecha = req.query.fecha.trim();
    }
    
    // Sanitizar strings
    ['nombre', 'descripcion'].forEach(campo => {
        if (req.body[campo]) {
            req.body[campo] = req.body[campo].trim();
        }
        if (req.query[campo]) {
            req.query[campo] = req.query[campo].trim();
        }
    });
    
    next();
};

// ====================================
// MIDDLEWARE DE RATE LIMITING ESPECÍFICO
// ====================================

/**
 * Cache para rate limiting por IP
 */
const rateLimitCache = new Map();

/**
 * Rate limiting específico para consultas de disponibilidad
 * Permite máximo 10 consultas por minuto por IP
 */
const limitarConsultasDisponibilidad = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const ahora = Date.now();
    const ventanaTiempo = 60000; // 1 minuto
    const limiteConsultas = 10;
    
    if (!rateLimitCache.has(ip)) {
        rateLimitCache.set(ip, {
            consultas: 1,
            ultimaConsulta: ahora,
            ventanaInicio: ahora
        });
        return next();
    }
    
    const datosIP = rateLimitCache.get(ip);
    
    // Si ha pasado la ventana de tiempo, resetear
    if (ahora - datosIP.ventanaInicio > ventanaTiempo) {
        datosIP.consultas = 1;
        datosIP.ventanaInicio = ahora;
        datosIP.ultimaConsulta = ahora;
        return next();
    }
    
    // Incrementar contador
    datosIP.consultas++;
    datosIP.ultimaConsulta = ahora;
    
    // Verificar límite
    if (datosIP.consultas > limiteConsultas) {
        return res.status(429).json({
            success: false,
            message: 'Demasiadas consultas. Intente nuevamente en un minuto.',
            retryAfter: Math.ceil((ventanaTiempo - (ahora - datosIP.ventanaInicio)) / 1000)
        });
    }
    
    next();
};

// ====================================
// MIDDLEWARE DE LOGGING
// ====================================

/**
 * Logging específico para operaciones del cliente
 */
const logearOperacionCliente = (operacion) => {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        
        console.log(`[CLIENTE] ${operacion} - IP: ${ip} - ${new Date().toISOString()}`);
        
        // Log adicional para consultas de disponibilidad
        if (operacion === 'CONSULTA_DISPONIBILIDAD') {
            const { sede_id, deporte_id, fecha } = req.body;
            console.log(`[CLIENTE] Consulta: Sede ${sede_id}, Deporte ${deporte_id}, Fecha ${fecha}`);
        }
        
        next();
    };
};

// ====================================
// MIDDLEWARE DE VALIDACIÓN DE HORARIOS
// ====================================

/**
 * Validar que la consulta se haga en horarios apropiados
 */
const validarHorarioConsulta = async (req, res, next) => {
    try {
        const { sede_id, fecha } = req.body;
        
        if (!sede_id || !fecha) {
            return next();
        }
        
        const horarios = await clienteService.obtenerHorariosSede(sede_id);
        
        if (!horarios) {
            return next();
        }
        
        // Obtener día de la semana de la fecha consultada
        const nombreDia = clienteService.obtenerNombreDia(fecha);
        
        // Verificar si la sede opera ese día (lógica simplificada)
        const diasFuncionamiento = horarios.dias_funcionamiento || '';
        
        // Si es domingo y la sede menciona "domingo cerrado"
        if (nombreDia === 'Domingo' && diasFuncionamiento.toLowerCase().includes('domingo cerrado')) {
            return res.status(400).json({
                success: false,
                message: `La sede no opera los domingos`,
                horarios: clienteService.formatearHorarios(
                    horarios.horario_apertura,
                    horarios.horario_cierre,
                    horarios.dias_funcionamiento
                )
            });
        }
        
        next();
        
    } catch (error) {
        console.error('Error al validar horario de consulta:', error);
        next(); // Continuar en caso de error, no bloquear la operación
    }
};

// ====================================
// LIMPIEZA DE CACHE
// ====================================

/**
 * Limpiar cache de rate limiting periódicamente
 */
setInterval(() => {
    const ahora = Date.now();
    const tiempoExpiracion = 300000; // 5 minutos
    
    for (const [ip, datos] of rateLimitCache.entries()) {
        if (ahora - datos.ultimaConsulta > tiempoExpiracion) {
            rateLimitCache.delete(ip);
        }
    }
}, 60000); // Ejecutar cada minuto

// ====================================
// EXPORTAR MIDDLEWARES
// ====================================
module.exports = {
    // Validaciones principales
    validacionesConsultaDisponibilidad,
    validacionesConsultaCanchas,
    validacionesTorneoEspecifico,
    
    // Middleware de manejo
    manejarErroresValidacion,
    sanitizarDatosCliente,
    
    // Rate limiting
    limitarConsultasDisponibilidad,
    
    // Logging
    logearOperacionCliente,
    
    // Validaciones específicas
    validarHorarioConsulta,
    
    // Validadores individuales (para uso directo)
    validarSedeExiste,
    validarDeporteExiste,
    validarCombinacionSedeDeporte,
    validarFechaConsulta
};