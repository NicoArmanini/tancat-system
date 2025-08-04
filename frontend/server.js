// frontend/server.js - SERVIDOR CON APERTURA AUTOMÁTICA
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 5173;
const HOST = 'localhost';

// MIME types para diferentes archivos
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filePath, statusCode = 200) {
    const mimeType = getMimeType(filePath);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - Archivo no encontrado</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                        .error { color: #e74c3c; }
                        .link { color: #3498db; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <h1 class="error">404 - Archivo no encontrado</h1>
                    <p>El archivo ${filePath} no se pudo cargar.</p>
                    <a href="/" class="link">🏠 Volver al inicio</a>
                </body>
                </html>
            `);
            return;
        }
        
        res.writeHead(statusCode, { 
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    // Manejar CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    // Parsear URL
    let pathname = req.url;
    
    // Remover query strings
    if (pathname.includes('?')) {
        pathname = pathname.split('?')[0];
    }
    
    // Log de requests para debugging
    console.log(`[FRONTEND] ${req.method} ${pathname}`);
    
    // Ruta raíz - servir index.html
    if (pathname === '/') {
        serveFile(res, path.join(__dirname, 'index.html'));
        return;
    }
    
    // Archivos estáticos
    let filePath = path.join(__dirname, pathname);
    
    // Verificar si el archivo existe
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // Si no existe, servir index.html para SPA routing
            console.log(`[FRONTEND] Archivo no encontrado: ${filePath}, sirviendo index.html`);
            serveFile(res, path.join(__dirname, 'index.html'));
        } else {
            // Verificar si es un directorio
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    serveFile(res, path.join(__dirname, 'index.html'));
                    return;
                }
                
                if (stats.isDirectory()) {
                    // Si es directorio, buscar index.html
                    const indexPath = path.join(filePath, 'index.html');
                    fs.access(indexPath, fs.constants.F_OK, (err) => {
                        if (err) {
                            serveFile(res, path.join(__dirname, 'index.html'));
                        } else {
                            serveFile(res, indexPath);
                        }
                    });
                } else {
                    // Servir el archivo
                    serveFile(res, filePath);
                }
            });
        }
    });
});

// Función para abrir navegador
function openBrowser(url) {
    const platform = process.platform;
    let command;
    
    switch (platform) {
        case 'win32':
            command = `start ${url}`;
            break;
        case 'darwin':
            command = `open ${url}`;
            break;
        case 'linux':
            command = `xdg-open ${url}`;
            break;
        default:
            console.log(`🌐 Plataforma ${platform} no soportada para apertura automática`);
            return false;
    }
    
    exec(command, (error) => {
        if (error) {
            console.log(`⚠️  No se pudo abrir automáticamente: ${error.message}`);
            console.log(`🌐 Abre manualmente: ${url}`);
            return false;
        } else {
            console.log(`✅ Navegador abierto automáticamente: ${url}`);
            return true;
        }
    });
}

// Verificar si el puerto está disponible
function checkPortAvailable(port, callback) {
    const testServer = http.createServer();
    
    testServer.listen(port, (err) => {
        if (err) {
            callback(false);
        } else {
            testServer.close(() => {
                callback(true);
            });
        }
    });
    
    testServer.on('error', (err) => {
        callback(false);
    });
}

// Iniciar servidor
checkPortAvailable(PORT, (available) => {
    if (!available) {
        console.error(`❌ Puerto ${PORT} ya está en uso.`);
        console.log('💡 Soluciones:');
        console.log('   1. Cierra otras aplicaciones que usen el puerto 5173');
        console.log('   2. Mata el proceso: lsof -ti:5173 | xargs kill -9');
        console.log('   3. Usa otro puerto modificando este archivo');
        process.exit(1);
    }
    
    server.listen(PORT, HOST, () => {
        const url = `http://${HOST}:${PORT}`;
        
        console.log(`
🚀 TANCAT Frontend iniciado exitosamente!
📍 Servidor: ${url}
⏰ Iniciado: ${new Date().toISOString()}

📋 Funcionalidades:
   ✅ Servidor estático optimizado
   ✅ SPA routing habilitado  
   ✅ CORS configurado para API
   ✅ Auto-reload de archivos
   ✅ Manejo de errores mejorado

🌐 Abriendo navegador automáticamente...
        `);
        
        // Intentar abrir automáticamente después de un breve delay
        setTimeout(() => {
            const opened = openBrowser(url);
            if (!opened) {
                console.log(`
🔗 ENLACES DIRECTOS:
   🏠 Página principal: ${url}
   📱 Desde móvil: http://TU_IP:${PORT}
   
💡 Si no abre automáticamente, copia y pega: ${url}
                `);
            }
        }, 1000);
    });
});

// Manejar errores del servidor
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: El puerto ${PORT} ya está en uso.`);
        console.log('💡 Ejecuta: lsof -ti:5173 | xargs kill -9');
    } else {
        console.error('❌ Error del servidor frontend:', err.message);
    }
    process.exit(1);
});

// Manejar cierre graceful
function shutdown(signal) {
    console.log(`\n🛑 Frontend recibió ${signal}, cerrando...`);
    server.close(() => {
        console.log('✅ Servidor frontend cerrado correctamente');
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// En Windows, manejar Ctrl+C
if (process.platform === "win32") {
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", () => {
        process.emit("SIGINT");
    });
}