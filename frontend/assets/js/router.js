/**
 * TANCAT - Sistema de Administración
 * Archivo: router.js
 * Descripción: Sistema de navegación y ruteo SPA
 */

import authService from './authService.js';

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentController = null;
        this.isNavigating = false;
        
        // Configurar rutas
        this.setupRoutes();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        console.log('🧭 Router inicializado con', this.routes.size, 'rutas');
    }
    
    // ====================================
    // CONFIGURACIÓN DE RUTAS
    // ====================================
    
    setupRoutes() {
        // Rutas públicas
        this.addRoute('/', {
            path: '/index.html',
            title: 'TANCAT - Inicio',
            public: true,
            redirectToLogin: true
        });
        
        this.addRoute('/login', {
            path: '/pages/login.html',
            title: 'TANCAT - Iniciar Sesión',
            public: true,
            controller: 'LoginController'
        });
        
        // Rutas protegidas
        this.addRoute('/dashboard', {
            path: '/pages/dashboard.html',
            title: 'TANCAT - Dashboard',
            controller: 'DashboardController',
            roles: ['administrador', 'encargado', 'empleado']
        });
        
        this.addRoute('/reservas', {
            path: '/pages/reservas.html',
            title: 'TANCAT - Reservas',
            controller: 'ReservasController',
            roles: ['administrador', 'encargado', 'empleado']
        });
        
        this.addRoute('/clientes', {
            path: '/pages/clientes.html',
            title: 'TANCAT - Clientes',
            controller: 'ClientesController',
            roles: ['administrador', 'encargado', 'empleado']
        });
        
        this.addRoute('/ventas', {
            path: '/pages/ventas.html',
            title: 'TANCAT - Ventas',
            controller: 'VentasController',
            roles: ['administrador', 'encargado', 'empleado']
        });
        
        this.addRoute('/torneos', {
            path: '/pages/torneos.html',
            title: 'TANCAT - Torneos',
            controller: 'TorneosController',
            roles: ['administrador', 'encargado']
        });
        
        // Rutas de configuración
        this.addRoute('/configuracion', {
            path: '/pages/configuracion.html',
            title: 'TANCAT - Configuración',
            controller: 'ConfiguracionController',
            roles: ['administrador']
        });
        
        // Ruta 404
        this.addRoute('/404', {
            path: '/pages/404.html',
            title: 'TANCAT - Página no encontrada',
            public: true
        });
    }
    
    addRoute(pattern, config) {
        this.routes.set(pattern, {
            pattern,
            ...config,
            public: config.public || false,
            roles: config.roles || []
        });
    }
    
    // ====================================
    // EVENT LISTENERS
    // ====================================
    
    setupEventListeners() {
        // Interceptar navegación del navegador
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });
        
        // Interceptar clicks en enlaces
        document.addEventListener('click', (event) => {
            this.handleLinkClick(event);
        });
        
        // Escuchar cambios de autenticación
        authService.onAuthChange((type, data) => {
            this.handleAuthChange(type, data);
        });
        
        // Manejar carga inicial
        window.addEventListener('load', () => {
            this.handleInitialLoad();
        });
    }
    
    handlePopState(event) {
        const path = this.getCurrentPath();
        console.log('🔙 Navegación hacia atrás/adelante:', path);
        this.navigateToPath(path, false); // false = no actualizar history
    }
    
    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Solo interceptar enlaces internos
        if (href && (href.startsWith('/') || href.startsWith('#'))) {
            event.preventDefault();
            
            if (href.startsWith('#')) {
                // Manejar navegación a secciones
                this.scrollToSection(href.substring(1));
            } else {
                // Navegación normal
                this.navigateTo(href);
            }
        }
    }
    
    handleAuthChange(type, data) {
        console.log('🔐 Cambio de autenticación:', type);
        
        if (type === 'logout') {
            // Redirigir a login al cerrar sesión
            this.navigateTo('/login');
        } else if (type === 'login') {
            // Redirigir a dashboard o página apropiada
            const redirectTo = data.user ? authService.getRedirectUrl() : '/dashboard';
            this.navigateTo(redirectTo);
        }
    }
    
    handleInitialLoad() {
        console.log('🚀 Carga inicial del router');
        
        const path = this.getCurrentPath();
        this.navigateToPath(path, false);
    }
    
    // ====================================
    // MÉTODOS DE NAVEGACIÓN
    // ====================================
    
    async navigateTo(path, pushState = true) {
        if (this.isNavigating) {
            console.warn('⚠️ Navegación en progreso, ignorando nueva navegación');
            return;
        }
        
        console.log('🧭 Navegando a:', path);
        
        try {
            this.isNavigating = true;
            await this.navigateToPath(path, pushState);
        } finally {
            this.isNavigating = false;
        }
    }
    
    async navigateToPath(path, pushState = true) {
        // Limpiar path
        path = this.cleanPath(path);
        
        // Buscar ruta correspondiente
        const route = this.findRoute(path);
        
        if (!route) {
            console.warn('❌ Ruta no encontrada:', path);
            return this.navigateTo('/404');
        }
        
        // Verificar autenticación y permisos
        const authCheck = await this.checkRouteAuth(route);
        if (!authCheck.allowed) {
            console.warn('🔒 Acceso denegado a:', path, authCheck.reason);
            return this.navigateTo(authCheck.redirectTo);
        }
        
        // Ejecutar navegación
        try {
            await this.executeNavigation(route, pushState);
            this.currentRoute = route;
        } catch (error) {
            console.error('❌ Error en navegación:', error);
            this.showNavigationError(error);
        }
    }
    
    async executeNavigation(route, pushState) {
        // Actualizar history si es necesario
        if (pushState && window.location.pathname !== route.path) {
            window.history.pushState({ path: route.pattern }, route.title, route.path);
        }
        
        // Actualizar título
        document.title = route.title;
        
        // Cargar contenido
        await this.loadRouteContent(route);
        
        // Inicializar controlador
        if (route.controller) {
            await this.initializeController(route.controller);
        }
        
        // Actualizar navegación activa
        this.updateActiveNavigation(route);
        
        console.log('✅ Navegación completada:', route.pattern);
    }
    
    // ====================================
    // CARGA DE CONTENIDO
    // ====================================
    
    async loadRouteContent(route) {
        const contentContainer = document.getElementById('app-content');
        
        if (!contentContainer) {
            console.warn('⚠️ Contenedor app-content no encontrado');
            return;
        }
        
        try {
            // Mostrar loading
            this.showLoading(contentContainer);
            
            // Cargar HTML
            const response = await fetch(route.path);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Extraer contenido del body
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            const bodyContent = tempDiv.querySelector('body')?.innerHTML || html;
            
            // Insertar contenido
            contentContainer.innerHTML = bodyContent;
            
            // Ejecutar scripts inline
            this.executeInlineScripts(contentContainer);
            
        } catch (error) {
            console.error('❌ Error cargando contenido:', error);
            this.showLoadError(contentContainer, error);
        }
    }
    
    executeInlineScripts(container) {
        const scripts = container.querySelectorAll('script');
        
        scripts.forEach(script => {
            if (script.src) {
                // Script externo - crear nuevo elemento
                const newScript = document.createElement('script');
                newScript.src = script.src;
                newScript.type = script.type || 'text/javascript';
                document.head.appendChild(newScript);
            } else {
                // Script inline - ejecutar
                try {
                    eval(script.textContent);
                } catch (error) {
                    console.error('❌ Error ejecutando script inline:', error);
                }
            }
            
            // Remover script original
            script.remove();
        });
    }
    
    // ====================================
    // CONTROLADORES
    // ====================================
    
    async initializeController(controllerName) {
        try {
            // Limpiar controlador anterior
            if (this.currentController && typeof this.currentController.destroy === 'function') {
                await this.currentController.destroy();
            }
            
            // Cargar nuevo controlador
            const controllerModule = await import(`./controllers/${controllerName}.js`);
            const ControllerClass = controllerModule.default;
            
            if (ControllerClass) {
                this.currentController = new ControllerClass();
                
                if (typeof this.currentController.init === 'function') {
                    await this.currentController.init();
                }
                
                console.log('✅ Controlador inicializado:', controllerName);
            }
            
        } catch (error) {
            console.error(`❌ Error cargando controlador ${controllerName}:`, error);
        }
    }
    
    // ====================================
    // AUTENTICACIÓN Y PERMISOS
    // ====================================
    
    async checkRouteAuth(route) {
        // Ruta pública
        if (route.public) {
            // Si está autenticado y es ruta de login, redirigir a dashboard
            if (route.redirectToLogin && authService.isAuthenticated()) {
                return {
                    allowed: false,
                    reason: 'Already authenticated',
                    redirectTo: '/dashboard'
                };
            }
            
            return { allowed: true };
        }
        
        // Verificar autenticación
        const isAuthenticated = await authService.verifySession();
        
        if (!isAuthenticated) {
            return {
                allowed: false,
                reason: 'Not authenticated',
                redirectTo: '/login'
            };
        }
        
        // Verificar permisos de rol
        if (route.roles && route.roles.length > 0) {
            const userRole = authService.getUserRole();
            
            if (!route.roles.includes(userRole)) {
                return {
                    allowed: false,
                    reason: 'Insufficient permissions',
                    redirectTo: '/dashboard' // Redirigir a página principal
                };
            }
        }
        
        return { allowed: true };
    }
    
    // ====================================
    // UTILIDADES
    // ====================================
    
    findRoute(path) {
        path = this.cleanPath(path);
        
        // Buscar coincidencia exacta
        for (const [pattern, route] of this.routes) {
            if (pattern === path) {
                return route;
            }
        }
        
        // Buscar coincidencia con parámetros (implementación básica)
        for (const [pattern, route] of this.routes) {
            if (this.matchPattern(pattern, path)) {
                return { ...route, params: this.extractParams(pattern, path) };
            }
        }
        
        return null;
    }
    
    matchPattern(pattern, path) {
        // Implementación simple de matching con parámetros
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        
        if (patternParts.length !== pathParts.length) {
            return false;
        }
        
        return patternParts.every((part, index) => {
            return part.startsWith(':') || part === pathParts[index];
        });
    }
    
    extractParams(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        const params = {};
        
        patternParts.forEach((part, index) => {
            if (part.startsWith(':')) {
                params[part.substring(1)] = pathParts[index];
            }
        });
        
        return params;
    }
    
    cleanPath(path) {
        // Remover query string y hash
        path = path.split('?')[0].split('#')[0];
        
        // Asegurar que empiece con /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remover / final excepto para root
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        return path;
    }
    
    getCurrentPath() {
        return window.location.pathname;
    }
    
    // ====================================
    // UI HELPERS
    // ====================================
    
    updateActiveNavigation(route) {
        // Actualizar navegación activa
        const navItems = document.querySelectorAll('[data-nav-item]');
        
        navItems.forEach(item => {
            const itemPath = item.getAttribute('data-nav-item');
            
            if (itemPath === route.pattern) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    scrollToSection(sectionId) {
        const element = document.getElementById(sectionId);
        
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
    
    showLoading(container) {
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Cargando...</p>
            </div>
        `;
    }
    
    showLoadError(container, error) {
        container.innerHTML = `
            <div class="error-container">
                <h2>Error al cargar la página</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()">Reintentar</button>
            </div>
        `;
    }
    
    showNavigationError(error) {
        console.error('Error de navegación:', error);
        
        // Mostrar notificación de error
        const notification = document.createElement('div');
        notification.className = 'navigation-error';
        notification.textContent = 'Error al navegar. Inténtalo de nuevo.';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    // ====================================
    // MÉTODOS PÚBLICOS
    // ====================================
    
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    goBack() {
        window.history.back();
    }
    
    goForward() {
        window.history.forward();
    }
    
    refresh() {
        const currentPath = this.getCurrentPath();
        this.navigateToPath(currentPath, false);
    }
    
    // ====================================
    // DEBUG
    // ====================================
    
    getDebugInfo() {
        return {
            currentRoute: this.currentRoute,
            currentPath: this.getCurrentPath(),
            routesCount: this.routes.size,
            isNavigating: this.isNavigating,
            hasController: !!this.currentController
        };
    }
}

// ====================================
// INSTANCIA GLOBAL
// ====================================
const router = new Router();

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.router = router;
    window.navigateTo = (path) => router.navigateTo(path);
    window.ROUTER_DEBUG = () => router.getDebugInfo();
}

export default router;
        
        this.addRoute('/inventario', {
            path: '/pages/inventario.html',
            title: 'TANCAT - Inventario',
            controller: 'InventarioController',
            roles: ['administrador', 'encargado']
        });
        
        this.addRoute('/reportes', {
            path: '/pages/reportes.html',
            title: 'TANCAT - Reportes',
            controller: 'ReportesController'});
    