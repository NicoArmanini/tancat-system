#!/usr/bin/env node

/**
 * TANCAT - Script para abrir frontend
 * Archivo: open-frontend.js (UBICAR EN LA RAÍZ)
 * Uso: node open-frontend.js
 */

const { exec } = require('child_process');
const http = require('http');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3000';

// Colores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkServer(url, name) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            resolve(true);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

function openBrowser(url) {
    const platform = process.platform;
    let command;
    
    switch (platform) {
        case 'win32':
            command = `start "${url}"`;
            break;
        case 'darwin':
            command = `open "${url}"`;
            break;
        case 'linux':
            // Intentar varios navegadores en Linux
            command = `xdg-open "${url}" || google-chrome "${url}" || firefox "${url}" || chromium "${url}"`;
            break;
        default:
            log(`❌ Plataforma ${platform} no soportada`, 'red');
            return false;
    }
    
    exec(command, (error) => {
        if (error) {
            log(`❌ Error abriendo navegador: ${error.message}`, 'red');
            log(`🔗 Copia y pega esta URL: ${url}`, 'blue');
            return false;
        } else {
            log(`✅ Navegador abierto: ${url}`, 'green');
            return true;
        }
    });
}

async function main() {
    log('🔍 Verificando servicios TANCAT...', 'blue');
    
    // Verificar backend
    const backendOk = await checkServer(`${BACKEND_URL}/api/health`, 'Backend');
    if (backendOk) {
        log('✅ Backend funcionando (puerto 3000)', 'green');
    } else {
        log('❌ Backend no responde (puerto 3000)', 'red');
        log('💡 Ejecuta: npm start (en otra terminal)', 'yellow');
    }
    
    // Verificar frontend
    const frontendOk = await checkServer(FRONTEND_URL, 'Frontend');
    if (frontendOk) {
        log('✅ Frontend funcionando (puerto 5173)', 'green');
        
        // Abrir navegador
        log('🌐 Abriendo frontend...', 'blue');
        openBrowser(FRONTEND_URL);
        
    } else {
        log('❌ Frontend no responde (puerto 5173)', 'red');
        log('💡 Verifica que npm start esté corriendo', 'yellow');
    }
    
    // Mostrar URLs útiles
    log('\n📋 URLs del sistema:', 'blue');
    log(`   🌐 Frontend: ${FRONTEND_URL}`, 'reset');
    log(`   🔧 Backend:  ${BACKEND_URL}`, 'reset');
    log(`   📚 API Docs: ${BACKEND_URL}/api/docs`, 'reset');
    log(`   🏥 Health:   ${BACKEND_URL}/api/health`, 'reset');
    
    log('\n💡 Comandos útiles:', 'yellow');
    log('   npm start           - Iniciar sistema completo', 'reset');
    log('   node open-frontend  - Abrir solo frontend', 'reset');
    log('   npm run backend     - Solo backend', 'reset');
    log('   npm run frontend    - Solo frontend', 'reset');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { openBrowser, checkServer };