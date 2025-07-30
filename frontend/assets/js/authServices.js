/**
 * TANCAT - Sistema de Administración Frontend
 * Archivo: assets/js/authService.js
 * Descripción: Servicio de autenticación para el frontend
 */

class AuthService {
    constructor() {
        this.apiBaseUrl = '/api';
        this.tokenKey = 'tancat_token';
        this.userKey = 'tancat_user';
        this.refreshKey = 'tancat_refresh';
        
        // Estado interno
        this.currentUser = null;
        this.currentToken = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
        
        this.init();
    }

    // ====================================
    // INICIALIZACIÓN
    // ====================================
    init() {
        this.loadStoredAuth();
        this.setupTokenRefresh();
        
        console.log('🔐 AuthService inicializado');
    }

    loadStoredAuth() {
        try {
            const token = localStorage.getItem(this.tokenKey);
            const userData = localStorage.getItem(this.userKey);
            
            if (token && userData) {
                this.currentToken = token;
                this.currentUser = JSON.parse(userData);
                
                // Verificar si el token no ha expirado
                if (this.isTokenValid(token)) {
                    console.log('✅ Sesión restaurada desde localStorage');
                } else {
                    console.log('⚠️ Token expirado, limpiando sesión');
                    this.clearAuth();
                }
            }
        } catch (error) {
            console.error('❌ Error cargando autenticación almacenada:', error);
            this.clearAuth();
        }
    }

    setupTokenRefresh() {
        // Verificar token cada 5 minutos
        setInterval(() => {
            if (this.currentToken && this.isTokenExpiringSoon(this.currentToken)) {
                this.refreshToken();
            }
        }, 5 * 60 * 1000);
    }

    // ====================================
    // AUTENTICACIÓN
    // ====================================
    async login(credentials) {
        try {
            console.log('🔐 Iniciando login...');
            
            const response = await this.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });

