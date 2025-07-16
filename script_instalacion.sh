#!/bin/bash

# ====================================
# TANCAT SYSTEM - SCRIPT DE INSTALACIÓN AUTOMATIZADA
# ====================================

echo "🏓 TANCAT SYSTEM - Instalación Automatizada"
echo "==========================================="

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

# Verificar si estamos en el directorio correcto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Por favor ejecuta este script desde la raíz del proyecto TANCAT-SYSTEM"
    exit 1
fi

# ====================================
# 1. VERIFICAR DEPENDENCIAS
# ====================================
log_info "Verificando dependencias del sistema..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js no está instalado. Instálalo desde https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_NODE_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    log_error "Node.js version $NODE_VERSION es menor que la requerida ($REQUIRED_NODE_VERSION)"
    exit 1
fi

log_success "Node.js $NODE_VERSION - OK"

# Verificar npm
if ! command -v npm &> /dev/null; then
    log_error "npm no está instalado"
    exit 1
fi

NPM_VERSION=$(npm --version)
log_success "npm $NPM_VERSION - OK"

# Verificar PostgreSQL (opcional)
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    log_success "PostgreSQL $PSQL_VERSION - OK"
else
    log_warning "PostgreSQL no detectado localmente. Asegurate de tener acceso a una base de datos PostgreSQL o usar Supabase"
fi

# ====================================
# 2. CONFIGURAR BACKEND
# ====================================
log_info "Configurando backend..."

cd backend

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    log_info "Creando archivo .env..."
    
    cat > .env << EOF
# TANCAT BACKEND - CONFIGURACIÓN
NODE_ENV=development
PORT=3000
HOST=localhost

# Base de Datos PostgreSQL Local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tancat_db
DB_USER=postgres
DB_PASSWORD=cambiar_password_aqui

# Supabase (Descomenta si usas Supabase)
# SUPABASE_URL=https://tu-proyecto.supabase.co
# SUPABASE_ANON_KEY=tu_anon_key_aqui
# SUPABASE_SERVICE_KEY=tu_service_key_aqui

# Seguridad
JWT_SECRET=tancat_super_secret_key_cambiar_en_produccion
JWT_EXPIRE=24h
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timezone
TZ=America/Argentina/Cordoba
EOF

    log_success "Archivo .env creado"
    log_warning "IMPORTANTE: Edita el archivo backend/.env con tus credenciales de base de datos"
else
    log_info "Archivo .env ya existe"
fi

# Instalar dependencias
log_info "Instalando dependencias del backend..."

npm install

if [ $? -eq 0 ]; then
    log_success "Dependencias del backend instaladas correctamente"
else
    log_error "Error al instalar dependencias del backend"
    exit 1
fi

cd ..

# ====================================
# 3. CONFIGURAR FRONTEND
# ====================================
log_info "Configurando frontend..."

cd frontend

# Verificar que cliente-main.js existe
if [ ! -f "assets/js/cliente-main.js" ]; then
    log_error "Archivo cliente-main.js no encontrado en frontend/assets/js/"
    exit 1
fi

# Actualizar configuración del frontend para conectar al backend
log_info "Configurando conexión frontend-backend..."

# Crear backup del archivo original
cp assets/js/cliente-main.js assets/js/cliente-main.js.backup

# Reemplazar MODO_OFFLINE: true por MODO_OFFLINE: false
sed -i.tmp 's/MODO_OFFLINE: true/MODO_OFFLINE: false/g' assets/js/cliente-main.js && rm assets/js/cliente-main.js.tmp 2>/dev/null || sed -i 's/MODO_OFFLINE: true/MODO_OFFLINE: false/g' assets/js/cliente-main.js

log_success "Frontend configurado para conectar al backend"

cd ..

# ====================================
# 4. CONFIGURAR BASE DE DATOS
# ====================================
log_info "Configuración de base de datos..."

echo ""
echo "Opciones para configurar la base de datos:"
echo "1) PostgreSQL Local"
echo "2) Supabase (Recomendado)"
echo "3) Omitir configuración de DB por ahora"
echo ""

read -p "Selecciona una opción (1-3): " DB_OPTION

case $DB_OPTION in
    1)
        log_info "Configuración PostgreSQL Local seleccionada"
        log_warning "Asegurate de que PostgreSQL esté ejecutándose y de configurar las credenciales en backend/.env"
        
        # Preguntar si crear la base de datos
        read -p "¿Quieres crear la base de datos 'tancat_db' ahora? (y/n): " CREATE_DB
        
        if [ "$CREATE_DB" = "y" ] || [ "$CREATE_DB" = "Y" ]; then
            log_info "Creando base de datos..."
            
            # Intentar crear la base de datos
            createdb tancat_db 2>/dev/null
            
            if [ $? -eq 0 ]; then
                log_success "Base de datos 'tancat_db' creada"
            else
                log_warning "No se pudo crear la base de datos automáticamente. Créala manualmente con: createdb tancat_db"
            fi
        fi
        ;;
    2)
        log_info "Para usar Supabase:"
        echo "1. Ve a https://supabase.com y crea un proyecto"
        echo "2. Obtén las credenciales de tu proyecto"
        echo "3. Configúralas en backend/.env"
        echo "4. Ejecuta el script SQL en el SQL Editor de Supabase"
        ;;
    3)
        log_info "Configuración de DB omitida"
        ;;
    *)
        log_warning "Opción inválida. Configuración de DB omitida"
        ;;
