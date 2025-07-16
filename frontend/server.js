const http = require('http');
const fs = require('fs');
const path = require('path');

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
    '.ico': 'image/x-icon'
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
                <h1>404 - Archivo no encontrado</h1>
                <p>El archivo ${filePath} no se pudo cargar.</p>
                <a href="/">Volver al inicio</a>
            `);
            return;
        }
        
        res.writeHead(statusCode, { 
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Cache-Control': 'no-cache'
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
    
    // Rutas principales
    if (pathname === '/' || pathname === '/index.html') {
        serveFile(res, path.join(__dirname, 'index.html'));
        return;
    }
    
    // Rutas de páginas
    const pageRoutes = ['/login', '/dashboard', '/reservas', '/clientes', '/ventas', '/torneos', '/inventario', '/reportes'];
    
    if (pageRoutes.includes(pathname)) {
        // Para SPA, servir siempre index.html y dejar que el JS maneje el routing
        serveFile(res, path.join(__dirname, 'index.html'));
        return;
    }
    
    // Archivos estáticos
    let filePath = path.join(__dirname, pathname);
    
    // Verificar si el archivo existe
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // Si no existe, servir index.html para SPA routing
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

server.listen(PORT, HOST, () => {
    console.log(`
🚀 TANCAT Frontend iniciado!
📍 URL: http://${HOST}:${PORT}
🔗 Backend: http://localhost:3000
⏰ Iniciado: ${new Date().toISOString()}

📋 Páginas disponibles:
   http://${HOST}:${PORT}/           - Página principal
   http://${HOST}:${PORT}/login      - Login
   http://${HOST}:${PORT}/dashboard  - Dashboard
   http://${HOST}:${PORT}/reservas   - Reservas

🛑 Para detener: Ctrl+C
    `);
});

// Manejar errores del servidor
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: El puerto ${PORT} ya está en uso.`);
        console.log('💡 Soluciones:');
        console.log(`   1. Terminar proceso: kill -9 $(lsof -ti:${PORT})`);
        console.log('   2. Cambiar puerto en server.js');
    } else {
        console.error('❌ Error del servidor:', err.message);
    }
    process.exit(1);
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor frontend...');
    server.close(() => {
        console.log('✅ Servidor frontend cerrado');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Cerrando servidor frontend...');
    server.close(() => {
        console.log('✅ Servidor frontend cerrado');
        process.exit(0);
    });
});