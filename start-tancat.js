#!/usr/bin/env node

/**
 * TANCAT SYSTEM - Launcher Principal
 * Archivo: start-tancat.js
 * Descripción: Script para iniciar el sistema completo
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colores para consola
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

// Función para logging con colores
const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`)
};

// Verificar estructura del proyecto
function checkProjectStructure() {
    log.title('🔍 Verificando estructura del proyecto...');
    
    const requiredDirs = ['backend', 'frontend'];
    const requiredFiles = [
        'backend/package.json',
        'backend/server.js',
        'frontend/package.json'
    ];
    
    // Verificar directorios
    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            log.error(`Directorio faltante: ${dir}`);
            return false;
        }
        log.success(`Directorio encontrado: ${dir}`);
    }
    
    // Verificar archivos críticos
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            log.error(`Archivo faltante: ${file}`);
            return false;
        }
        log.success(`Archivo encontrado: ${file}`);
    }
    
    return true;
}

// Verificar dependencias
async function checkDependencies() {
    log.title('📦 Verificando dependencias...');
    
    const dirs = ['backend', 'frontend'];
    
    for (const dir of dirs) {
        const nodeModulesPath = path.join(dir, 'node_modules');
        const packageJsonPath = path.join(dir, 'package.json');
        
        if (!fs.existsSync(nodeModulesPath)) {
            log.warning(`node_modules faltante en ${dir}`);
            log.info(`Instalando dependencias en ${dir}...`);
            
            try {
                await runCommand('npm', ['install'], { cwd: dir });
                log.success(`Dependencias instaladas en ${dir}`);
            } catch (error) {
                log.error(`Error instalando dependencias en ${dir}: ${error.message}`);
                return false;
            }
        } else {
            log.success(`Dependencias verificadas en ${dir}`);
        }
    }
    
    return true;
}

// Ejecutar comando con promesa
function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Proceso terminó con código ${code}`));
            }
        });
        
        process.on('error', (error) => {
            reject(error);
        });
    });
}

// Verificar puertos disponibles
function checkPorts() {
    log.title('🔌 Verificando puertos...');
    
    const net = require('net');
    
    function checkPort(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(true); // Puerto disponible
                });
                server.close();
            });
            
            server.on('error', () => {
                resolve(false); // Puerto ocupado
            });
        });
    }
    
    return Promise.all([
        checkPort(3000).then(available => {
            if (available) {
                log.success('Puerto 3000 (Backend) disponible');
            } else {
                log.warning('Puerto 3000 (Backend) ocupado');
            }
            return { port: 3000, available };
        }),
        checkPort(5173).then(available => {
            if (available) {
                log.success('Puerto 5173 (Frontend) disponible');
            } else {
                log.warning('Puerto 5173 (Frontend) ocupado');
            }
            return { port: 5173, available };
        })
    ]);
}

// Mostrar información del sistema
function showSystemInfo() {
    log.title('📋 Información del Sistema');
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Architecture: ${process.arch}`);
    console.log(`Working Directory: ${process.cwd()}`);
    console.log('');
}

// Iniciar servicios
async function startServices() {
    log.title('🚀 Iniciando servicios TANCAT...');
    
    // Iniciar backend
    log.info('Iniciando Backend...');
    const backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: 'backend',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
    });
    
    // Manejar salida del backend
    backendProcess.stdout.on('data', (data) => {
        console.log(`${colors.green}[BACKEND]${colors.reset} ${data.toString().trim()}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
        console.log(`${colors.red}[BACKEND-ERROR]${colors.reset} ${data.toString().trim()}`);
    });
    
    // Esperar un poco antes de iniciar frontend
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Iniciar frontend
    log.info('Iniciando Frontend...');
    const frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: 'frontend',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
    });
    
    // Manejar salida del frontend
    frontendProcess.stdout.on('data', (data) => {
        console.log(`${colors.blue}[FRONTEND]${colors.reset} ${data.toString().trim()}`);
    });
    
    frontendProcess.stderr.on('data', (data) => {
        console.log(`${colors.red}[FRONTEND-ERROR]${colors.reset} ${data.toString().trim()}`);
    });
    
    // Mostrar URLs
    console.log('\n' + '='.repeat(50));
    log.success('🎉 TANCAT System iniciado exitosamente!');
    console.log('');
    console.log(`${colors.cyan}📱 Frontend: http://localhost:5173${colors.reset}`);
    console.log(`${colors.green}🔧 Backend:  http://localhost:3000${colors.reset}`);
    console.log(`${colors.yellow}📚 API Docs: http://localhost:3000/api/docs${colors.reset}`);
    console.log('');
    console.log(`${colors.magenta}Presiona Ctrl+C para detener ambos servicios${colors.reset}`);
    console.log('='.repeat(50) + '\n');
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
        log.info('Cerrando servicios...');
        backendProcess.kill();
        frontendProcess.kill();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        log.info('Cerrando servicios...');
        backendProcess.kill();
        frontendProcess.kill();
        process.exit(0);
    });
    
    // Esperar a que terminen los procesos
    return new Promise((resolve) => {
        let backendClosed = false;
        let frontendClosed = false;
        
        backendProcess.on('close', () => {
            backendClosed = true;
            if (frontendClosed) resolve();
        });
        
        frontendProcess.on('close', () => {
            frontendClosed = true;
            if (backendClosed) resolve();
        });
    });
}

// Función principal
async function main() {
    try {
        console.clear();
        log.title('🏓 TANCAT SYSTEM - Launcher');
        console.log('=========================================\n');
        
        showSystemInfo();
        
        // Verificaciones previas
        if (!checkProjectStructure()) {
            log.error('Estructura del proyecto inválida');
            process.exit(1);
        }
        
        const dependenciesOk = await checkDependencies();
        if (!dependenciesOk) {
            log.error('Error en dependencias');
            process.exit(1);
        }
        
        const portStatus = await checkPorts();
        
        // Iniciar servicios
        await startServices();
        
    } catch (error) {
        log.error(`Error fatal: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
    main();
}

module.exports = { main, checkProjectStructure, checkDependencies };