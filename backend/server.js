/**
 * TANCAT - Sistema de Administración
 * Archivo: server.js
 * Descripción: Punto de entrada principal del servidor
 */

const app = require('./app');
const { pool } = require('./utils/database');

// ====================================
// CONFIGURACIÓN DEL SERVIDOR
// ====================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====================================
// VERIFICACIÓN DE BASE DE DATOS
// ====================================
async function verificarConexionDB() {
    try {
        const client = await pool.connect();
        
        // Verificar conexión con una consulta simple
        const result = await client.query('SELECT NOW() as timestamp, version() as version');
        
        console.log('✅ Conexión a base de datos exitosa');
        console.log(`📅 Timestamp: ${result.rows[0].timestamp}`);
        console.log(`🐘 PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);
        
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a base de datos:', error.message);
        
        if (NODE_ENV === 'development') {
            console.log('\n📋 Verificaciones sugeridas:');
            console.log('   1. Verificar que PostgreSQL esté ejecutándose');
            console.log('   2. Revisar credenciales en archivo .env');
            console.log('   3. Verificar que la base de datos exista');
            console.log('   4. Comprobar firewall y permisos de red\n');
        }
        
        return false;
    }
}

// ====================================
// VERIFICACIÓN DE TABLAS
// ====================================
async function verificarEstructuraDB() {
    try {
        const client = await pool.connect();
        
        // Verificar que existan las tablas principales
        const tablasRequeridas = [
            'sedes', 'deportes', 'canchas', 'turnos', 
            'clientes', 'empleados', 'reservas', 'productos'
        ];
        
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name = ANY($1)
        `, [tablasRequeridas]);
        
        const tablaExistentes = result.rows.map(row => row.table_name);
        const tablasFaltantes = tablasRequeridas.filter(tabla => !tablaExistentes.includes(tabla));
        
        if (tablasFaltantes.length > 0) {
            console.warn('⚠️  Tablas faltantes en la base de datos:', tablasFaltantes);
            console.log('💡 Ejecuta: npm run migrate para crear las tablas');
        } else {
            console.log('✅ Estructura de base de datos verificada');
        }
        
        client.release();
        return tablasFaltantes.length === 0;
    } catch (error) {
        console.error('❌ Error al verificar estructura de DB:', error.message);
        return false;
    }
}

// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function iniciarServidor() {
    try {
        console.log('🚀 Iniciando servidor TANCAT...\n');
        
        // Verificar conexión a base de datos
        const conexionDB = await verificarConexionDB();
        
        if (!conexionDB) {
            console.error('❌ No se puede iniciar el servidor sin conexión a la base de datos');
            
            if (NODE_ENV === 'development') {
                console.log('⚠️  Iniciando en modo degradado para desarrollo...');
            } else {
                process.exit(1);
            }
        }
        
        // Verificar estructura de base de datos
        if (conexionDB) {
            await verificarEstructuraDB();
        }
        
        // Iniciar servidor HTTP
        const server = app.listen(PORT, HOST, () => {
            console.log('\n🎉 Servidor TANCAT iniciado exitosamente!');
            console.log(`📍 URL: http://${HOST}:${PORT}`);
            console.log(`🌍 Entorno: ${NODE_ENV}`);
            console.log(`📅 Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' })}`);
            
            // URLs útiles para desarrollo
            if (NODE_ENV === 'development') {
                console.log('\n📋 URLs de desarrollo:');
                console.log(`   Frontend: http://${HOST}:${PORT === 3000 ? '5500' : '3000'}`);
                console.log(`   API Docs: http://${HOST}:${PORT}/api/docs`);
                console.log(`   Health Check: http://${HOST}:${PORT}/api/health`);
                console.log(`   Cliente API: http://${HOST}:${PORT}/api/cliente/sedes\n`);
            }
        });
        
        // Manejo de errores del servidor
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Puerto ${PORT} ya está en uso`);
                console.log('💡 Intenta cambiar el puerto en el archivo .env o cierra el proceso que lo usa');
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
        server.close(() => {
            console.log('✅ Servidor HTTP cerrado');
        });
        
        // Cerrar pool de conexiones de base de datos
        await pool.end();
        console.log('✅ Conexiones de base de datos cerradas');
        
        console.log('👋 Servidor TANCAT cerrado exitosamente');
        process.exit(0);
        
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
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada no manejada:', reason);
    console.error('En:', promise);
    process.exit(1);
});

// ====================================
// INICIAR SERVIDOR
// ====================================
if (require.main === module) {
    iniciarServidor();
}

module.exports = { iniciarServidor, verificarConexionDB, verificarEstructuraDB };