/**
 * TANCAT - Sistema de Administración
 * Archivo: authService.js
 * Descripción: Servicio de autenticación y gestión de sesiones
 */

import apiClient from './apiClient.js';

class AuthService {
    constructor() {
        this.user = null;
        this.token = null;
        this.refreshTimer = null;
        
        // Inicializar desde localStorage
        this.initializeFromStorage();
        
        console.log('🔐 AuthService inicializado:', {
            hasUser: !!this.user,
            hasToken: !!this.token
        });
    }
    
    // ====================================
    // INICIALIZACIÓN
    // ====================================
    
    initializeFromStorage() {
        try {
            const token = localStorage.getItem('tancat_auth_token');
            const userData = localStorage.getItem('tancat_user_data');
            
            if (token && userData) {
                this.token = token;
                this.user = JSON.parse(userData);
                
                // Configurar token en apiClient
                apiClient.setAuthToken(token);
                
                // Iniciar timer de refresh
                this.startTokenRefreshTimer();
                
                console.log('🔄 Sesión restaurada desde localStorage');
            }
        } catch (error) {
            console.error('❌ Error al restaurar sesión:', error);
            this.clearSession();
        }
    }
    
    // ====================================
    // MÉTODOS DE AUTENTICACIÓN
    // ====================================
    
    async login(credentials) {
        try {
            console.log('🔑 Intentando login para:', credentials.username);
            
            // Validar credenciales localmente
            const validation = this.validateCredentials(credentials);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    validationErrors: validation.errors
                };
            }
            
            // Realizar login en el backend
            const response = await apiClient.login({
                email: credentials.username, // El backend espera email
                password: credentials.password,
                rememberMe: credentials.rememberMe || false
            });
            
