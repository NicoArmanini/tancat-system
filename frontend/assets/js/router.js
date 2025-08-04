/**
 * TANCAT - Router SPA
 * Archivo: router.js
 * Descripción: Sistema de routing para Single Page Application
 */

class TancatRouter {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.isNavigating = false;
        this.history = [];
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Definir rutas
        this.defineRoutes();
        
        console.log('🧭 Router TANCAT inicializado');
    }
    
    // ====================================
    // CONFIGURACIÓN DE RUTAS
    // ====================================
    
    defineRoutes() {
        // Rutas del cliente (públicas)
        this.addRoute('/', {
            title: 'TANCAT - Inicio',
            component: 'ClienteHome',
            layout: 'cliente',
            requiresAuth: false,
            meta: { description: 'Página principal del complejo deportivo TANCAT' }
        });
        
        this.addRoute('/inicio', {
            title: 'TANCAT - Inicio',
            component: 'ClienteHome',
            layout: 'cliente',
            requiresAuth: false,
            redirect: '/'
        });
        
        // Rutas de autenticación
        this.addRoute('/login', {
            title: 'TANCAT - Iniciar Sesión',
            component: 'Login',
            layout: 'auth',
            requiresAuth: false,
            meta: { description: 'Iniciar sesión en el sistema TANCAT' }
        });
        
        // Rutas de administración (protegidas)
        this.addRoute('/admin', {
            title: 'TANCAT - Dashboard',
            component: 'AdminDashboard',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado'],
            meta: { description: 'Panel de administración TANCAT' }
        });
        
        this.addRoute('/admin/dashboard', {
            title: 'TANCAT - Dashboard',
            component: 'AdminDashboard',
            layout: 'admin',
            requiresAuth: true,
            redirect: '/admin'
        });
        
        this.addRoute('/admin/reservas', {
            title: 'TANCAT - Gestión de Reservas',
            component: 'AdminReservas',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado']
        });
        
        this.addRoute('/admin/clientes', {
            title: 'TANCAT - Gestión de Clientes',
            component: 'AdminClientes',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado']
        });
        
        this.addRoute('/admin/ventas', {
            title: 'TANCAT - Gestión de Ventas',
            component: 'AdminVentas',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado']
        });
        
        this.addRoute('/admin/torneos', {
            title: 'TANCAT - Gestión de Torneos',
            component: 'AdminTorneos',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado']
        });
        
        this.addRoute('/admin/inventario', {
            title: 'TANCAT - Gestión de Inventario',
            component: 'AdminInventario',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin', 'empleado']
        });
        
        this.addRoute('/admin/reportes', {
            title: 'TANCAT - Reportes',
            component: 'AdminReportes',
            layout: 'admin',
            requiresAuth: true,
            roles: ['admin']
        });
        
        // Rutas de error
        this.addRoute('/404', {
            title: 'TANCAT - Página no encontrada',
            component: 'Error404',
            layout: 'error',
            requiresAuth: false
        });
        
        this.addRoute('/error', {
            title: 'TANCAT - Error',
            component: 'ErrorGeneral',
            layout: 'error',
            requiresAuth: false
        });
    }
    
    // ====================================
    // GESTIÓN DE RUTAS
    // ====================================
    
    addRoute(path, config) {
        this.routes.set(path, {
            path,
            title: config.title || 'TANCAT',
            component: config.component,
            layout: config.layout || 'default',
            requiresAuth: config.requiresAuth || false,
            roles: config.roles || [],
            meta: config.meta || {},
            redirect: config.redirect || null,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null
        });
    }
    
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }
    
    // ====================================
    // EVENT LISTENERS
    // ====================================
    
    setupEventListeners() {
        // Manejar navegación del navegador
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });
        
        // Interceptar clicks en enlaces
        document.addEventListener('click', (e) => {
            this.handleLinkClick(e);
        });
        
        // Manejar carga inicial
        document.addEventListener('DOMContentLoaded', () => {
            this.handleInitialLoad();
        });
    }
    
    handlePopState(e) {
        if (e.state && e.state.path) {
            this.navigateToPath(e.state.path, false);
        } else {
            this.navigateToPath(window.location.pathname, false);
        }
    }
    
    handleLinkClick(e) {
        const link = e.target.closest('a[href]');
        
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Ignorar enlaces externos o con target="_blank"
        if (!href || 
            href.startsWith('http') || 
            href.startsWith('mailto:') || 
            href.startsWith('tel:') ||
            link.target === '_blank') {
            return;
        }
        
        // Ignorar enlaces con data-external
        if (link.hasAttribute('data-external')) {
            return;
        }
        
        e.preventDefault();
        this.navigateTo(href);
    }
    
    handleInitialLoad() {
        const path = window.location.pathname;
        this.navigateToPath(path, false);
    }
    
    // ====================================
    // NAVEGACIÓN
    // ====================================
    
    async navigateTo(path, pushState = true) {
        if (this.isNavigating) {
            console.warn('🧭 Navegación en progreso, ignorando nueva navegación');
            return;
        }
        
        try {
            this.isNavigating = true;
            await this.navigateToPath(path, pushState);
        } finally {
            this.isNavigating = false;
        }
    }
    
    async navigateToPath(path, pushState = true) {
        try {
            // Normalizar path
            path = this.normalizePath(path);
            
            // Buscar ruta
            let route = this.findRoute(path);
            
            if (!route) {
                console.warn(`🧭 Ruta no encontrada: ${path}`);
                route = this.routes.get('/404');
                path = '/404';
            }
            
            // Manejar redirecciones
            if (route.redirect) {
                return this.navigateTo(route.redirect, pushState);
            }
            
            // Ejecutar middlewares
            const middlewareResult = await this.executeMiddlewares(route, path);
            if (!middlewareResult.continue) {
                if (middlewareResult.redirect) {
                    return this.navigateTo(middlewareResult.redirect, pushState);
                }
                return;
            }
            
            // Verificar autenticación
            const authResult = await this.checkAuthentication(route);
            if (!authResult.allowed) {
                return this.navigateTo(authResult.redirect || '/login', pushState);
            }
            
            // Ejecutar beforeEnter hook
            if (route.beforeEnter) {
                const beforeResult = await route.beforeEnter(route, path);
                if (beforeResult === false) {
                    return;
                }
                if (typeof beforeResult === 'string') {
                    return this.navigateTo(beforeResult, pushState);
                }
            }
            
            // Actualizar historial del navegador
            if (pushState) {
                history.pushState({ path }, route.title, path);
            }
            
            // Actualizar título de la página
            document.title = route.title;
            
            // Actualizar meta tags
            this.updateMetaTags(route.meta);
            
            // Cargar componente
            await this.loadComponent(route, path);
            
            // Actualizar ruta actual
            this.currentRoute = { ...route, path };
            this.history.push(path);
            
            // Ejecutar afterEnter hook
            if (route.afterEnter) {
                await route.afterEnter(route, path);
            }
            
            // Emitir evento de navegación
            this.emitNavigationEvent(route, path);
            
            console.log(`🧭 Navegación exitosa a: ${path}`);
            
        } catch (error) {
            console.error('🧭 Error durante la navegación:', error);
            this.navigateTo('/error', false);
        }
    }
    
    // ====================================
    // UTILIDADES
    // ====================================
    
    normalizePath(path) {
        // Remover parámetros de consulta para el matching
        const cleanPath = path.split('?')[0].split('#')[0];
        
        // Asegurar que empiece con /
        return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    }
    
    findRoute(path) {
        // Buscar coincidencia exacta primero
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }
        
        // Buscar rutas con parámetros (implementación básica)
        for (const [routePath, route] of this.routes) {
            if (this.matchesRoute(path, routePath)) {
                return route;
            }
        }
        
        return null;
    }
    
    matchesRoute(path, routePath) {
        // Implementación básica de matching de rutas
        // Para rutas dinámicas como /admin/:id
        const pathSegments = path.split('/');
        const routeSegments = routePath.split('/');
        
        if (pathSegments.length !== routeSegments.length) {
            return false;
        }
        
        return routeSegments.every((segment, index) => {
            return segment.startsWith(':') || segment === pathSegments[index];
        });
    }
    
    extractParams(path, routePath) {
        const pathSegments = path.split('/');
        const routeSegments = routePath.split('/');
        const params = {};
        
        routeSegments.forEach((segment, index) => {
            if (segment.startsWith(':')) {
                const paramName = segment.slice(1);
                params[paramName] = pathSegments[index];
            }
        });
        
        return params;
    }
    
    // ====================================
    // MIDDLEWARES Y AUTENTICACIÓN
    // ====================================
    
    async executeMiddlewares(route, path) {
        for (const middleware of this.middlewares) {
            try {
                const result = await middleware(route, path);
                if (result && !result.continue) {
                    return result;
                }
            } catch (error) {
                console.error('🧭 Error en middleware:', error);
                return { continue: false, redirect: '/error' };
            }
        }
        
        return { continue: true };
    }
    
    async checkAuthentication(route) {
        if (!route.requiresAuth) {
            return { allowed: true };
        }
        
        // Verificar si el usuario está autenticado
        if (!window.authService || !await window.authService.isAuthenticated()) {
            return { allowed: false, redirect: '/login' };
        }
        
        // Verificar roles si están especificados
        if (route.roles && route.roles.length > 0) {
            const user = await window.authService.getCurrentUser();
            if (!user || !route.roles.includes(user.role)) {
                return { allowed: false, redirect: '/' };
            }
        }
        
        return { allowed: true };
    }
    
    // ====================================
    // CARGA DE COMPONENTES
    // ====================================
    
    async loadComponent(route, path) {
        try {
            // Mostrar indicador de carga
            this.showLoadingIndicator();
            
            // Cargar layout si es necesario
            await this.loadLayout(route.layout);
            
            // Cargar componente específico
            const componentModule = await this.loadComponentModule(route.component);
            
            // Renderizar componente
            await this.renderComponent(componentModule, route, path);
            
            // Ocultar indicador de carga
            this.hideLoadingIndicator();
            
        } catch (error) {
            console.error('🧭 Error cargando componente:', error);
            this.hideLoadingIndicator();
            throw error;
        }
    }
    
    async loadLayout(layoutName) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        // Por ahora, usar layouts simples
        // En una implementación más compleja, podrías cargar layouts dinámicamente
        mainContent.className = `layout-${layoutName}`;
    }
    
    async loadComponentModule(componentName) {
        try {
            // Cargar módulo del componente dinámicamente
            const module = await import(`./components/${componentName}.js`);
            return module.default || module;
        } catch (error) {
            console.warn(`🧭 No se pudo cargar módulo ${componentName}, usando fallback`);
            
            // Fallback a componente básico
            return {
                render: () => `
                    <div class="component-fallback">
                        <h2>Componente en desarrollo</h2>
                        <p>El componente <strong>${componentName}</strong> está siendo desarrollado.</p>
                    </div>
                `
            };
        }
    }
    
    async renderComponent(component, route, path) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        // Limpiar contenido anterior
        mainContent.innerHTML = '';
        
        // Renderizar nuevo componente
        if (typeof component.render === 'function') {
            const html = await component.render(route, path);
            mainContent.innerHTML = html;
        } else if (typeof component === 'string') {
            mainContent.innerHTML = component;
        } else {
            mainContent.innerHTML = '<div>Error: Componente inválido</div>';
        }
        
        // Ejecutar inicialización del componente si existe
        if (typeof component.init === 'function') {
            await component.init(route, path);
        }
        
        // Mostrar contenido principal
        mainContent.style.display = 'block';
    }
    
    // ====================================
    // INDICADORES DE CARGA
    // ====================================
    
    showLoadingIndicator() {
        const existingIndicator = document.getElementById('route-loading');
        if (existingIndicator) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'route-loading';
        indicator.innerHTML = `
            <div class="route-loading-overlay">
                <div class="route-loading-spinner"></div>
            </div>
        `;
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(44, 62, 80, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9998;
        `;
        
        document.body.appendChild(indicator);
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('route-loading');
        if (indicator) {
            indicator.remove();
        }
        
        // Ocultar pantalla de carga inicial
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
    
    // ====================================
    // META TAGS Y SEO
    // ====================================
    
    updateMetaTags(meta) {
        if (meta.description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = meta.description;
        }
        
        if (meta.keywords) {
            let metaKeywords = document.querySelector('meta[name="keywords"]');
            if (!metaKeywords) {
                metaKeywords = document.createElement('meta');
                metaKeywords.name = 'keywords';
                document.head.appendChild(metaKeywords);
            }
            metaKeywords.content = meta.keywords;
        }
    }
    
    // ====================================
    // EVENTOS
    // ====================================
    
    emitNavigationEvent(route, path) {
        const event = new CustomEvent('routeChanged', {
            detail: { route, path }
        });
        window.dispatchEvent(event);
    }
    
    // ====================================
    // API PÚBLICA
    // ====================================
    
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    getCurrentPath() {
        return window.location.pathname;
    }
    
    goBack() {
        if (this.history.length > 1) {
            this.history.pop(); // Remover página actual
            const previousPath = this.history[this.history.length - 1];
            this.navigateTo(previousPath);
        } else {
            this.navigateTo('/');
        }
    }
    
    refresh() {
        this.navigateToPath(this.getCurrentPath(), false);
    }
}

// ====================================
// EXPORTAR E INICIALIZAR
// ====================================

// Crear instancia global del router
window.router = new TancatRouter();

// Función global para navegación
window.navigateTo = (path) => {
    window.router.navigateTo(path);
};

// Exportar para uso en módulos
export default window.router;