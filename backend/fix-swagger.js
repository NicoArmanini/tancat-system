/**
 * Script de diagnóstico para Swagger
 * Ejecutar con: node diagnose-swagger.js
 */

console.log('🔍 Diagnosticando Swagger...\n');

// 1. Verificar Node.js version
console.log('1. Node.js version:', process.version);

// 2. Verificar dependencias
try {
    const swaggerJsdoc = require('swagger-jsdoc');
    console.log('✅ swagger-jsdoc encontrado:', typeof swaggerJsdoc);
} catch (error) {
    console.log('❌ swagger-jsdoc NO encontrado:', error.message);
}

try {
    const swaggerUi = require('swagger-ui-express');
    console.log('✅ swagger-ui-express encontrado:', typeof swaggerUi);
} catch (error) {
    console.log('❌ swagger-ui-express NO encontrado:', error.message);
}

// 3. Verificar estructura de archivos
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    './config/swagger.js',
    './routes',
    './package.json'
];

console.log('\n2. Verificando estructura de archivos:');
requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ ${file} existe`);
    } else {
        console.log(`❌ ${file} NO existe`);
    }
});

// 4. Intentar cargar configuración de Swagger
console.log('\n3. Probando configuración de Swagger:');
try {
    const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');
    console.log('✅ Configuración de Swagger cargada correctamente');
    console.log('📊 Número de paths encontrados:', Object.keys(specs.paths || {}).length);
    console.log('📋 Información del API:', specs.info?.title || 'No definido');
} catch (error) {
    console.log('❌ Error al cargar configuración de Swagger:', error.message);
    console.log('📍 Stack:', error.stack);
}

// 5. Verificar archivos de rutas
console.log('\n4. Verificando archivos de rutas:');
const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
    console.log(`📁 Archivos de rutas encontrados: ${routeFiles.length}`);
    routeFiles.forEach(file => {
        console.log(`   - ${file}`);
    });
} else {
    console.log('❌ Directorio routes no existe');
}

console.log('\n🏁 Diagnóstico completado');
console.log('\n💡 Soluciones recomendadas:');
console.log('   1. Si faltan dependencias: npm install swagger-jsdoc swagger-ui-express');
console.log('   2. Si falta config/swagger.js: crear el archivo de configuración');
console.log('   3. Si no hay rutas documentadas: agregar comentarios @swagger en routes/*.js');
console.log('   4. Verificar que el archivo app.js incluya la configuración de Swagger correctamente');