            if (response.success) {
                // Guardar datos de sesión
                this.setSession(response.data.user, response.data.token);
                
                console.log('✅ Login exitoso para:', response.data.user.email);
                
                return {
                    success: true,
                    user: this.user,
                    redirectTo: this.getRedirectUrl()
                };
            } else {
                console.warn('❌ Login falló:', response.error);
                return {
                    success: false,
                    error: response.error || 'Credenciales inválidas'
                };
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            return {
                success: false,
                error: 'Error de conexión. Verifica tu red.',
                isNetworkError: true
            };
        }
    }
    
    async logout() {
        try {
            console.log('🚪 Cerrando sesión...');
            
            // Notificar al backend
            await apiClient.logout();
            
            // Limpiar sesión local
            this.clearSession();
            
            console.log('✅ Sesión cerrada exitosamente');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
            
            // Limpiar sesión local aunque falle el backend
            this.clearSession();
            
            return { success: true }; // Siempre exitoso localmente
        }
    }
    
    async verifySession() {
        if (!this.token) {
            return false;
        }
        
        try {
            const isValid = await apiClient.verifyToken();
            
            if (!isValid) {
                console.warn('🔓 Token inválido, cerrando sesión');
                this.clearSession();
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error verificando sesión:', error);
            this.clearSession();
            return false;
        }
    }
    
    // ====================================
    // GESTIÓN DE SESIÓN
    // ====================================
    
    setSession(user, token) {
        this.user = user;
        this.token = token;
        
        // Guardar en localStorage
        localStorage.setItem('tancat_auth_token', token);
        localStorage.setItem('tancat_user_data', JSON.stringify(user));
        
        // Configurar en apiClient
        apiClient.setAuthToken(token);
        
        // Iniciar refresh timer
        this.startTokenRefreshTimer();
        
        // Emitir evento de login
        this.emitAuthEvent('login', { user });
    }
    
    clearSession() {
        const wasLoggedIn = !!this.user;
        
        // Limpiar variables
        this.user = null;
        this.token = null;
        
        // Limpiar localStorage
        localStorage.removeItem('tancat_auth_token');
        localStorage.removeItem('tancat_user_data');
        
        // Limpiar apiClient
        apiClient.clearAuth();
        
        // Detener refresh timer
        this.stopTokenRefreshTimer();
        
        // Emitir evento de logout si había sesión
        if (wasLoggedIn) {
            this.emitAuthEvent('logout');
        }
    }
    
    // ====================================
    // GESTIÓN DE TOKEN REFRESH
    // ====================================
    
    startTokenRefreshTimer() {
        this.stopTokenRefreshTimer();
        
        // Refrescar token cada 50 minutos (tokens suelen durar 1 hora)
        this.refreshTimer = setInterval(async () => {
            await this.refreshToken();
        }, 50 * 60 * 1000);
    }
    
    stopTokenRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    
    async refreshToken() {
        if (!this.token) return false;
        
        try {
            console.log('🔄 Refrescando token...');
            
            const response = await apiClient.post('/auth/refresh', {}, { cache: false });
            
            if (response.success && response.data?.token) {
                // Actualizar solo el token, mantener user data
                this.token = response.data.token;
                localStorage.setItem('tancat_auth_token', response.data.token);
                apiClient.setAuthToken(response.data.token);
                
                console.log('✅ Token refrescado exitosamente');
                return true;
            } else {
                console.warn('❌ No se pudo refrescar token');
                this.clearSession();
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error refrescando token:', error);
            this.clearSession();
            return false;
        }
    }
    
    // ====================================
    // VALIDACIONES
    // ====================================
    
    validateCredentials(credentials) {
        const errors = [];
        
        if (!credentials.username || credentials.username.trim().length < 2) {
            errors.push('El usuario debe tener al menos 2 caracteres');
        }
        
        if (!credentials.password || credentials.password.length < 4) {
            errors.push('La contraseña debe tener al menos 4 caracteres');
        }
        
        // Validar formato de email si parece ser un email
        if (credentials.username && credentials.username.includes('@')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(credentials.username)) {
                errors.push('El formato del email no es válido');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // ====================================
    // UTILIDADES Y GETTERS
    // ====================================
    
    isAuthenticated() {
        return !!(this.user && this.token);
    }
    
    getUser() {
        return this.user;
    }
    
    getToken() {
        return this.token;
    }
    
    getUserRole() {
        return this.user?.role || null;
    }
    
    hasRole(role) {
        return this.getUserRole() === role;
    }
    
    hasPermission(permission) {
        // TODO: Implementar sistema de permisos granular
        if (!this.user) return false;
        
        // Por ahora, usar roles básicos
        const userRole = this.getUserRole();
        
        switch (permission) {
            case 'admin':
                return userRole === 'administrador';
            case 'employee':
                return ['administrador', 'empleado', 'encargado'].includes(userRole);
            case 'manager':
                return ['administrador', 'encargado'].includes(userRole);
            default:
                return false;
        }
    }
    
    getRedirectUrl() {
        // Determinar a dónde redirigir según el rol
        const role = this.getUserRole();
        
        switch (role) {
            case 'administrador':
                return '/pages/dashboard.html';
            case 'encargado':
                return '/pages/dashboard.html';
            case 'empleado':
                return '/pages/reservas.html';
            default:
                return '/pages/dashboard.html';
        }
    }
    
    // ====================================
    // EVENTOS
    // ====================================
    
    emitAuthEvent(type, data = {}) {
        const event = new CustomEvent(`tancat-auth-${type}`, {
            detail: { ...data, timestamp: new Date().toISOString() }
        });
        
        window.dispatchEvent(event);
    }
    
    // Método para suscribirse a eventos de auth
    onAuthChange(callback) {
        const loginHandler = (event) => callback('login', event.detail);
        const logoutHandler = (event) => callback('logout', event.detail);
        
        window.addEventListener('tancat-auth-login', loginHandler);
        window.addEventListener('tancat-auth-logout', logoutHandler);
        
        // Retornar función para desuscribirse
        return () => {
            window.removeEventListener('tancat-auth-login', loginHandler);
            window.removeEventListener('tancat-auth-logout', logoutHandler);
        };
    }
    
    // ====================================
    // MÉTODOS DE DESARROLLO/DEBUG
    // ====================================
    
    getDebugInfo() {
        return {
            isAuthenticated: this.isAuthenticated(),
            user: this.user,
            hasToken: !!this.token,
            tokenLength: this.token?.length || 0,
            hasRefreshTimer: !!this.refreshTimer,
            userRole: this.getUserRole()
        };
    }
    
    // Método para testing/desarrollo
    simulateLogin(userData = null) {
        if (import.meta.env?.VITE_ENVIRONMENT !== 'development') {
            console.warn('⚠️ simulateLogin solo disponible en desarrollo');
            return;
        }
        
        const defaultUser = {
            id: 1,
            email: 'admin@tancat.com',
            name: 'Administrador',
            role: 'administrador'
        };
        
        const mockToken = 'mock_token_' + Date.now();
        
        this.setSession(userData || defaultUser, mockToken);
        
        console.log('🧪 Login simulado para desarrollo');
    }
}

// ====================================
// INSTANCIA GLOBAL
// ====================================
const authService = new AuthService();

// Hacer disponible globalmente para debugging
if (typeof window !== 'undefined') {
    window.authService = authService;
    window.AUTH_DEBUG = () => authService.getDebugInfo();
}

export default authService;