/**
 * TANCAT - Sistema de Administración
 * Archivo: server.js
 * Descripción: Punto de entrada principal del servidor con Neon Database
 */

const app = require('./app');
const { testNeonConnection, closeConnections } = require('./config/database');

// ====================================
// CONFIGURACIÓN DEL SERVIDOR
// ====================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====================================
// VERIFICACIÓN DE VARIABLES DE ENTORNO
// ====================================
function verificarVariablesEntorno() {
    const variablesRequeridas = ['DATABASE_URL'];
    const variablesFaltantes = variablesRequeridas.filter(variable => !process.env[variable]);
    
    if (variablesFaltantes.length > 0) {
        console.error('❌ Variables de entorno faltantes:', variablesFaltantes);
        console.log('💡 Asegúrate de configurar las siguientes variables en tu archivo .env:');
        variablesFaltantes.forEach(variable => {
            if (variable === 'DATABASE_URL') {
                console.log(`   ${variable}=postgresql://usuario:password@host/database?sslmode=require`);
            } else {
                console.log(`   ${variable}=valor`);
            }
        });
        return false;
    }
    
    return true;
}

// ====================================
// VERIFICACIÓN DE CONEXIÓN A NEON
// ====================================
async function verificarConexionNeon() {
    try {
        console.log('🔍 Verificando conexión a Neon Database...');
        
        const conexionExitosa = await testNeonConnection();
        
        if (conexionExitosa) {
            console.log('✅ Conexión a Neon Database establecida correctamente');
            return true;
        } else {
            console.error('❌ No se pudo establecer conexión con Neon Database');
            
            if (NODE_ENV === 'development') {
                console.log('\n📋 Verificaciones sugeridas:');
                console.log('   1. Verificar DATABASE_URL en archivo .env');
                console.log('   2. Comprobar que el proyecto de Neon esté activo');
                console.log('   3. Verificar credenciales de la base de datos');
                console.log('   4. Comprobar conectividad a internet\n');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Error al verificar conexión Neon:', error.message);
        return false;
    }
}

// ====================================
// VERIFICACIÓN DE ESTRUCTURA DE BD
// ====================================
async function verificarEstructuraBD() {
    try {
        const { query } = require('./utils/database');
        
        // Verificar que existan las tablas principales
        const tablasRequeridas = [
            'sedes', 'deportes', 'canchas', 'turnos', 
            'clientes', 'empleados', 'reservas', 'productos', 'torneos'
        ];
        
        const result = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name = ANY($1)
        `, [tablasRequeridas]);
        
        const tablasExistentes = result.rows.map(row => row.table_name);
        const tablasFaltantes = tablasRequeridas.filter(tabla => !tablasExistentes.includes(tabla));
        
        if (tablasFaltantes.length > 0) {
            console.warn('⚠️  Tablas faltantes en Neon Database:', tablasFaltantes);
            console.log('💡 Ejecuta el script SQL de estructura en tu consola de Neon');
            console.log('🔗 Puedes encontrar el script en: tancat_database_structure.sql');
        } else {
            console.log('✅ Estructura de base de datos verificada en Neon');
        }
        
        // Verificar datos básicos
        await verificarDatosBasicos();
        
        return tablasFaltantes.length === 0;
    } catch (error) {
        console.error('❌ Error al verificar estructura de BD:', error.message);
        return false;
    }
}

// ====================================
// VERIFICACIÓN DE DATOS BÁSICOS
// ====================================
async function verificarDatosBasicos() {
    try {
        const { query } = require('./utils/database');
        
        // Verificar si hay datos básicos
        const queries = [
            { name: 'sedes', query: 'SELECT COUNT(*) as count FROM sedes WHERE activo = true' },
            { name: 'deportes', query: 'SELECT COUNT(*) as count FROM deportes WHERE activo = true' },
            { name: 'roles', query: 'SELECT COUNT(*) as count FROM roles' }
        ];
        
        for (const { name, query: queryText } of queries) {
            try {
                const result = await query(queryText);
                const count = parseInt(result.rows[0].count);
                
                if (count === 0) {
                    console.warn(`⚠️  Tabla ${name} está vacía. Considera insertar datos iniciales.`);
                } else {
                    console.log(`✅ Tabla ${name}: ${count} registro(s) encontrado(s)`);
                }
            } catch (error) {
                console.warn(`⚠️  No se pudo verificar tabla ${name}:`, error.message);
            }
        }
    } catch (error) {
        console.warn('⚠️  Error al verificar datos básicos:', error.message);
    }
}

// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function iniciarServidor() {
    try {
        console.log('🚀 Iniciando servidor TANCAT...\n');
        
        // 1. Verificar variables de entorno
        if (!verificarVariablesEntorno()) {
            process.exit(1);
        }
        
        // 2. Verificar conexión a Neon Database
        const conexionDB = await verificarConexionNeon();
        
        if (!conexionDB) {
            if (NODE_ENV === 'production') {
                console.error('❌ No se puede iniciar el servidor sin conexión a la base de datos');
                process.exit(1);
            } else {
                console.log('⚠️  Iniciando en modo degradado para desarrollo...');
            }
        }
        
        // 3. Verificar estructura de base de datos
        if (conexionDB) {
            await verificarEstructuraBD();
        }
        
        // 4. Iniciar servidor HTTP
        const server = app.listen(PORT, HOST, () => {
            console.log('\n🎉 Servidor TANCAT iniciado exitosamente!');
            console.log(`📍 URL: http://${HOST}:${PORT}`);
            console.log(`🌍 Entorno: ${NODE_ENV}`);
            console.log(`🗄️  Base de datos: Neon PostgreSQL`);
            console.log(`📅 Fecha: ${new Date().toLocaleString('es-AR', { 
                timeZone: 'America/Argentina/Cordoba' 
            })}`);
            
            // URLs útiles para desarrollo
            if (NODE_ENV === 'development') {
                console.log('\n📋 URLs de desarrollo:');
                console.log(`   🌐 Frontend: http://${HOST}:5173`);
                console.log(`   📚 API Docs: http://${HOST}:${PORT}/api/docs`);
                console.log(`   ❤️  Health Check: http://${HOST}:${PORT}/api/health`);
                console.log(`   👥 Cliente API: http://${HOST}:${PORT}/api/cliente/sedes`);
                console.log(`   🔧 Admin API: http://${HOST}:${PORT}/api/admin/dashboard\n`);
                
                console.log('💡 Comandos útiles:');
                console.log('   Para frontend: cd frontend && npm run dev');
                console.log('   Para logs: tail -f logs/tancat.log');
                console.log('   Para detener: Ctrl+C\n');
            }
        });
        
        // Configurar timeout del servidor
        server.timeout = 30000; // 30 segundos
        
        // Manejo de errores del servidor
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Puerto ${PORT} ya está en uso`);
                console.log('💡 Soluciones:');
                console.log(`   1. Cambiar el puerto en .env (PORT=${PORT + 1})`);
                console.log(`   2. Cerrar el proceso que usa el puerto ${PORT}`);
                console.log(`   3. Usar: lsof -ti:${PORT} | xargs kill -9`);
            } else if (error.code === 'EACCES') {
                console.error(`❌ Permisos insuficientes para usar puerto ${PORT}`);
                console.log('💡 Usa un puerto mayor a 1024 o ejecuta con sudo');
            } else {
                console.error('❌ Error del servidor:', error.message);
            }
            process.exit(1);
        });
        
        // Manejo de cierre graceful
        process.on('SIGTERM', () => cerrarServidor(server));
        process.on('SIGINT', () => cerrarServidor(server));
        
        return server;
        
    } catch (error) {
        console.error('❌ Error fatal al iniciar servidor:', error.message);
        if (NODE_ENV === 'development') {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// ====================================
// CIERRE GRACEFUL DEL SERVIDOR
// ====================================
async function cerrarServidor(server) {
    console.log('\n🔄 Cerrando servidor gracefully...');
    
    try {
        // 1. Dejar de aceptar nuevas conexiones
        server.close(() => {
            console.log('✅ Servidor HTTP cerrado');
        });
        
        // 2. Cerrar conexiones de base de datos
        await closeConnections();
        
        // 3. Dar tiempo para que las operaciones pendientes terminen
        setTimeout(() => {
            console.log('👋 Servidor TANCAT cerrado exitosamente');
            process.exit(0);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error al cerrar servidor:', error.message);
        process.exit(1);
    }
}

// ====================================
// MANEJO DE ERRORES NO CAPTURADOS
// ====================================
process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    console.error('Stack trace:', error.stack);
    
    // En producción, reiniciar el proceso
    if (NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada no manejada:', reason);
    console.error('En:', promise);
    
    // En producción, reiniciar el proceso
    if (NODE_ENV === 'production') {
        process.exit(1);
    }
});

// ====================================
// MANEJO DE MEMORIA
// ====================================
if (NODE_ENV === 'development') {
    // Monitorear uso de memoria cada 30 segundos
    setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
        };
        
        if (memoryMB.heapUsed > 100) { // Alert si usa más de 100MB
            console.log(`📊 Memoria: ${memoryMB.heapUsed}MB usados de ${memoryMB.heapTotal}MB`);
        }
    }, 30000);
}

// ====================================
// INICIAR SERVIDOR
// ====================================
if (require.main === module) {
    iniciarServidor();
}

module.exports = { 
    iniciarServidor, 
    verificarConexionNeon, 
    verificarEstructuraBD,
    cerrarServidor 
};