esac

# ====================================
# 5. CREAR SCRIPTS DE EJECUCIÓN
# ====================================
log_info "Creando scripts de ejecución..."

# Script para iniciar el backend
cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando TANCAT Backend..."
cd backend
npm run dev
EOF

# Script para iniciar el frontend
cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "🌐 Iniciando TANCAT Frontend..."
cd frontend

# Verificar si http-server está instalado
if ! command -v http-server &> /dev/null; then
    echo "Instalando http-server..."
    npm install -g http-server
fi

echo "Frontend disponible en: http://localhost:5500"
http-server -p 5500 -c-1
EOF

# Script para iniciar ambos servicios
cat > start-all.sh << 'EOF'
#!/bin/bash
echo "🏓 Iniciando TANCAT System completo..."

# Función para manejar Ctrl+C
cleanup() {
    echo "Cerrando servicios..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT

# Iniciar backend en background
echo "Iniciando backend..."
cd backend && npm run dev &
BACKEND_PID=$!

# Esperar un poco para que el backend inicie
sleep 3

# Iniciar frontend en background
echo "Iniciando frontend..."
cd ../frontend

# Verificar si http-server está instalado
if ! command -v http-server &> /dev/null; then
    echo "Instalando http-server..."
    npm install -g http-server
fi

http-server -p 5500 -c-1 &
FRONTEND_PID=$!

echo ""
echo "✅ TANCAT System iniciado:"
echo "   🖥️  Frontend: http://localhost:5500"
echo "   🔧 Backend:  http://localhost:3000"
echo "   📚 API Docs: http://localhost:3000/api/docs"
echo ""
echo "Presiona Ctrl+C para detener ambos servicios"

# Esperar indefinidamente
wait
EOF

# Hacer scripts ejecutables
chmod +x start-backend.sh start-frontend.sh start-all.sh

log_success "Scripts de ejecución creados"

# ====================================
# 6. CREAR ARCHIVOS FALTANTES
# ====================================
log_info "Verificando estructura de archivos..."

# Crear directorios que podrían faltar
mkdir -p backend/controllers
mkdir -p backend/routes  
mkdir -p backend/services
mkdir -p backend/middleware
mkdir -p backend/utils
mkdir -p backend/uploads
mkdir -p backend/logs

# ====================================
# 7. VERIFICAR INSTALACIÓN
# ====================================
log_info "Verificando instalación..."

cd backend

# Verificar que las dependencias estén instaladas
if [ -d "node_modules" ] && [ -f "package.json" ]; then
    log_success "Dependencias del backend instaladas"
else
    log_error "Problema con las dependencias del backend"
fi

# Verificar archivos críticos
REQUIRED_FILES=(
    "server.js"
    "app.js"
    ".env"
    "package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file - OK"
    else
        log_warning "$file - FALTANTE (necesitas crearlo)"
    fi
done

cd ..

# ====================================
# 8. RESUMEN E INSTRUCCIONES FINALES
# ====================================
echo ""
echo "🎉 INSTALACIÓN COMPLETADA"
echo "========================"
echo ""

log_success "Scripts de ejecución creados:"
echo "  • ./start-backend.sh  - Solo backend"
echo "  • ./start-frontend.sh - Solo frontend"  
echo "  • ./start-all.sh      - Ambos servicios"
echo ""

log_info "Próximos pasos:"
echo "1. Configura tus credenciales de DB en backend/.env"
echo "2. Si usas PostgreSQL local, ejecuta el script SQL para crear las tablas"
echo "3. Si usas Supabase, ejecuta el script SQL en su interfaz web"
echo "4. Ejecuta: ./start-all.sh para iniciar el sistema completo"
echo ""

log_info "URLs del sistema:"
echo "  • Frontend: http://localhost:5500"
echo "  • Backend:  http://localhost:3000"
echo "  • API Docs: http://localhost:3000/api/docs"
echo "  • Health:   http://localhost:3000/api/health"
echo ""

log_warning "IMPORTANTE:"
echo "  • Edita backend/.env con tus credenciales reales"
echo "  • Configura tu base de datos antes de iniciar"
echo "  • El sistema iniciará en modo desarrollo"
echo ""

echo "¡TANCAT System está listo para funcionar! 🚀"