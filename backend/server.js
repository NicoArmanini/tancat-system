/**
 * TANCAT - Sistema de Administración
 * Archivo: server.js
 * Descripción: Punto de entrada principal del servidor CORREGIDO
 */

const app = require('./app');
const { initializeDatabase, closeConnections } = require('./config/database');

// ====================================
// CONFIGURACIÓN DEL SERVIDOR
// ====================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function iniciarServidor() {
    try {
        console.log('🚀 Iniciando servidor TANCAT...\n');
        
        // Verificar e inicializar base de datos
        console.log('🔍 Verificando conexión a base de datos...');
        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            if (NODE_ENV === 'development') {
                console.log('⚠️ Iniciando en modo degradado (sin base de datos)...');
                console.log('💡 El sistema funcionará parcialmente para desarrollo');
            } else {
                console.error('❌ No se puede iniciar en producción sin base de datos');
                process.exit(1);
            }
        }
        
        // Iniciar servidor HTTP
        const server = app.listen(PORT, HOST, () => {
            console.log('\n🎉 Servidor TANCAT iniciado exitosamente!');
            console.log(`📍 URL: http://${HOST}:${PORT}`);
            console.log(`🌍 Entorno: ${NODE_ENV}`);
            console.log(`📅 Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' })}`);
            
            // URLs útiles para desarrollo
            console.log('\n📋 URLs disponibles:');
            console.log(`   🏠 Aplicación: http://${HOST}:${PORT}`);
            console.log(`   🔐 Login: http://${HOST}:${PORT}/`);
            console.log(`   📊 Dashboard: http://${HOST}:${PORT}/dashboard`);
            console.log(`   🔧 API Health: http://${HOST}:${PORT}/api/health`);
            
            if (NODE_ENV === 'development') {
                console.log(`   🧪 API Test: http://${HOST}:${PORT}/api`);
            }
            
            console.log('\n🔐 Credenciales de desarrollo:');
            console.log('   📧 Email: admin@tancat.com');
            console.log('   🔑 Password: admin123');
            
            console.log('\n🛑 Para detener: Ctrl+C\n');
        });
        
        // Manejo de errores del servidor
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Puerto ${PORT} ya está en uso`);
                console.log('💡 Soluciones:');
                console.log('   1. Cambiar el puerto en el archivo .env');
                console.log('   2. Cerrar el proceso que usa el puerto');
                console.log(`   3. Ejecutar: npx kill-port ${PORT}`);
            } else {
                console.error('❌ Error del servidor:', error.message);
            }
            process.exit(1);
        });
        
        // Manejo de cierre graceful
        process.on('SIGTERM', () => cerrarServidor(server));
        process.on('SIGINT', () => cerrarServidor(server));
        
        // Manejo de errores no capturados
        process.on('uncaughtException', (error) => {
            console.error('❌ Excepción no capturada:', error);
            cerrarServidor(server);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Promise rechazada no manejada:', reason);
            console.error('En:', promise);
            cerrarServidor(server);
        });
        
        return server;
        
    } catch (error) {
        console.error('❌ Error fatal al iniciar servidor:', error.message);
        process.exit(1);
    }
}

// ====================================
// CIERRE GRACEFUL DEL SERVIDOR
// ====================================
async function cerrarServidor(server) {
    console.log('\n🔄 Cerrando servidor gracefully...');
    
    try {
        // Cerrar servidor HTTP
        if (server) {
            server.close(() => {
                console.log('✅ Servidor HTTP cerrado');
            });
        }
        
        // Cerrar conexiones de base de datos
        await closeConnections();
        
        console.log('👋 Servidor TANCAT cerrado exitosamente');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error al cerrar servidor:', error.message);
        process.exit(1);
    }
}

// ====================================
// INICIAR SERVIDOR SI ES EL ARCHIVO PRINCIPAL
// ====================================
if (require.main === module) {
    iniciarServidor().catch(error => {
        console.error('❌ Error crítico:', error);
        process.exit(1);
    });
}

module.exports = { iniciarServidor, cerrarServidor };