            if (response.success) {
                const { token, user } = response.data;
                
                // Almacenar autenticación
                this.storeAuth(token, user);
                
                console.log('✅ Login exitoso:', user.email);
                
                return { success: true, user };
            } else {
                throw new Error(response.message || 'Error de autenticación');
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            return { 
                success: false, 
                error: error.message || 'Error de conexión' 
            };
        }
    }

    async logout() {
        try {
            console.log('🚪 Cerrando sesión...');
            
            // Notificar al servidor
            if (this.currentToken) {
                await this.apiRequest('/auth/logout', {
                    method: 'POST'
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Error al notificar logout al servidor:', error);
        } finally {
            // Limpiar siempre, incluso si falla la notificación
            this.clearAuth();
            
            // Redirigir al login
            if (window.router) {
                window.router.navigate('/');
            } else {
                window.location.href = '/';
            }
            
            console.log('✅ Sesión cerrada correctamente');
        }
    }

    async refreshToken() {
        if (this.isRefreshing) {
            return this.refreshPromise;
        }
        
        this.isRefreshing = true;
        
        this.refreshPromise = this.performTokenRefresh();
        
        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    async performTokenRefresh() {
        try {
            console.log('🔄 Refrescando token...');
            
            const response = await this.apiRequest('/auth/refresh', {
                method: 'POST'
            });

            if (response.success) {
                const { token } = response.data;
                
                // Actualizar token almacenado
                this.currentToken = token;
                localStorage.setItem(this.tokenKey, token);
                
                console.log('✅ Token refrescado exitosamente');
                return { success: true };
            } else {
                throw new Error('No se pudo refrescar el token');
            }
            
        } catch (error) {
            console.error('❌ Error refrescando token:', error);
            
            // Si falla el refresh, cerrar sesión
            this.clearAuth();
            
            if (window.router) {
                window.router.navigate('/');
            }
            
            return { success: false, error: error.message };
        }
    }

    // ====================================
    // VERIFICACIÓN DE ESTADO
    // ====================================
    async isAuthenticated() {
        if (!this.currentToken || !this.currentUser) {
            return false;
        }
        
        // Verificar si el token sigue siendo válido
        if (!this.isTokenValid(this.currentToken)) {
            this.clearAuth();
            return false;
        }
        
        // Verificar con el servidor periódicamente
        return await this.verifyTokenWithServer();
    }

    async verifyTokenWithServer() {
        try {
            const response = await this.apiRequest('/auth/verify', {
                method: 'GET'
            });
            
            if (response.success) {
                // Actualizar datos del usuario si han cambiado
                if (response.data.user) {
                    this.currentUser = response.data.user;
                    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
                }
                return true;
            } else {
                this.clearAuth();
                return false;
            }
            
        } catch (error) {
            console.warn('⚠️ Error verificando token con servidor:', error);
            // En caso de error de red, asumir que sigue autenticado
            return true;
        }
    }

    isTokenValid(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            return payload.exp > currentTime;
        } catch (error) {
            console.error('❌ Error decodificando token:', error);
            return false;
        }
    }

    isTokenExpiringSoon(token, minutesThreshold = 10) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            const expirationTime = payload.exp;
            const thresholdTime = minutesThreshold * 60;
            
            return (expirationTime - currentTime) < thresholdTime;
        } catch (error) {
            return true; // Asumir que expira pronto si no se puede decodificar
        }
    }

    // ====================================
    // GESTIÓN DE PERMISOS
    // ====================================
    async getPermissions() {
        try {
            const response = await this.apiRequest('/auth/permissions', {
                method: 'GET'
            });
            
            if (response.success) {
                return response.data.permissions || {};
            }
            
            return {};
        } catch (error) {
            console.error('❌ Error obteniendo permisos:', error);
            return {};
        }
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        // Los administradores tienen todos los permisos
        if (this.currentUser.role === 'Administrador') {
            return true;
        }
        
        // TODO: Implementar lógica de permisos más específica
        return true; // Por ahora, permitir todo a usuarios autenticados
    }

    getUserRole() {
        return this.currentUser?.role || null;
    }

    // ====================================
    // DATOS DEL USUARIO
    // ====================================
    getCurrentUser() {
        return this.currentUser;
    }

    async getUserProfile() {
        try {
            const response = await this.apiRequest('/auth/profile', {
                method: 'GET'
            });
            
            if (response.success) {
                return response.data;
            }
            
            throw new Error(response.message || 'Error obteniendo perfil');
        } catch (error) {
            console.error('❌ Error obteniendo perfil:', error);
            throw error;
        }
    }

    // ====================================
    // ALMACENAMIENTO
    // ====================================
    storeAuth(token, user) {
        this.currentToken = token;
        this.currentUser = user;
        
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        
        console.log('💾 Autenticación almacenada');
    }

    clearAuth() {
        this.currentToken = null;
        this.currentUser = null;
        
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.refreshKey);
        
        console.log('🗑️ Autenticación limpiada');
    }

    // ====================================
    // REQUESTS HTTP
    // ====================================
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        // Agregar token de autorización si existe
        if (this.currentToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.currentToken}`;
        }
        
        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, finalOptions);
            
            // Manejar errores HTTP
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`❌ Error en request ${endpoint}:`, error);
            
            // Si es error 401, probablemente el token expiró
            if (error.message.includes('401')) {
                this.clearAuth();
                if (window.router) {
                    window.router.navigate('/');
                }
            }
            
            throw error;
        }
    }

    // ====================================
    // UTILIDADES
    // ====================================
    getAuthHeader() {
        return this.currentToken ? `Bearer ${this.currentToken}` : null;
    }

    isLoggedIn() {
        return !!(this.currentToken && this.currentUser);
    }

    getTokenExpirationTime() {
        if (!this.currentToken) return null;
        
        try {
            const payload = JSON.parse(atob(this.currentToken.split('.')[1]));
            return new Date(payload.exp * 1000);
        } catch (error) {
            return null;
        }
    }

    // ====================================
    // EVENTOS
    // ====================================
    onAuthChange(callback) {
        // TODO: Implementar sistema de eventos para cambios de autenticación
        this._authChangeCallback = callback;
    }

    _notifyAuthChange(type, data) {
        if (this._authChangeCallback) {
            this._authChangeCallback(type, data);
        }
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('tancat:auth', {
            detail: { type, data }
        }));
    }
}

// ====================================
// INICIALIZACIÓN GLOBAL
// ====================================
window.authService = new AuthService();

// Exponer para debugging en desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.TANCAT_AUTH_DEBUG = {
        getToken: () => window.authService.currentToken,
        getUser: () => window.authService.currentUser,
        clearAuth: () => window.authService.clearAuth(),
        testLogin: async (email = 'admin@tancat.com', password = 'admin123') => {
            return await window.authService.login({ email, password });
        }
    };
    
    console.log('🛠️ Debug de autenticación disponible en window.TANCAT_AUTH_DEBUG');
}