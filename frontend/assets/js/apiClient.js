/**
 * TANCAT - Sistema de Administración
 * Archivo: apiClient.js
 * Descripción: Cliente API para comunicación Frontend-Backend
 */

// ====================================
// CONFIGURACIÓN DEL API CLIENT
// ====================================
const API_CONFIG = {
    baseURL: 'http://localhost:3000',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
};

class ApiClient {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.timeout = API_CONFIG.timeout;
        this.retries = API_CONFIG.retries;
        this.retryDelay = API_CONFIG.retryDelay;
        this.authToken = null;
        
        // Cache para requests
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        
        // Inicializar auth token desde localStorage
        this.initializeAuth();
        
        console.log('🔗 ApiClient inicializado:', {
            baseURL: this.baseURL,
            timeout: this.timeout,
            hasAuth: !!this.authToken
        });
    }
    
    // ====================================
    // INICIALIZACIÓN Y CONFIGURACIÓN
    // ====================================
    
    initializeAuth() {
        const token = localStorage.getItem('tancat_auth_token');
        if (token) {
            this.authToken = token;
        }
    }
    
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('tancat_auth_token', token);
        } else {
            localStorage.removeItem('tancat_auth_token');
        }
    }
    
    clearAuth() {
        this.authToken = null;
        localStorage.removeItem('tancat_auth_token');
        localStorage.removeItem('tancat_user_data');
    }
    
    // ====================================
    // MÉTODOS PRINCIPALES DE REQUEST
    // ====================================
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const requestId = this.generateRequestId();
        
        console.log(`📡 [${requestId}] ${options.method || 'GET'} ${endpoint}`);
        
        try {
            // Verificar cache si es GET
            if ((!options.method || options.method === 'GET') && options.cache !== false) {
                const cached = this.getFromCache(endpoint);
                if (cached) {
                    console.log(`💾 [${requestId}] Cache hit para ${endpoint}`);
                    return cached;
                }
            }
            
            const response = await this.executeRequest(url, options);
            const data = await this.parseResponse(response);
            
            // Guardar en cache si es exitoso y es GET
            if (response.ok && (!options.method || options.method === 'GET') && options.cache !== false) {
                this.setCache(endpoint, data);
            }
            
            console.log(`✅ [${requestId}] Respuesta exitosa:`, {
                status: response.status,
                endpoint
            });
            
            return data;
            
        } catch (error) {
            console.error(`❌ [${requestId}] Error en request:`, {
                endpoint,
                error: error.message,
                status: error.status
            });
            
            throw this.handleError(error, endpoint);
        }
    }
    
    async executeRequest(url, options) {
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
                ...options.headers
            },
            signal: AbortSignal.timeout(this.timeout),
            ...options
        };
        
        // Agregar body si existe y no es GET
        if (options.data && config.method !== 'GET') {
            config.body = JSON.stringify(options.data);
        }
        
        // Intentar request con reintentos
        let lastError;
        for (let attempt = 1; attempt <= this.retries; attempt++) {
            try {
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = new Error(errorData.message || `HTTP ${response.status}`);
                    error.status = response.status;
                    error.data = errorData;
                    throw error;
                }
                
                return response;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retries && this.shouldRetry(error)) {
                    console.warn(`🔄 Reintento ${attempt}/${this.retries} para ${url}`);
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    }
    
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }
    
    // ====================================
    // MÉTODOS HTTP ESPECÍFICOS
    // ====================================
    
    async get(endpoint, params = {}, options = {}) {
        const searchParams = new URLSearchParams(params);
        const url = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
        
        return this.request(url, {
            method: 'GET',
            ...options
        });
    }
    
    async post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            data,
            ...options
        });
    }
    
    async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            data,
            ...options
        });
    }
    
    async patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            data,
            ...options
        });
    }
    
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            ...options
        });
    }
    
    // ====================================
    // MÉTODOS ESPECÍFICOS DEL SISTEMA
    // ====================================
    
    // Health Check
    async testConnection() {
        try {
            const response = await this.get('/health', {}, { cache: false });
            return response.status === 'OK';
        } catch (error) {
            console.error('❌ Test de conexión falló:', error);
            return false;
        }
    }
    
    // Autenticación
    async login(credentials) {
        try {
            const response = await this.post('/auth/login', credentials, { cache: false });
            
            if (response.success && response.data?.token) {
                this.setAuthToken(response.data.token);
                
                // Guardar datos de usuario
                if (response.data.user) {
                    localStorage.setItem('tancat_user_data', JSON.stringify(response.data.user));
                }
            }
            
            return response;
        } catch (error) {
            console.error('❌ Error en login:', error);
            return {
                success: false,
                error: error.message || 'Error de autenticación'
            };
        }
    }
    
    async logout() {
        try {
            await this.post('/auth/logout', {}, { cache: false });
        } catch (error) {
            console.warn('⚠️ Error en logout del servidor:', error);
        } finally {
            this.clearAuth();
            this.clearCache();
        }
    }
    
    async verifyToken() {
        if (!this.authToken) return false;
        
        try {
            const response = await this.get('/auth/verify', {}, { cache: false });
            return response.success;
        } catch (error) {
            console.warn('⚠️ Token inválido, limpiando auth');
            this.clearAuth();
            return false;
        }
    }
    
    // Cliente APIs
    async getSedes() {
        return this.get('/cliente/sedes');
    }
    
    async getDeportes() {
        return this.get('/cliente/deportes');
    }
    
    async getCombinacionesDisponibles() {
        return this.get('/cliente/combinaciones-disponibles');
    }
    
    async consultarDisponibilidad(datos) {
        return this.post('/cliente/consulta-disponibilidad', datos, { cache: false });
    }
    
    async getTorneosActivos() {
        return this.get('/cliente/torneos');
    }
    
    // Admin APIs
    async getDashboardData() {
        return this.get('/admin/dashboard', {}, { cache: false });
    }
    
    async getReservas(filtros = {}) {
        return this.get('/reservas', filtros);
    }
    
    async crearReserva(datos) {
        return this.post('/reservas', datos, { cache: false });
    }
    
    async actualizarReserva(id, datos) {
        return this.put(`/reservas/${id}`, datos, { cache: false });
    }
    
    async cancelarReserva(id, motivo = '') {
        return this.patch(`/reservas/${id}/cancelar`, { motivo }, { cache: false });
    }
    
    // ====================================
    // UTILIDADES Y HELPERS
    // ====================================
    
    getAuthHeaders() {
        if (this.authToken) {
            return {
                'Authorization': `Bearer ${this.authToken}`
            };
        }
        return {};
    }
    
    shouldRetry(error) {
        // No reintentar errores de autenticación o cliente
        if (error.status >= 400 && error.status < 500) {
            return false;
        }
        
        // Reintentar errores de red o servidor
        return error.name === 'TypeError' || error.status >= 500;
    }
    
    generateRequestId() {
        return Math.random().toString(36).substr(2, 9);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ====================================
    // GESTIÓN DE CACHE
    // ====================================
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }
    
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.cache.clear();
    }
    
    // ====================================
    // MANEJO DE ERRORES
    // ====================================
    
    handleError(error, endpoint) {
        const errorInfo = {
            message: error.message || 'Error desconocido',
            status: error.status || 0,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
        };
        
        // Errores específicos
        if (error.status === 401) {
            console.warn('🔐 Token expirado o inválido');
            this.clearAuth();
            errorInfo.requiresLogin = true;
        } else if (error.status === 403) {
            errorInfo.message = 'No tienes permisos para esta operación';
        } else if (error.status === 404) {
            errorInfo.message = 'Recurso no encontrado';
        } else if (error.status === 429) {
            errorInfo.message = 'Demasiadas solicitudes, intenta más tarde';
        } else if (error.status >= 500) {
            errorInfo.message = 'Error del servidor, intenta más tarde';
        } else if (error.name === 'TypeError' || !error.status) {
            errorInfo.message = 'Error de conexión. Verifica tu red.';
            errorInfo.isNetworkError = true;
        }
        
        return errorInfo;
    }
    
    // ====================================
    // MÉTODOS DE DESARROLLO
    // ====================================
    
    getDebugInfo() {
        return {
            baseURL: this.baseURL,
            hasAuth: !!this.authToken,
            cacheSize: this.cache.size,
            config: API_CONFIG
        };
    }
}

// ====================================
// INSTANCIA GLOBAL
// ====================================
const apiClient = new ApiClient();

// Hacer disponible globalmente para debugging
if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
    window.API_DEBUG = () => apiClient.getDebugInfo();
}

export default apiClient;