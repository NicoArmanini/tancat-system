/**
 * TANCAT - Sistema de Administración
 * Archivo: app.js
 * Descripción: Aplicación principal del frontend
 */

import authService from './authService.js';
import apiClient from './apiClient.js';
import router from './router.js';

class TancatApp {
    constructor() {
        this.initialized = false;
        this.currentPage = null;
        this.globalState = {
            user: null,
            settings: {},
            notifications: []
        };
        
        console.log('🏓 TANCAT App iniciado');
    }
    
    // ====================================
    // INICIALIZACIÓN
    // ====================================
    
    async init() {
        if (this.initialized) {
            console.warn('⚠️ App ya inicializado');
            return;
        }
        
        try {
            console.log('🚀 Inicializando TANCAT App...');
            
            // Mostrar splash screen
            this.showSplashScreen();
            
            // Configurar variables de entorno
            this.setupEnvironment();
            
            // Inicializar servicios básicos
            await this.initializeServices();
            
            // Configurar event listeners globales
            this.setupGlobalEventListeners();
            
            // Verificar autenticación inicial
            await this.checkInitialAuth();
            
            // Inicializar router
            this.initializeRouter();
            
            // Configurar PWA
            this.setupPWA();
            
            // Ocultar splash screen
            this.hideSplashScreen();
            
            this.initialized = true;
            
            console.log('✅ TANCAT App inicializado correctamente');
            
            // Emitir evento de app lista
            this.emitAppEvent('ready');
            
        } catch (error) {
            console.error('❌ Error inicializando app:', error);
            this.showInitializationError(error);
        }
    }
    
    setupEnvironment() {
        // Configurar variables de entorno
        const env = {
            API_URL: import.meta.env?.VITE_API_URL || 'http://localhost:3000',
            APP_NAME: import.meta.env?.VITE_APP_NAME || 'TANCAT',
            VERSION: import.meta.env?.VITE_APP_VERSION || '1.0.0',
            ENVIRONMENT: import.meta.env?.VITE_ENVIRONMENT || 'development',
            DEBUG: import.meta.env?.VITE_DEBUG === 'true'
        };
        
        // Hacer disponible globalmente
        window.TANCAT_ENV = env;
        
        console.log('🔧 Entorno configurado:', env);
    }
    
    async initializeServices() {
        try {
            // Los servicios ya se inicializan automáticamente
            // Solo verificamos que estén listos
            
            console.log('📡 Verificando ApiClient...');
            const isApiReady = await apiClient.testConnection();
            
            if (!isApiReady) {
                console.warn('⚠️ Backend no disponible, continuando en modo offline');
            }
            
            console.log('🔐 Verificando AuthService...');
            // AuthService se inicializa automáticamente
            
            console.log('✅ Servicios inicializados');
            
        } catch (error) {
            console.error('❌ Error inicializando servicios:', error);
            throw error;
        }
    }
    
    async checkInitialAuth() {
        try {
            console.log('🔐 Verificando autenticación inicial...');
            
            if (authService.isAuthenticated()) {
                const isValid = await authService.verifySession();
                
                if (isValid) {
                    this.globalState.user = authService.getUser();
                    console.log('✅ Usuario autenticado:', this.globalState.user.email);
                } else {
                    console.log('❌ Sesión inválida, redirigiendo a login');
                    authService.clearSession();
                }
            } else {
                console.log('ℹ️ Usuario no autenticado');
            }
            
        } catch (error) {
            console.error('❌ Error verificando autenticación:', error);
            authService.clearSession();
        }
    }
    
    initializeRouter() {
        // El router ya se inicializa automáticamente
        console.log('🧭 Router inicializado');
    }
    
    // ====================================
    // EVENT LISTENERS GLOBALES
    // ====================================
    
