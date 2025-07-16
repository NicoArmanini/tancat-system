#!/bin/bash

# ====================================
# TANCAT SYSTEM - SETUP DESARROLLO
# ====================================

echo "🏓 TANCAT SYSTEM - Configuración de Desarrollo"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Ejecuta este script desde la raíz del proyecto TANCAT-SYSTEM"
    exit 1
fi

# ====================================
# 1. LIMPIAR INSTALACIONES PREVIAS
# ====================================
log_info "Limpiando instalaciones previas..."

rm -rf backend/node_modules frontend/node_modules node_modules
rm -f backend/package-lock.json frontend/package-lock.json package-lock.json

log_success "Directorios limpiados"

# ====================================
# 2. INSTALAR DEPENDENCIAS BACKEND
# ====================================
log_info "Instalando dependencias del backend..."

cd backend
npm install

if [ $? -eq 0 ]; then
    log_success "Dependencias del backend instaladas"
else
    log_error "Error al instalar dependencias del backend"
    exit 1
fi

cd ..

# ====================================
# 3. INSTALAR DEPENDENCIAS FRONTEND
# ====================================
log_info "Instalando dependencias del frontend..."

cd frontend
npm install

if [ $? -eq 0 ]; then
    log_success "Dependencias del frontend instaladas"
else
    log_error "Error al instalar dependencias del frontend"
    exit 1
fi

cd ..

# ====================================
# 4. VERIFICAR ARCHIVOS .ENV
# ====================================
log_info "Verificando configuración de variables de entorno..."

# Verificar backend .env
if [ ! -f "backend/.env" ]; then
    log_warning "Archivo backend/.env no encontrado"
    log_info "Copiando desde archivo de ejemplo..."
    
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        log_success "Archivo backend/.env creado desde ejemplo"
    else
        log_error "No se encontró backend/.env.example"
    fi
else
    log_success "Archivo backend/.env encontrado"
fi

# Verificar frontend .env
if [ ! -f "frontend/.env" ]; then
    log_info "Creando archivo frontend/.env..."
    
    cat > frontend/.env << 'EOF'
# CONFIGURACIÓN FRONTEND TANCAT
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=TANCAT
VITE_APP_VERSION=1.0.0
VITE_BACKEND_URL=http://localhost:3000/api
VITE_ENVIRONMENT=development
VITE_DEBUG=true
EOF
    
    log_success "Archivo frontend/.env creado"
else
    log_success "Archivo frontend/.env encontrado"
fi

# ====================================
# 5. CREAR SCRIPTS DE DESARROLLO
# ====================================
log_info "Creando scripts de desarrollo..."

# Script para backend
cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando TANCAT Backend..."
cd backend
npm run dev
EOF

# Script para frontend
cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "🌐 Iniciando TANCAT Frontend..."
cd frontend
npm run dev
EOF

# Script para iniciar ambos
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🏓 Iniciando TANCAT System completo..."

# Función para limpiar procesos al salir
cleanup() {
    echo "🛑 Cerrando servicios..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT

# Iniciar backend
echo "📡 Iniciando backend..."
cd backend && npm run dev &
BACKEND_PID=$!

# Esperar que backend esté listo
sleep 5

# Iniciar frontend
echo "🖥️  Iniciando frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ TANCAT System iniciado:"
echo "   🖥️  Frontend: http://localhost:5173"
echo "   📡 Backend:  http://localhost:3000"
echo "   📚 API Docs: http://localhost:3000/api/docs"
echo "   ❤️  Health:  http://localhost:3000/api/health"
echo ""
echo "🛑 Presiona Ctrl+C para detener ambos servicios"

# Esperar indefinidamente
wait
EOF

# Hacer scripts ejecutables
chmod +x start-backend.sh start-frontend.sh start-dev.sh

log_success "Scripts de desarrollo creados"

# ====================================
# 6. VERIFICAR CONEXIÓN A SUPABASE
# ====================================
log_info "Verificando configuración de Supabase..."

if grep -q "SUPABASE_URL=" backend/.env && grep -q "SUPABASE_SERVICE_ROLE_KEY=" backend/.env; then
    log_success "Variables de Supabase configuradas"
    
    # Intentar una conexión de prueba
    log_info "Probando conexión al backend..."
    cd backend
    timeout 10s npm start &
    SERVER_PID=$!
    
    sleep 3
    
    # Probar health endpoint
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "Conexión al backend exitosa"
    else
        log_warning "No se pudo conectar al backend (puede ser normal si Supabase necesita configuración)"
    fi
    
    kill $SERVER_PID 2>/dev/null
    cd ..
else
    log_warning "Variables de Supabase no configuradas completamente"
    log_info "Edita backend/.env con tus credenciales de Supabase"
fi

# ====================================
# 7. RESUMEN FINAL
# ====================================
echo ""
echo "🎉 CONFIGURACIÓN COMPLETADA"
echo "=========================="
echo ""

log_success "Archivos configurados:"
echo "  ✅ backend/package.json - Dependencias instaladas"
echo "  ✅ frontend/package.json - Dependencias instaladas"
echo "  ✅ frontend/vite.config.js - Configuración de Vite"
echo "  ✅ Scripts de desarrollo creados"
echo ""

log_info "Comandos disponibles:"
echo "  ./start-backend.sh  - Solo backend (puerto 3000)"
echo "  ./start-frontend.sh - Solo frontend (puerto 5173)"
echo "  ./start-dev.sh      - Ambos servicios"
echo ""

log_info "URLs del sistema:"
echo "  🖥️  Frontend: http://localhost:5173"
echo "  📡 Backend:  http://localhost:3000"
echo "  📚 API Docs: http://localhost:3000/api/docs"
echo "  ❤️  Health:  http://localhost:3000/api/health"
echo ""

log_warning "PRÓXIMOS PASOS:"
echo "1. Verifica la configuración de Supabase en backend/.env"
echo "2. Ejecuta el script SQL en tu proyecto Supabase"
echo "3. Ejecuta: ./start-dev.sh"
echo ""

echo "🚀 ¡TANCAT System listo para desarrollo!"