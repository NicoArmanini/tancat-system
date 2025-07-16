/**
 * TANCAT - Sistema de Administración
 * Archivo: server.js
 * Descripción: Punto de entrada principal del servidor
 */

require('dotenv').config();
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
        
        console.log('✅ Conexión a Supabase/PostgreSQL exitosa');
        console.log(`📅 Timestamp: ${result.rows[0].timestamp}`);
        console.log(`🐘 PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);
        
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a base de datos:', error.message);
        
        if (NODE_ENV === 'development') {
            console.log('\n📋 Verificaciones sugeridas:');
            console.log('   1. Verificar credenciales de Supabase en .env');
            console.log('   2. Revisar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
            console.log('   3. Verificar conectividad a internet');
            console.log('   4. Comprobar que el proyecto Supabase esté activo\n');
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
            'clientes', 'empleados', 'reservas', 'productos',
            'categorias_productos', 'ventas', 'torneos'
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
            console.log('💡 Ejecuta el script SQL en Supabase para crear las tablas');
        } else {
            console.log('✅ Estructura de base de datos verificada');
            console.log(`📊 Tablas encontradas: ${tablaExistentes.length}/${tablasRequeridas.length}`);
        }
        
        client.release();
        return tablasFaltantes.length === 0;
    } catch (error) {
        console.error('❌ Error al verificar estructura de DB:', error.message);
        return false;
    }
}

// ====================================
// CONFIGURACIÓN DE CORS ESPECÍFICA
// ====================================
function configurarCORS() {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];
    
    if (NODE_ENV === 'production') {
        // Agregar dominios de producción aquí
        allowedOrigins.push('https://tu-dominio-produccion.com');
    }
    
    return allowedOrigins;
}

// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function iniciarServidor() {
    try {
        console.log('🚀 Iniciando servidor TANCAT...\n');
        
        // Mostrar configuración
        console.log('📋 Configuración:');
        console.log(`   Entorno: ${NODE_ENV}`);
        console.log(`   Puerto: ${PORT}`);
        console.log(`   Host: ${HOST}`);
        console.log(`   Supabase URL: ${process.env.SUPABASE_URL ? '✅ Configurado' : '❌ No configurado'}`);
        console.log(`   Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ No configurado'}\n`);
        
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
            console.log(`📍 Backend URL: http://${HOST}:${PORT}`);
            console.log(`🌍 Entorno: ${NODE_ENV}`);
            console.log(`📅 Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' })}`);
            
            // URLs útiles para desarrollo
            if (NODE_ENV === 'development') {
                console.log('\n📋 URLs importantes:');
                console.log(`   🖥️  Frontend: http://localhost:5173`);
                console.log(`   🔧 Backend API: http://${HOST}:${PORT}/api`);
                console.log(`   📚 API Docs: http://${HOST}:${PORT}/api/docs`);
                console.log(`   ❤️  Health Check: http://${HOST}:${PORT}/api/health`);
                console.log(`   👥 Cliente API: http://${HOST}:${PORT}/api/cliente/sedes`);
                console.log(`   🔐 Auth API: http://${HOST}:${PORT}/api/auth/login\n`);
                
                console.log('💡 Comandos útiles:');
                console.log('   Frontend: cd frontend && npm run dev');
                console.log('   Test API: curl http://localhost:3000/api/health\n');
            }
        });
        
        // Manejo de errores del servidor
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Puerto ${PORT} ya está en uso`);
                console.log('💡 Soluciones:');
                console.log('   1. Cambiar el puerto en el archivo .env');
                console.log('   2. Cerrar el proceso que usa el puerto');
                console.log(`   3. Ejecutar: kill -9 $(lsof -ti:${PORT})`);
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