    setupGlobalEventListeners() {
        // Errores globales
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });
        
        // Promesas rechazadas
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
        
        // Cambios de conexión
        window.addEventListener('online', () => {
            this.handleConnectionChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleConnectionChange(false);
        });
        
        // Cambios de tamaño de ventana
        window.addEventListener('resize', this.debounce(() => {
            this.handleWindowResize();
        }, 250));
        
        // Cambios de visibilidad de página
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Eventos de autenticación
        authService.onAuthChange((type, data) => {
            this.handleAuthChange(type, data);
        });
        
        // Atajos de teclado globales
        document.addEventListener('keydown', (event) => {
            this.handleGlobalKeydown(event);
        });
    }
    
    handleGlobalError(error) {
        console.error('❌ Error global:', error);
        
        // Determinar tipo de error
        if (error?.message?.includes('ChunkLoadError') || error?.message?.includes('Loading chunk')) {
            this.handleChunkLoadError();
        } else if (error?.status === 401 || error?.requiresLogin) {
            this.handleAuthError();
        } else {
            this.showErrorNotification('Error inesperado en la aplicación');
        }
    }
    
    handleConnectionChange(isOnline) {
        console.log(`🌐 Conexión ${isOnline ? 'restaurada' : 'perdida'}`);
        
        if (isOnline) {
            this.showSuccessNotification('Conexión restaurada');
            // Reintentar operaciones pendientes
            this.retryPendingOperations();
        } else {
            this.showWarningNotification('Sin conexión a internet');
        }
    }
    
    handleWindowResize() {
        // Emitir evento para componentes que necesiten reajustarse
        this.emitAppEvent('resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            console.log('📱 App en background');
        } else {
            console.log('📱 App en foreground');
            
            // Verificar sesión al volver al primer plano
            if (authService.isAuthenticated()) {
                authService.verifySession();
            }
        }
    }
    
    handleAuthChange(type, data) {
        console.log('🔐 Cambio de autenticación:', type);
        
        if (type === 'login') {
            this.globalState.user = data.user;
            this.showSuccessNotification(`Bienvenido, ${data.user.name || data.user.email}`);
        } else if (type === 'logout') {
            this.globalState.user = null;
            this.showInfoNotification('Sesión cerrada');
        }
        
        // Actualizar UI global
        this.updateGlobalUI();
    }
    
    handleGlobalKeydown(event) {
        // Ctrl/Cmd + /: Mostrar atajos de teclado
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
            event.preventDefault();
            this.showKeyboardShortcuts();
        }
        
        // Escape: Cerrar modales
        if (event.key === 'Escape') {
            this.closeAllModals();
        }
        
        // Ctrl/Cmd + K: Búsqueda global
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.openGlobalSearch();
        }
    }
    
    // ====================================
    // MANEJO DE ERRORES ESPECÍFICOS
    // ====================================
    
    handleChunkLoadError() {
        console.warn('⚠️ Error de carga de módulo, recargando página...');
        
        this.showWarningNotification('Actualizando aplicación...', {
            duration: 3000
        });
        
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
    
    handleAuthError() {
        console.warn('🔒 Error de autenticación, redirigiendo a login');
        
        authService.clearSession();
        router.navigateTo('/login');
        
        this.showErrorNotification('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // ====================================
    // NOTIFICACIONES
    // ====================================
    
    showNotification(message, type = 'info', options = {}) {
        const notification = {
            id: Date.now().toString(),
            message,
            type,
            timestamp: new Date(),
            duration: options.duration || 5000,
            persistent: options.persistent || false
        };
        
        this.globalState.notifications.push(notification);
        this.renderNotification(notification);
        
        // Auto-remover si no es persistente
        if (!notification.persistent) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, notification.duration);
        }
        
        return notification.id;
    }
    
    showErrorNotification(message, options = {}) {
        return this.showNotification(message, 'error', {
            duration: 8000,
            ...options
        });
    }
    
    showSuccessNotification(message, options = {}) {
        return this.showNotification(message, 'success', options);
    }
    
    showWarningNotification(message, options = {}) {
        return this.showNotification(message, 'warning', {
            duration: 6000,
            ...options
        });
    }
    
    showInfoNotification(message, options = {}) {
        return this.showNotification(message, 'info', options);
    }
    
    renderNotification(notification) {
        const container = this.getNotificationContainer();
        
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.setAttribute('data-notification-id', notification.id);
        
        element.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(notification.type)}</span>
                <span class="notification-message">${notification.message}</span>
                <button class="notification-close" onclick="window.tancatApp.removeNotification('${notification.id}')">
                    ×
                </button>
            </div>
        `;
        
        container.appendChild(element);
        
        // Animación de entrada
        setTimeout(() => {
            element.classList.add('notification-visible');
        }, 10);
    }
    
    removeNotification(id) {
        const element = document.querySelector(`[data-notification-id="${id}"]`);
        
        if (element) {
            element.classList.add('notification-removing');
            
            setTimeout(() => {
                element.remove();
            }, 300);
        }
        
        // Remover del estado
        this.globalState.notifications = this.globalState.notifications.filter(
            n => n.id !== id
        );
    }
    
    getNotificationContainer() {
        let container = document.getElementById('notification-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    getNotificationIcon(type) {
        const icons = {
            error: '❌',
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    // ====================================
    // SPLASH SCREEN
    // ====================================
    
    showSplashScreen() {
        const splash = document.createElement('div');
        splash.id = 'splash-screen';
        splash.className = 'splash-screen';
        
        splash.innerHTML = `
            <div class="splash-content">
                <div class="splash-logo">TANCAT</div>
                <div class="splash-subtitle">Sistema de Administración</div>
                <div class="splash-loader">
                    <div class="loader-spinner"></div>
                    <div class="loader-text">Cargando...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(splash);
    }
    
    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        
        if (splash) {
            splash.classList.add('splash-hiding');
            
            setTimeout(() => {
                splash.remove();
            }, 500);
        }
    }
    
    showInitializationError(error) {
        this.hideSplashScreen();
        
        const errorScreen = document.createElement('div');
        errorScreen.className = 'initialization-error';
        
        errorScreen.innerHTML = `
            <div class="error-content">
                <h1>Error al Inicializar</h1>
                <p>No se pudo cargar la aplicación correctamente.</p>
                <details>
                    <summary>Detalles del error</summary>
                    <pre>${error.message}</pre>
                </details>
                <button onclick="window.location.reload()">Reintentar</button>
            </div>
        `;
        
        document.body.appendChild(errorScreen);
    }
    
    // ====================================
    // PWA SETUP
    // ====================================
    
    setupPWA() {
        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registrado');
                })
                .catch(error => {
                    console.warn('⚠️ Error registrando Service Worker:', error);
                });
        }
        
        // Install prompt
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            this.installPrompt = event;
            this.showInstallButton();
        });
    }
    
    // ====================================
    // UTILIDADES GLOBALES
    // ====================================
    
    updateGlobalUI() {
        // Actualizar elementos de UI que dependen del estado global
        this.updateUserInfo();
        this.updateNavigationState();
    }
    
    updateUserInfo() {
        const userElements = document.querySelectorAll('[data-user-info]');
        
        userElements.forEach(element => {
            const field = element.getAttribute('data-user-info');
            
            if (this.globalState.user && this.globalState.user[field]) {
                element.textContent = this.globalState.user[field];
            }
        });
    }
    
    updateNavigationState() {
        // Actualizar navegación según permisos del usuario
        const navItems = document.querySelectorAll('[data-required-role]');
        
        navItems.forEach(item => {
            const requiredRole = item.getAttribute('data-required-role');
            const hasPermission = authService.hasRole(requiredRole);
            
            item.style.display = hasPermission ? '' : 'none';
        });
    }
    
    retryPendingOperations() {
        // Implementar retry de operaciones que fallaron por falta de conexión
        console.log('🔄 Reintentando operaciones pendientes...');
    }
    
    closeAllModals() {
        const modals = document.querySelectorAll('.modal.active, .popup.active');
        modals.forEach(modal => modal.classList.remove('active'));
    }
    
    openGlobalSearch() {
        console.log('🔍 Abriendo búsqueda global');
        // TODO: Implementar búsqueda global
    }
    
    showKeyboardShortcuts() {
        console.log('⌨️ Mostrando atajos de teclado');
        // TODO: Implementar modal de atajos
    }
    
    // ====================================
    // EVENTOS
    // ====================================
    
    emitAppEvent(type, data = {}) {
        const event = new CustomEvent(`tancat-app-${type}`, {
            detail: { ...data, timestamp: new Date().toISOString() }
        });
        
        window.dispatchEvent(event);
    }
    
    // ====================================
    // UTILIDADES
    // ====================================
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ====================================
    // MÉTODOS PÚBLICOS
    // ====================================
    
    getState() {
        return { ...this.globalState };
    }
    
    isReady() {
        return this.initialized;
    }
    
    // ====================================
    // DEBUG
    // ====================================
    
    getDebugInfo() {
        return {
            initialized: this.initialized,
            currentPage: this.currentPage,
            user: this.globalState.user,
            notifications: this.globalState.notifications.length,
            environment: window.TANCAT_ENV
        };
    }
}

// ====================================
// INICIALIZACIÓN AUTOMÁTICA
// ====================================
const tancatApp = new TancatApp();

// Hacer disponible globalmente
window.tancatApp = tancatApp;
window.TANCAT_DEBUG = () => tancatApp.getDebugInfo();

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tancatApp.init());
} else {
    tancatApp.init();
}

export default tancatApp;