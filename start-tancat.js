/**
 * TANCAT - Script de Inicialización
 * Archivo: start-tancat.js (UBICAR EN LA RAÍZ DEL PROYECTO)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colores para console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

class TancatStarter {
    constructor() {
        this.processes = [];
        this.isShuttingDown = false;
    }

    async start() {
        log('🏓 TANCAT SYSTEM - Inicializando...', 'cyan');
        log('=====================================', 'cyan');

        try {
            await this.verifyProjectStructure();
            await this.verifyDependencies();
            await this.verifyConfiguration();
            await this.startServices();
            this.setupSignalHandlers();
            this.showFinalInfo();

        } catch (error) {
            log(`❌ Error al inicializar: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    async verifyProjectStructure() {
        log('📋 Verificando estructura del proyecto...', 'yellow');

        const requiredFiles = [
            'backend/package.json',
            'backend/server.js',
            'backend/app.js',
            'frontend/index.html'
        ];

        const requiredDirs = [
            'backend',
            'frontend',
            'backend/routes',
            'backend/controllers',
            'backend/utils',
            'frontend/assets',
            'frontend/assets/js',
            'frontend/assets/css'
        ];

        // Crear directorios faltantes
        for (const dir of requiredDirs) {
            if (!fs.existsSync(dir)) {
                log(`⚠️  Creando directorio: ${dir}`, 'yellow');
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Verificar archivos críticos
        const missingFiles = [];
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                missingFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            log('❌ Archivos faltantes:', 'red');
            missingFiles.forEach(file => log(`   - ${file}`, 'red'));
            throw new Error('Crea los archivos faltantes primero.');
        }

        log('✅ Estructura verificada', 'green');
    }

    async verifyDependencies() {
        log('📦 Verificando dependencias...', 'yellow');

        if (!fs.existsSync('backend/node_modules')) {
            log('⚠️  Instalando dependencias del backend...', 'yellow');
            await this.executeCommand('npm', ['install'], { cwd: 'backend' });
        }

        log('✅ Dependencias verificadas', 'green');
    }

    async verifyConfiguration() {
        log('⚙️  Verificando configuración...', 'yellow');

        if (!fs.existsSync('backend/.env')) {
            if (fs.existsSync('backend/.env.example')) {
                log('💡 Copiando .env.example a .env', 'blue');
                fs.copyFileSync('backend/.env.example', 'backend/.env');
                log('📝 EDITA backend/.env con tu DATABASE_URL', 'yellow');
            } else {
                log('⚠️  Crea backend/.env con tu DATABASE_URL', 'yellow');
            }
        }

        log('✅ Configuración verificada', 'green');
    }

    async startServices() {
        log('🚀 Iniciando servicios...', 'yellow');

        await this.startBackend();
        await this.delay(3000);
        await this.startFrontend();

        log('✅ Servicios iniciados', 'green');
    }

    async startBackend() {
        log('🔧 Iniciando backend (puerto 3000)...', 'blue');

        const backendProcess = spawn('npm', ['run', 'dev'], {
            cwd: 'backend',
            stdio: ['inherit', 'pipe', 'pipe']
        });

        backendProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) log(`[BACKEND] ${output}`, 'blue');
        });

        backendProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output && !output.includes('Warning')) {
                log(`[BACKEND ERROR] ${output}`, 'red');
            }
        });

        this.processes.push({ name: 'backend', process: backendProcess });
    }

    async startFrontend() {
        log('🌐 Iniciando frontend (puerto 5173)...', 'cyan');

        const frontendProcess = spawn('node', ['server.js'], {
            cwd: 'frontend',
            stdio: ['inherit', 'pipe', 'pipe']
        });

        frontendProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) log(`[FRONTEND] ${output}`, 'cyan');
        });

        frontendProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output && !output.includes('Warning')) {
                log(`[FRONTEND ERROR] ${output}`, 'red');
            }
        });

        this.processes.push({ name: 'frontend', process: frontendProcess });
    }

    setupSignalHandlers() {
        const shutdown = (signal) => {
            if (this.isShuttingDown) return;
            
            log(`\n🛑 Cerrando servicios...`, 'yellow');
            this.isShuttingDown = true;

            this.processes.forEach(({ name, process }) => {
                log(`🔌 Cerrando ${name}...`, 'yellow');
                process.kill('SIGTERM');
            });

            setTimeout(() => {
                log('👋 TANCAT cerrado', 'green');
                process.exit(0);
            }, 2000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    showFinalInfo() {
        log('\n🎉 TANCAT SYSTEM INICIADO', 'green');
        log('===========================', 'green');
        log('📋 URLs:', 'bright');
        log('   🌐 Frontend: http://localhost:5173', 'cyan');
        log('   🔧 Backend:  http://localhost:3000', 'blue');
        log('   📚 API:      http://localhost:3000/api/health', 'blue');
        log('\n💡 Presiona Ctrl+C para detener', 'yellow');
        log('🌐 Abre tu navegador en: http://localhost:5173\n', 'green');
    }

    executeCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const childProcess = spawn(command, args, {
                stdio: 'inherit',
                ...options
            });

            childProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Falló con código ${code}`));
            });

            childProcess.on('error', reject);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Ejecutar
if (require.main === module) {
    const starter = new TancatStarter();
    starter.start().catch((error) => {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = TancatStarter;