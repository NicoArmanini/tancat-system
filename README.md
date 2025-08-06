# 🏓 TANCAT - Sistema de Administración

Sistema completo de administración para Complejo Deportivo TANCAT con backend Node.js/Express y frontend vanilla JavaScript conectados a base de datos Neon PostgreSQL.

## 🚀 Inicio Rápido

### 1. Clonar y Configurar

```bash
# Clonar el repositorio
git clone https://github.com/NicoArmanini/tancat_system.git
cd tancat_system

# Instalar dependencias
npm run setup
```

### 2. Iniciar el Sistema

```bash
# Inicia backend y frontend automáticamente
npm start
```

## 📋 URLs del Sistema

- 🌐 **Frontend:** http://localhost:5173
- 🔧 **Backend:** http://localhost:3000  
- 📚 **API Docs:** http://localhost:3000/api/docs
- 🏥 **Health Check:** http://localhost:3000/api/health

## 🏗️ Arquitectura del Proyecto

```
TANCAT-SYSTEM/
├── backend/                 # API Node.js/Express
│   ├── controllers/         # Controladores de rutas
│   ├── routes/             # Definición de rutas
│   ├── utils/              # Utilidades (database, etc.)
│   ├── server.js           # Punto de entrada
│   ├── app.js              # Configuración Express
│   └── .env                # Configuración (crear desde .env.example)
├── frontend/               # Cliente vanilla JavaScript  
│   ├── assets/
│   │   ├── js/
│   │   │   ├── apiClient.js    # Cliente API
│   │   │   └── cliente-main.js # Lógica principal
│   │   └── css/            # Estilos
│   ├── index.html          # Página principal
│   └── server.js           # Servidor estático
├── start-tancat.js         # Script de inicio automático
└── package.json            # Configuración del proyecto
```

## 🔌 API Endpoints

### Cliente (Público)
```http
GET    /api/cliente/sedes                    # Obtener sedes
GET    /api/cliente/deportes                 # Obtener deportes  
GET    /api/cliente/combinaciones-disponibles # Combinaciones sede-deporte
POST   /api/cliente/consulta-disponibilidad  # Consultar turnos
GET    /api/cliente/torneos                  # Torneos activos
```

### Administración (Protegido)
```http
GET    /api/admin/dashboard                  # Dashboard principal
GET    /api/reservas                        # Gestión de reservas
GET    /api/torneos                         # Gestión de torneos
GET    /api/inventario                      # Gestión de inventario
GET    /api/ventas                          # Gestión de ventas
```

## 🗄️ Base de Datos

### Estructura Principal
- **sedes** - Información de sedes del complejo
- **deportes** - Deportes disponibles
- **canchas** - Canchas por sede y deporte
- **turnos** - Horarios disponibles
- **reservas** - Reservas realizadas
- **clientes** - Información de clientes
- **productos** - Inventario y productos
- **torneos** - Torneos organizados

## 🛠️ Comandos Disponibles

```bash
# Desarrollo
npm start              # Inicia backend + frontend
npm run backend        # Solo backend
npm run frontend       # Solo frontend

# Instalación y configuración  
npm run setup          # Instala todas las dependencias
npm run install:all    # Instala dependencias por separado
npm run clean          # Limpia instalaciones

# Base de datos
npm run db:migrate     # Ejecutar migraciones
npm run db:seed        # Poblar con datos iniciales
npm run db:setup       # Migrar + poblar

# Utilidades
npm run check          # Verificar versiones Node/NPM
npm run help           # Mostrar comandos disponibles
```

## 🔧 Desarrollo

### Backend (Node.js/Express)

**Tecnologías:**
- Express.js con middleware de seguridad
- PostgreSQL con Neon  
- Swagger para documentación API
- Validación con express-validator
- Rate limiting y CORS

**Estructura:**
```
backend/
├── controllers/        # Lógica de negocio
├── routes/            # Definición de endpoints
├── middleware/        # Middleware personalizado
├── utils/             # Utilidades (DB, validación)
└── uploads/           # Archivos subidos
```

### Frontend (Vanilla JavaScript)

**Tecnologías:**
- JavaScript ES6+ vanilla
- CSS moderno con variables CSS
- Fetch API para comunicación
- Responsive design

**Características:**
- ✅ Conexión en tiempo real al backend
- ✅ Manejo de errores y reconexión
- ✅ Cache inteligente de consultas
- ✅ UI responsiva y moderna
- ✅ Estados de carga y feedback

## 🌐 Funcionalidades

### Cliente (Público)
- **Consulta de Sedes:** Información y horarios en tiempo real
- **Disponibilidad:** Consulta de turnos disponibles por fecha
- **Deportes:** Lista de deportes y canchas disponibles  
- **Torneos:** Información de torneos activos
- **Responsive:** Funciona en móviles, tablets y desktop

### Administración
- **Dashboard:** Resumen de actividad y estadísticas
- **Reservas:** Gestión completa de reservas
- **Inventario:** Control de stock y productos
- **Ventas:** Registro y seguimiento de ventas
- **Torneos:** Organización y gestión de torneos
- **Reportes:** Análisis y reportes detallados

## 🔒 Seguridad

- **CORS** configurado para dominios específicos
- **Rate Limiting** para prevenir abuso de API
- **Helmet** para headers de seguridad
- **Validación** de entrada en todas las rutas
- **Sanitización** de datos
- **Variables de entorno** para configuración sensible

## 📊 Monitoreo

### Health Checks
```bash
curl http://localhost:3000/api/health
```

### Logs en Desarrollo
- Consultas SQL lentas (>1s)
- Conexiones de base de datos
- Errores detallados con stack trace
- Rate limiting y intentos de conexión

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 📞 Soporte

- **GitHub Issues:** [Reportar problema](https://github.com/NicoArmanini/Sistema_Gestion_Complejo_Deportivo/issues)
- **Documentación:** Ver `/docs` para más detalles
- **API Docs:** http://localhost:3000/api/docs cuando el servidor esté corriendo

## 🎯 Roadmap

### Próximas Funcionalidades
- [ ] Autenticación JWT completa
- [ ] Panel de administración avanzado
- [ ] Notificaciones en tiempo real
- [ ] Integración con pagos online
- [ ] App móvil React Native
- [ ] Dashboard con gráficos interactivos
- [ ] Sistema de membresías
- [ ] Integración con calendario externo

### Mejoras Técnicas
- [ ] Tests automatizados (Jest)
- [ ] CI/CD con GitHub Actions
- [ ] Docker containerization
- [ ] Redis para cache
- [ ] WebSockets para tiempo real
- [ ] Microservicios architecture

## 👨‍💻 Desarrollado por

**Nicolas Armanini - Tomas Lacamoire - Dario Rodriguez**
- Sistema diseñado para Complejo Deportivo TANCAT
- Córdoba, Argentina
- Desde 1991 al servicio del deporte

---

## 🔗 Enlaces Rápidos

- [🏠 Página Principal](http://localhost:5173)
- [🔧 API Backend](http://localhost:3000)
- [📚 Documentación API](http://localhost:3000/api/docs)
- [💾 GitHub Repository](https://github.com/NicoArmanini/Sistema_Gestion_Complejo_Deportivo)

---

**¡Gracias por usar TANCAT System! 🏓**
