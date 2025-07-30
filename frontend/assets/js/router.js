/**
 * TANCAT - Sistema de Administración Frontend
 * Archivo: assets/js/router.js
 * Descripción: Router SPA para navegación sin /api en URLs
 */

// ====================================
// CONFIGURACIÓN DEL ROUTER
// ====================================
class TancatRouter {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.isNavigating = false;
        
        // Configuración
        this.config = {
            baseUrl: window.location.origin,
            apiUrl: '/api',
            defaultRoute: '/',
            errorRoute: '/error',
            loadingClass: 'page-loading'
        };
        
        this.init();
    }

    // ====================================
    // INICIALIZACIÓN
    // ====================================
    init() {
        this.setupEventListeners();
        this.defineRoutes();
        this.handleInitialRoute();
        
        console.log('🚀 TANCAT Router inicializado');
    }

    setupEventListeners() {
        // Interceptar clics en enlaces
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && this.shouldInterceptLink(link)) {
                e.preventDefault();
                const href = link.getAttribute('href');
                this.navigate(href);
            }
        });

        // Manejar botones atrás/adelante del navegador
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });

        // Manejar errores de carga
        window.addEventListener('error', (e) => {
            console.error('❌ Error de aplicación:', e.error);
        });
    }

    shouldInterceptLink(link) {
        const href = link.getAttribute('href');
        
        // No interceptar si:
        if (!href || 
            href.startsWith('http') || 
            href.startsWith('//') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('#') ||
            link.hasAttribute('download') ||
            link.getAttribute('target') === '_blank') {
            return false;
        }
        
        return true;
    }

    // ====================================
    // DEFINICIÓN DE RUTAS
    // ====================================
    defineRoutes() {
        // Rutas públicas
        this.addRoute('/', {
            component: 'LoginPage',
            title: 'TANCAT - Iniciar Sesión',
            public: true,
            redirectIfAuth: '/dashboard'
        });

        // Rutas privadas - Dashboard
        this.addRoute('/dashboard', {
            component: 'DashboardPage',
            title: 'TANCAT - Dashboard',
            requireAuth: true
        });

        // Rutas privadas - Módulos
        this.addRoute('/reservas', {
            component: 'ReservasPage',
            title: 'TANCAT - Reservas',
            requireAuth: true,
            permissions: ['reservas.read']
        });

        this.addRoute('/clientes', {
            component: 'ClientesPage',
            title: 'TANCAT - Clientes',
            requireAuth: true,
            permissions: ['clientes.read']
        });

        this.addRoute('/ventas', {
            component: 'VentasPage',
            title: 'TANCAT - Ventas',
            requireAuth: true,
            permissions: ['ventas.read']
        });

        this.addRoute('/torneos', {
            component: 'TorneosPage',
            title: 'TANCAT - Torneos',
            requireAuth: true,
            permissions: ['torneos.read']
        });

        this.addRoute('/inventario', {
            component: 'InventarioPage',
            title: 'TANCAT - Inventario',
            requireAuth: true,
            permissions: ['inventario.read']
        });

        this.addRoute('/reportes', {
            component: 'ReportesPage',
            title: 'TANCAT - Reportes',
            requireAuth: true,
            permissions: ['reportes.read']
        });

        // Rutas de error
        this.addRoute('/error', {
            component: 'ErrorPage',
            title: 'TANCAT - Error',
            public: true
        });

        this.addRoute('/404', {
            component: 'NotFoundPage',
            title: 'TANCAT - Página no encontrada',
            public: true
        });
    }

    addRoute(path, config) {
        this.routes.set(path, {
            path,
            component: config.component,
            title: config.title || 'TANCAT',
            requireAuth: config.requireAuth || false,
            permissions: config.permissions || [],
            public: config.public || false,
            redirectIfAuth: config.redirectIfAuth || null,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null
        });
    }

    // ====================================
    // NAVEGACIÓN
    // ====================================
    async navigate(path, options = {}) {
        if (this.isNavigating) return;
        
        this.isNavigating = true;
        
        try {
            // Normalizar path
            path = this.normalizePath(path);
            
            // Verificar si la ruta existe
            const route = this.routes.get(path) || this.routes.get('/404');
            
            // Middleware de autenticación
            const authCheck = await this.checkAuthentication(route);
            if (!authCheck.allowed) {
                this.isNavigating = false;
                return this.navigate(authCheck.redirect);
            }
            
            // Middleware de permisos
            const permissionCheck = await this.checkPermissions(route);
            if (!permissionCheck.allowed) {
                this.isNavigating = false;
                this.showAccessDenied();
                return;
            }
            
            // Ejecutar beforeEnter si existe
            if (route.beforeEnter) {
                const beforeResult = await route.beforeEnter(route, this.currentRoute);
                if (beforeResult === false) {
                    this.isNavigating = false;
                    return;
                }
            }
            
            // Mostrar loading
            this.showLoading();
            
            // Cargar componente
            await this.loadComponent(route);
            
            // Actualizar historial del navegador
            if (!options.replace) {
                history.pushState({ path }, route.title, path);
            } else {
                history.replaceState({ path }, route.title, path);
            }
            
            // Actualizar título
            document.title = route.title;
            
            // Actualizar ruta actual
            this.currentRoute = route;
            
            // Ejecutar afterEnter si existe
            if (route.afterEnter) {
                await route.afterEnter(route);
            }
            
            // Ocultar loading
            this.hideLoading();
            
            console.log(`🧭 Navegado a: ${path}`);
            
        } catch (error) {
            console.error('❌ Error en navegación:', error);
            this.navigate('/error');
        } finally {
            this.isNavigating = false;
        }
    }

    normalizePath(path) {
        // Remover query params y hash para matching
        return path.split('?')[0].split('#')[0] || '/';
    }

    handleInitialRoute() {
        const currentPath = window.location.pathname;
        this.navigate(currentPath, { replace: true });
    }

    handlePopState(e) {
        const path = e.state?.path || window.location.pathname;
        this.navigate(path, { replace: true });
    }

    // ====================================
    // AUTENTICACIÓN Y PERMISOS
    // ====================================
    async checkAuthentication(route) {
        // Si es ruta pública, permitir
        if (route.public) {
            // Si está autenticado y hay redirect, redirigir
            if (route.redirectIfAuth && await window.authService.isAuthenticated()) {
                return { allowed: false, redirect: route.redirectIfAuth };
            }
            return { allowed: true };
        }
        
        // Si requiere auth, verificar
        if (route.requireAuth) {
            const isAuth = await window.authService.isAuthenticated();
            if (!isAuth) {
                return { allowed: false, redirect: '/' };
            }
        }
        
        return { allowed: true };
    }

    async checkPermissions(route) {
        if (!route.permissions || route.permissions.length === 0) {
            return { allowed: true };
        }
        
        try {
            const userPermissions = await window.authService.getPermissions();
            const hasPermission = route.permissions.some(permission => 
                userPermissions.includes(permission)
            );
            
            return { allowed: hasPermission };
        } catch (error) {
            console.error('❌ Error verificando permisos:', error);
            return { allowed: false };
        }
    }

    // ====================================
    // CARGA DE COMPONENTES
    // ====================================
    async loadComponent(route) {
        const container = document.getElementById('app-container') || document.body;
        
        try {
            // Intentar cargar componente específico
            const componentHtml = await this.loadComponentHtml(route.component);
            container.innerHTML = componentHtml;
            
            // Ejecutar JavaScript del componente
            await this.executeComponentScript(route.component);
            
        } catch (error) {
            console.error(`❌ Error cargando componente ${route.component}:`, error);
            // Fallback a página de error
            container.innerHTML = this.getErrorPageHtml(error.message);
        }
    }

    async loadComponentHtml(componentName) {
        const componentPath = `/pages/${componentName.toLowerCase().replace('page', '')}.html`;
        
        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.warn(`⚠️ No se pudo cargar ${componentPath}, usando fallback`);
            return this.getComponentFallback(componentName);
        }
    }

    async executeComponentScript(componentName) {
        const scriptPath = `/assets/js/pages/${componentName.toLowerCase().replace('page', '')}.js`;
        
        try {
            // Verificar si ya está cargado
            if (document.querySelector(`script[src="${scriptPath}"]`)) {
                return;
            }
            
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = true;
            
            return new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => {
                    console.warn(`⚠️ Script opcional ${scriptPath} no encontrado`);
                    resolve(); // No fallar por scripts opcionales
                };
                document.head.appendChild(script);
            });
            
        } catch (error) {
            console.warn(`⚠️ Error cargando script ${scriptPath}:`, error);
        }
    }

    getComponentFallback(componentName) {
        const fallbacks = {
            'LoginPage': this.getLoginPageHtml(),
            'DashboardPage': this.getDashboardPageHtml(),
            'ErrorPage': this.getErrorPageHtml(),
            'NotFoundPage': this.getNotFoundPageHtml()
        };
        
        return fallbacks[componentName] || fallbacks['NotFoundPage'];
    }

    // ====================================
    // PÁGINAS FALLBACK
    // ====================================
    getLoginPageHtml() {
        return `
            <div class="login-container">
                <div class="logo-container">
                    <div class="logo">TANCAT</div>
                    <div class="subtitle">Sistema de Administración</div>
                </div>
                <div class="welcome-text">
                    <h2>Iniciar Sesión</h2>
                    <p>Accede al sistema de gestión del complejo deportivo</p>
                </div>
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email">Email o Usuario</label>
                        <input type="text" id="email" name="email" placeholder="Ingresa tu email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Contraseña</label>
                        <input type="password" id="password" name="password" placeholder="Ingresa tu contraseña" required>
                    </div>
                    <button type="submit" class="login-btn">Ingresar al Sistema</button>
                </form>
                <div id="login-error" class="error-message" style="display: none;"></div>
            </div>
        `;
    }

    getDashboardPageHtml() {
        return `
            <div class="dashboard-container">
                <header class="dashboard-header">
                    <div class="header-content">
                        <div class="logo-section">
                            <h1>TANCAT</h1>
                            <span class="system-subtitle">Sistema de Administración</span>
                        </div>
                        <div class="user-section">
                            <div class="user-info">
                                <span class="user-name" id="userName">Cargando...</span>
                                <span class="user-role" id="userRole">...</span>
                            </div>
                            <button class="btn btn-danger" onclick="window.authService.logout()">
                                🚪 Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </header>
                
                <nav class="main-navigation">
                    <div class="nav-content">
                        <button class="nav-item active" onclick="router.navigate('/dashboard')">🏠 Dashboard</button>
                        <button class="nav-item" onclick="router.navigate('/reservas')">📅 Reservas</button>
                        <button class="nav-item" onclick="router.navigate('/clientes')">👥 Clientes</button>
                        <button class="nav-item" onclick="router.navigate('/ventas')">💰 Ventas</button>
                        <button class="nav-item" onclick="router.navigate('/torneos')">🏆 Torneos</button>
                        <button class="nav-item" onclick="router.navigate('/inventario')">📦 Inventario</button>
                        <button class="nav-item" onclick="router.navigate('/reportes')">📊 Reportes</button>
                    </div>
                </nav>
                
                <main class="dashboard-main">
                    <h2>Dashboard Principal</h2>
                    <p>Bienvenido al sistema de administración TANCAT</p>
                    <div class="loading-message">Cargando contenido del dashboard...</div>
                </main>
            </div>
        `;
    }

    getErrorPageHtml(message = 'Error desconocido') {
        return `
            <div class="error-container">
                <div class="error-content">
                    <h1>❌ Error</h1>
                    <p>Ha ocurrido un error en la aplicación:</p>
                    <div class="error-details">${message}</div>
                    <div class="error-actions">
                        <button onclick="router.navigate('/dashboard')" class="btn btn-primary">
                            Ir al Dashboard
                        </button>
                        <button onclick="window.location.reload()" class="btn btn-secondary">
                            Recargar Página
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getNotFoundPageHtml() {
        return `
            <div class="error-container">
                <div class="error-content">
                    <h1>🔍 404 - Página no encontrada</h1>
                    <p>La página que buscas no existe o ha sido movida.</p>
                    <div class="error-actions">
                        <button onclick="router.navigate('/dashboard')" class="btn btn-primary">
                            Ir al Dashboard
                        </button>
                        <button onclick="history.back()" class="btn btn-secondary">
                            Volver Atrás
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ====================================
    // UI HELPERS
    // ====================================
    showLoading() {
        document.body.classList.add(this.config.loadingClass);
        
        // Crear overlay de loading si no existe
        if (!document.getElementById('router-loading')) {
            const loading = document.createElement('div');
            loading.id = 'router-loading';
            loading.innerHTML = `
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Cargando...</div>
                </div>
            `;
            document.body.appendChild(loading);
        }
    }

    hideLoading() {
        document.body.classList.remove(this.config.loadingClass);
        
        const loading = document.getElementById('router-loading');
        if (loading) {
            loading.remove();
        }
    }

    showAccessDenied() {
        const container = document.getElementById('app-container') || document.body;
        container.innerHTML = `
            <div class="access-denied-container">
                <div class="access-denied-content">
                    <h1>🚫 Acceso Denegado</h1>
                    <p>No tienes permisos para acceder a esta sección.</p>
                    <div class="error-actions">
                        <button onclick="router.navigate('/dashboard')" class="btn btn-primary">
                            Ir al Dashboard
                        </button>
                        <button onclick="history.back()" class="btn btn-secondary">
                            Volver Atrás
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ====================================
    // API HELPERS
    // ====================================
    getApiUrl(endpoint) {
        return `${this.config.apiUrl}${endpoint}`;
    }

    // ====================================
    // UTILIDADES PÚBLICAS
    // ====================================
    getCurrentRoute() {
        return this.currentRoute;
    }

    isCurrentRoute(path) {
        return this.currentRoute?.path === path;
    }

    getRoutes() {
        return Array.from(this.routes.values());
    }
}

// ====================================
// INICIALIZACIÓN GLOBAL
// ====================================
window.router = new TancatRouter();

// Exponer para uso global
window.navigateTo = (path) => window.router.navigate(path);