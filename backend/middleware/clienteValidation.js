/**
 * TANCAT - Sistema de Administración
 * Archivo: middleware/validation/clienteValidation.js
 * Descripción: Middleware de validación simple para cliente
 */

// Rate limiting cache
const rateLimitCache = new Map();

const limitarConsultasDisponibilidad = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const ahora = Date.now();
    const ventanaTiempo = 60000; // 1 minuto
    const limiteConsultas = 20; // 20 consultas por minuto
    
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
            retryAfter: Math.ceil((ventanaTiempo - (ahora - datosIP.ventanaInicio)) / 1000),
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// Validación básica para consulta de disponibilidad
const validarConsultaDisponibilidad = (req, res, next) => {
    const { sede_id, deporte_id, fecha } = req.body;
    const errores = [];
    
    if (!sede_id || isNaN(parseInt(sede_id))) {
        errores.push('sede_id debe ser un número válido');
    }
    
    if (!deporte_id || isNaN(parseInt(deporte_id))) {
        errores.push('deporte_id debe ser un número válido');
    }
    
    if (!fecha) {
        errores.push('fecha es requerida');
    } else {
        const fechaConsulta = new Date(fecha + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (isNaN(fechaConsulta.getTime())) {
            errores.push('fecha debe tener formato YYYY-MM-DD');
        } else if (fechaConsulta < hoy) {
            errores.push('fecha no puede ser anterior a hoy');
        }
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: errores,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// Limpiar cache periódicamente
setInterval(() => {
    const ahora = Date.now();
    const tiempoExpiracion = 300000; // 5 minutos
    
    for (const [ip, datos] of rateLimitCache.entries()) {
        if (ahora - datos.ultimaConsulta > tiempoExpiracion) {
            rateLimitCache.delete(ip);
        }
    }
}, 60000);

module.exports = {
    validarConsultaDisponibilidad,
    limitarConsultasDisponibilidad
};