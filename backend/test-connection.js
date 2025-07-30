/**
 * Script de conexión CORREGIDO para Supabase
 * Ejecutar con: node test-connection-fixed.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 Probando conexión a Supabase (VERSIÓN CORREGIDA)...\n');

// ====================================
// MOSTRAR CONFIGURACIÓN
// ====================================
console.log('📋 Configuración actual:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL || '❌ NO CONFIGURADA'}`);
console.log(`   DB_HOST: ${process.env.DB_HOST || '❌ NO CONFIGURADO'}`);
console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA'}`);
console.log('');

// ====================================
// PROBAR POSTGRESQL CON CONSULTAS BÁSICAS
// ====================================
async function testPostgreSQLBasic() {
    console.log('🐘 Probando PostgreSQL con consultas básicas...');
    
    try {
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });
        
        // Prueba 1: Consulta básica de tiempo
        console.log('   📅 Probando consulta de tiempo...');
        const timeResult = await pool.query('SELECT NOW() as current_time');
        console.log(`   ✅ Tiempo del servidor: ${timeResult.rows[0].current_time}`);
        
        // Prueba 2: Verificar si tenemos acceso a información del esquema
        console.log('   🔍 Probando acceso a información del esquema...');
        const schemaResult = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name IN ('public', 'auth', 'storage')
            ORDER BY schema_name
        `);
        console.log(`   ✅ Esquemas encontrados: ${schemaResult.rows.map(r => r.schema_name).join(', ')}`);
        
        // Prueba 3: Verificar tablas existentes en el esquema public
        console.log('   📋 Probando acceso a tablas...');
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
            LIMIT 10
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log(`   ✅ Tablas encontradas: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
        } else {
            console.log('   ℹ️  No hay tablas en el esquema público (esto es normal en un proyecto nuevo)');
        }
        
        // Prueba 4: Crear una tabla de prueba
        console.log('   🧪 Probando creación de tabla...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS test_tancat (
                id SERIAL PRIMARY KEY,
                mensaje TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('   ✅ Tabla de prueba creada exitosamente');
        
        // Prueba 5: Insertar y leer datos
        console.log('   💾 Probando inserción de datos...');
        await pool.query(`
            INSERT INTO test_tancat (mensaje) 
            VALUES ('Conexión TANCAT exitosa - ${new Date().toISOString()}')
        `);
        
        const testData = await pool.query('SELECT * FROM test_tancat ORDER BY created_at DESC LIMIT 1');
        console.log(`   ✅ Dato insertado: ${testData.rows[0].mensaje}`);
        
        // Limpiar tabla de prueba
        await pool.query('DROP TABLE IF EXISTS test_tancat');
        console.log('   🗑️  Tabla de prueba eliminada');
        
        await pool.end();
        
        console.log('✅ PostgreSQL: TODAS LAS PRUEBAS EXITOSAS');
        return true;
        
    } catch (error) {
        console.log('❌ PostgreSQL: FALLÓ');
        console.log(`   Error: ${error.message}`);
        console.log(`   Código: ${error.code}`);
        
        // Diagnósticos específicos
        if (error.code === 'ENOTFOUND') {
            console.log('   💡 Solución: Verificar DB_HOST en .env');
        } else if (error.code === '28P01') {
            console.log('   💡 Solución: Verificar DB_PASSWORD en .env');
        } else if (error.code === '3D000') {
            console.log('   💡 Solución: La base de datos no existe');
        } else if (error.message.includes('timeout')) {
            console.log('   💡 Solución: Verificar conexión a internet / firewall');
        }
        
        return false;
    }
}

// ====================================
// PROBAR SUPABASE CLIENT CON CONSULTAS APROPIADAS
// ====================================
async function testSupabaseClientFixed() {
    console.log('🔗 Probando Supabase Client...');
    
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Variables de Supabase no configuradas completamente');
        }
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Prueba con una consulta más básica usando SQL directo
        console.log('   🔍 Probando consulta SQL básica...');
        const { data, error } = await supabase.rpc('get_current_timestamp', {});
        
        if (error && error.message.includes('does not exist')) {
            // Si no existe la función, crear una consulta más simple
            console.log('   🔄 Probando consulta alternativa...');
            
            // Usar una consulta SQL directa más básica
            const { data: timeData, error: timeError } = await supabase
                .from('information_schema.tables')
                .select('table_name')
                .limit(1);
            
            if (timeError) {
                throw timeError;
            }
            
            console.log('   ✅ Supabase Client conectado correctamente');
        } else if (error) {
            throw error;
        } else {
            console.log('   ✅ Supabase Client: función RPC funciona');
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Supabase Client: FALLÓ');
        console.log(`   Error: ${error.message}`);
        
        // Pero esto no es crítico si PostgreSQL directo funciona
        console.log('   ℹ️  Nota: El cliente Supabase no es crítico si PostgreSQL directo funciona');
        return false;
    }
}

// ====================================
// CREAR ESTRUCTURA BÁSICA DE TANCAT
// ====================================
async function createTancatStructure() {
    console.log('🏗️  Creando estructura básica de TANCAT...');
    
    try {
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false }
        });
        
        // Crear tabla de roles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id_rol SERIAL PRIMARY KEY,
                nombre VARCHAR(50) NOT NULL UNIQUE,
                descripcion TEXT,
                permisos JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('   ✅ Tabla roles creada');
        
        // Crear tabla de empleados
        await pool.query(`
            CREATE TABLE IF NOT EXISTS empleados (
                id_empleado SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                id_rol INTEGER REFERENCES roles(id_rol),
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('   ✅ Tabla empleados creada');
        
        // Insertar rol de administrador si no existe
        const adminRole = await pool.query('SELECT id_rol FROM roles WHERE nombre = $1', ['Administrador']);
        
        if (adminRole.rows.length === 0) {
            await pool.query(`
                INSERT INTO roles (nombre, descripcion, permisos) 
                VALUES ($1, $2, $3)
            `, [
                'Administrador',
                'Acceso completo al sistema TANCAT',
                JSON.stringify({ all: true })
            ]);
            console.log('   ✅ Rol Administrador creado');
        }
        
        // Insertar usuario administrador si no existe
        const adminUser = await pool.query('SELECT id_empleado FROM empleados WHERE email = $1', ['admin@tancat.com']);
        
        if (adminUser.rows.length === 0) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('admin123', 12);
            
            const roleResult = await pool.query('SELECT id_rol FROM roles WHERE nombre = $1', ['Administrador']);
            
            await pool.query(`
                INSERT INTO empleados (nombre, apellido, email, password_hash, id_rol) 
                VALUES ($1, $2, $3, $4, $5)
            `, [
                'Admin',
                'TANCAT',
                'admin@tancat.com',
                hashedPassword,
                roleResult.rows[0].id_rol
            ]);
            console.log('   ✅ Usuario administrador creado');
            console.log('   📧 Email: admin@tancat.com');
            console.log('   🔐 Password: admin123');
        }
        
        await pool.end();
        
        console.log('✅ Estructura TANCAT creada exitosamente');
        return true;
        
    } catch (error) {
        console.log('❌ Error creando estructura TANCAT:', error.message);
        return false;
    }
}

// ====================================
// EJECUTAR TODAS LAS PRUEBAS
// ====================================
async function runAllTests() {
    console.log('🚀 Iniciando pruebas corregidas...\n');
    
    const postgresOk = await testPostgreSQLBasic();
    console.log('');
    
    const supabaseOk = await testSupabaseClientFixed();
    console.log('');
    
    let structureOk = false;
    if (postgresOk) {
        structureOk = await createTancatStructure();
        console.log('');
    }
    
    // Resumen final
    console.log('🎯 RESUMEN FINAL:');
    console.log(`   PostgreSQL Básico: ${postgresOk ? '✅ FUNCIONANDO' : '❌ FALLA'}`);
    console.log(`   Supabase Client: ${supabaseOk ? '✅ FUNCIONANDO' : '⚠️  NO CRÍTICO'}`);
    console.log(`   Estructura TANCAT: ${structureOk ? '✅ CREADA' : '❌ FALLA'}`);
    
    if (postgresOk && structureOk) {
        console.log('\n🎉 ¡CONEXIÓN EXITOSA!');
        console.log('💡 Tu base de datos está lista para TANCAT');
        console.log('🚀 Ya puedes ejecutar: npm run dev');
        console.log('\n🔐 Credenciales para login:');
        console.log('   📧 Email: admin@tancat.com');
        console.log('   🔑 Password: admin123');
    } else {
        console.log('\n🔧 PRÓXIMOS PASOS:');
        if (!postgresOk) {
            console.log('   1. Verificar credenciales de PostgreSQL en .env');
            console.log('   2. Asegurar que el proyecto Supabase esté activo');
            console.log('   3. Revisar configuración de firewall/red');
        }
    }
    
    process.exit(postgresOk ? 0 : 1);
}

// Ejecutar
runAllTests().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});