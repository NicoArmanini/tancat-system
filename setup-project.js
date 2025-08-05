#!/usr/bin/env node

/**
 * TANCAT SYSTEM - Setup Project
 * Archivo: setup-project.js
 * Descripción: Configuración inicial del proyecto
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`)
};

// Crear archivo .env para backend
function createBackendEnv() {
    const envPath = path.join('backend', '.env');
    
    if (fs.existsSync(envPath)) {
        log.info('Archivo .env ya existe en backend');
        return;
    }
    
    const envContent = `# TANCAT BACKEND - CONFIGURACIÓN
NODE_ENV=development
PORT=3000
HOST=localhost

# Base de Datos Neon PostgreSQL
DATABASE_URL=postgresql://username:password@host/database

# Seguridad
JWT_SECRET=tancat_super_secret_key_change_in_production
JWT_EXPIRE=24h
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timezone
TZ=America/Argentina/Cordoba
`;
    
    fs.writeFileSync(envPath, envContent);
    log.success('Archivo .env creado en backend');
    log.warning('IMPORTANTE: Edita backend/.env con tus credenciales de base de datos');
}

// Crear directorios necesarios
function createDirectories() {
    log.info('Creando estructura de directorios...');
    
    const dirs = [
        'backend/controllers',
        'backend/routes',
        'backend/services', 
        'backend/middleware',
        'backend/utils',
        'backend/uploads',
        'backend/logs',
        'frontend/assets/js',
        'frontend/assets/css',
        'frontend/assets/images',
        'frontend/pages'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            log.success(`Directorio creado: ${dir}`);
        }
    });
}

// Verificar Node.js y npm
function checkSystemRequirements() {
    log.title('🔍 Verificando requisitos del sistema...');
    
    try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        
        log.success(`Node.js: ${nodeVersion}`);
        log.success(`npm: ${npmVersion}`);
        
        // Verificar versión mínima de Node.js
        const nodeMajor = parseInt(nodeVersion.substring(1).split('.')[0]);
        if (nodeMajor < 18) {
            log.error('Node.js 18+ es requerido');
            return false;
        }
        
        return true;
    } catch (error) {
        log.error('Node.js o npm no están instalados');
        return false;
    }
}

// Instalar dependencias
function installDependencies() {
    log.title('📦 Instalando dependencias...');
    
    try {
        // Instalar dependencias del proyecto principal
        log.info('Instalando dependencias principales...');
        execSync('npm install', { stdio: 'inherit' });
        
        // Instalar dependencias del backend
        log.info('Instalando dependencias del backend...');
        execSync('npm install', { cwd: 'backend', stdio: 'inherit' });
        
        // Instalar dependencias del frontend
        log.info('Instalando dependencias del frontend...');
        execSync('npm install', { cwd: 'frontend', stdio: 'inherit' });
        
        log.success('Todas las dependencias instaladas correctamente');
        return true;
    } catch (error) {
        log.error('Error instalando dependencias');
        return false;
    }
}

// Función principal
async function main() {
    console.clear();
    log.title('🏓 TANCAT SYSTEM - Setup Project');
    console.log('=========================================\n');
    
    try {
        // Verificar requisitos
        if (!checkSystemRequirements()) {
            process.exit(1);
        }
        
        // Crear estructura
        createDirectories();
        createBackendEnv();
        
        // Instalar dependencias
        if (!installDependencies()) {
            process.exit(1);
        }
        
        // Mostrar instrucciones finales
        console.log('\n' + '='.repeat(50));
        log.success('🎉 Proyecto configurado exitosamente!');
        console.log('');
        log.info('Próximos pasos:');
        console.log('1. Configura tu base de datos en backend/.env');
        console.log('2. Ejecuta: npm start');
        console.log('');
        console.log('URLs del sistema:');
        console.log('• Frontend: http://localhost:5173');
        console.log('• Backend:  http://localhost:3000');
        console.log('• API Docs: http://localhost:3000/api/docs');
        console.log('='.repeat(50));
        
    } catch (error) {
        log.error(`Error durante setup: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}