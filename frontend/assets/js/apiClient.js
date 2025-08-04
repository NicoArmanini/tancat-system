/**
 * TANCAT - Cliente API
 * Archivo: apiClient.js
 * Descripción: Cliente para comunicación con API backend (Neon Database)
 */

class TancatApiClient {
    constructor() {
        this.baseURL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:3000/api';
        this.timeout = 30000; // 30 segundos
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 segundo
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        
        // Interceptores
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Estado de conexión
        this.isOnline = navigator.onLine;
        this.connectionStatus = 'unknown';
        
        this.setupEventListeners();
        this.testConnection();
        
        console.log('📡 API Client TANCAT inicializado');
        console.log(`🔗 Base URL: ${this.baseURL}`);
    }
    
    // ====================================
    // CONFIGURACIÓN Y EVENT LISTENERS
    // ====================================
    
    setupEventListeners() {
        // Monitorear estado de conexión
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.testConnection();
            console.log('🌐 Conexión restaurada');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.connectionStatus = 'offline';
            console.log('📵 Conexión perdida');
        });
    }
    
    // ====================================
    // GESTIÓN DE CONEXIÓN
    // ====================================
    
    async testConnection() {
        try {
            const response = await this.makeRequest('GET', '/health', null, {
                timeout: 5000,
                skipAuth: true,
                skipCache: true
            });
            
            if (response.success) {
                this.connectionStatus = 'connected';
                console.log('✅ Conexión API establecida');
                return true;
            } else {
                this.connectionStatus = 'error';
                console.warn('⚠️ API responde pero con errores');
                return false;
            }
        } catch (error) {
            this.connectionStatus = 'disconnected';
            console.warn('❌ API no disponible:', error.message);
            return false;
        }
    }
    
    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            apiStatus: this.connectionStatus,
            baseURL: this.baseURL
        };
    }
    
    // ====================================
    // INTERCEPTORES
    // ====================================
    
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    async executeRequestInterceptors(config) {
        let modifiedConfig = { ...config };
        
        for (const interceptor of this.requestInterceptors) {
            try {
                modifiedConfig = await interceptor(modifiedConfig) || modifiedConfig;
            } catch (error) {
                console.error('Error en interceptor de request:', error);
            }
        }
        
        return modifiedConfig;
    }
    
    async executeResponseInterceptors(response, config) {
        let modifiedResponse = response;
        
        for (const interceptor of this.responseInterceptors) {
            try {
                modifiedResponse = await interceptor(modifiedResponse, config) || modifiedResponse;
            } catch (error) {
                console.error('Error en interceptor de response:', error);
            }
        }
        
        return modifiedResponse;
    }
    
    // ====================================
    // GESTIÓN DE CACHE
    // ====================================
    
    getCacheKey(method, url, params) {
        const key = `${method}:${url}`;
        if (params && Object.keys(params).length > 0) {
            return `${key}:${JSON.stringify(params)}`;
        }
        return key;
    }
    
    getFromCache(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        // Limpiar entrada caducada
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }
    
    setCache(cacheKey, data) {
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        // Limpiar cache viejo periódicamente
        if (this.cache.size > 100) {
            this.cleanOldCache();
        }
    }
    
    cleanOldCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache API limpiado');
    }
    
    // ====================================
    // MÉTODOS HTTP PRINCIPALES
    // ====================================
    
    async makeRequest(method, endpoint, data = null, options = {}) {
        const config = await this.prepareRequestConfig(method, endpoint, data, options);
        
        // Verificar cache para requests GET
        if (method === 'GET' && !options.skipCache) {
            const cacheKey = this.getCacheKey(method, endpoint, data);
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`📦 Respuesta desde cache: ${endpoint}`);
                return cached;
            }
        }
        
        // Realizar request con reintentos
        const response = await this.makeRequestWithRetry(config);
        
        // Cachear respuesta si es GET y exitosa
        if (method === 'GET' && !options.skipCache && response.success) {
            const cacheKey = this.getCacheKey(method, endpoint, data);
            this.setCache(cacheKey, response);
        }
        
        return response;
    }
    
    async prepareRequestConfig(method, endpoint, data, options) {
        // Configuración base
        let config = {
            method: method.toUpperCase(),
            url: endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data,
            timeout: options.timeout || this.timeout,
            skipAuth: options.skipAuth || false,
            skipCache: options.skipCache || false
        };
        
        // Agregar autenticación si no se omite
        if (!options.skipAuth && window.authService) {
            const token = await window.authService.getToken();
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        
        // Ejecutar interceptores de request
        config = await this.executeRequestInterceptors(config);
        
        return config;
    }
    
    async makeRequestWithRetry(config, attempt = 1) {
        try {
            const response = await this.fetchWithTimeout(config);
            const result = await this.processResponse(response, config);
            
            // Ejecutar interceptores de response
            return await this.executeResponseInterceptors(result, config);
            
        } catch (error) {
            console.error(`❌ Error en request (intento ${attempt}):`, error.message);
            
            // Reintentar si es apropiado
            if (this.shouldRetry(error, attempt)) {
                console.log(`🔄 Reintentando request (${attempt + 1}/${this.retryAttempts})`);
                await this.delay(this.retryDelay * attempt);
                return this.makeRequestWithRetry(config, attempt + 1);
            }
            
            throw this.createErrorResponse(error, config);
        }
    }
    
    async fetchWithTimeout(config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            const fetchOptions = {
                method: config.method,
                headers: config.headers,
                signal: controller.signal
            };
            
            // Agregar body si no es GET o HEAD
            if (config.data && !['GET', 'HEAD'].includes(config.method)) {
                fetchOptions.body = JSON.stringify(config.data);
            }
            
            const response = await fetch(config.url, fetchOptions);
            clearTimeout(timeoutId);
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    async processResponse(response, config) {
        const result = {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            config
        };
        
        try {
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                result.data = await response.json();
            } else {
                result.data = await response.text();
            }
        } catch (error) {
            console.warn('⚠️ Error procesando respuesta:', error);
            result.data = null;
        }
        
        // Si la respuesta no es exitosa, crear error estructurado
        if (!response.ok) {
            const error = new Error(
                result.data?.message || 
                result.data?.error || 
                `HTTP ${response.status}: ${response.statusText}`
            );
            error.response = result;
            error.status = response.status;
            throw error;
        }
        
        return result.data || result;
    }
    
    shouldRetry(error, attempt) {
        // No reintentar si ya alcanzamos el máximo
        if (attempt >= this.retryAttempts) {
            return false;
        }
        
        // Reintentar en errores de red o timeouts
        if (error.name === 'AbortError' || 
            error.name === 'TypeError' || 
            error.message.includes('fetch')) {
            return true;
        }
        
        // Reintentar en errores 5xx del servidor
        if (error.status >= 500) {
            return true;
        }
        
        return false;
    }
    
    createErrorResponse(error, config) {
        return {
            success: false,
            error: error.message,
            status: error.status || 0,
            data: error.response?.data || null,
            config
        };
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ====================================
    // MÉTODOS HTTP CONVENIENTES
    // ====================================
    
    async get(endpoint, params = null, options = {}) {
        let url = endpoint;
        
        // Agregar parámetros de consulta
        if (params && Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    searchParams.append(key, value);
                }
            });
            url += `?${searchParams.toString()}`;
        }
        
        return this.makeRequest('GET', url, null, options);
    }
    
    async post(endpoint, data = null, options = {}) {
        return this.makeRequest('POST', endpoint, data, options);
    }
    
    async put(endpoint, data = null, options = {}) {
        return this.makeRequest('PUT', endpoint, data, options);
    }
    
    async patch(endpoint, data = null, options = {}) {
        return this.makeRequest('PATCH', endpoint, data, options);
    }
    
    async delete(endpoint, options = {}) {
        return this.makeRequest('DELETE', endpoint, null, options);
    }
    
    // ====================================
    // MÉTODOS ESPECÍFICOS DE TANCAT
    // ====================================
    
    // === CLIENTE ===
    
    async obtenerSedes() {
        return this.get('/cliente/sedes');
    }
    
    async obtenerDeportes() {
        return this.get('/cliente/deportes');
    }
    
    async obtenerCanchas(sedeId = null, deporteId = null) {
        const params = {};
        if (sedeId) params.sede_id = sedeId;
        if (deporteId) params.deporte_id = deporteId;
        
        return this.get('/cliente/canchas', params);
    }
    
    async consultarDisponibilidad(sedeId, deporteId, fecha) {
        return this.post('/cliente/consulta-disponibilidad', {
            sede_id: sedeId,
            deporte_id: deporteId,
            fecha: fecha
        });
    }
    
    async obtenerTorneosActivos() {
        return this.get('/cliente/torneos');
    }
    
    async obtenerDetallesTorneo(torneoId) {
        return this.get(`/cliente/torneos/${torneoId}`);
    }
    
    async obtenerCombinacionesDisponibles() {
        return this.get('/cliente/combinaciones-disponibles');
    }
    
    async obtenerEstadisticasPublicas() {
        return this.get('/cliente/estadisticas');
    }
    
    // === AUTENTICACIÓN ===
    
    async login(credentials) {
        return this.post('/auth/login', credentials, { skipAuth: true });
    }
    
    async logout() {
        return this.post('/auth/logout');
    }
    
    async verificarToken() {
        return this.get('/auth/verify');
    }
    
    async renovarToken() {
        return this.post('/auth/refresh');
    }
    
    // === ADMINISTRACIÓN ===
    
    async obtenerDashboard() {
        return this.get('/admin/dashboard');
    }
    
    // --- Reservas ---
    async obtenerReservas(filtros = {}) {
        return this.get('/reservas', filtros);
    }
    
    async crearReserva(datosReserva) {
        return this.post('/reservas', datosReserva);
    }
    
    async actualizarReserva(reservaId, datos) {
        return this.put(`/reservas/${reservaId}`, datos);
    }
    
    async cancelarReserva(reservaId, motivo = null) {
        return this.patch(`/reservas/${reservaId}/cancelar`, { motivo });
    }
    
    async obtenerDetallesReserva(reservaId) {
        return this.get(`/reservas/${reservaId}`);
    }
    
    async obtenerEstadisticasReservas(fechaDesde, fechaHasta) {
        return this.get('/reservas/estadisticas', {
            fecha_desde: fechaDesde,
            fecha_hasta: fechaHasta
        });
    }
    
    // --- Torneos ---
    async obtenerTorneos(filtros = {}) {
        return this.get('/torneos', filtros);
    }
    
    async crearTorneo(datosTorneo) {
        return this.post('/torneos', datosTorneo);
    }
    
    // --- Inventario ---
    async obtenerInventario(filtros = {}) {
        return this.get('/inventario', filtros);
    }
    
    async agregarProducto(datosProducto) {
        return this.post('/inventario', datosProducto);
    }
    
    // --- Ventas ---
    async obtenerVentas(filtros = {}) {
        return this.get('/ventas', filtros);
    }
    
    async registrarVenta(datosVenta) {
        return this.post('/ventas', datosVenta);
    }
    
    async obtenerProductosParaVenta(filtros = {}) {
        return this.get('/ventas/productos', filtros);
    }
    
    // --- Reportes ---
    async obtenerReportesDisponibles() {
        return this.get('/reportes');
    }
    
    async generarReporteReservas(filtros = {}) {
        return this.get('/reportes/reservas', filtros);
    }
    
    async generarReporteIngresos(filtros = {}) {
        return this.get('/reportes/ingresos', filtros);
    }
    
    // ====================================
    // UTILIDADES DE UPLOAD
    // ====================================
    
    async uploadFile(file, endpoint = '/upload', onProgress = null) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            
            const xhr = new XMLHttpRequest();
            
            // Configurar progreso
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }
            
            // Configurar respuesta
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve({ success: true, data: xhr.responseText });
                    }
                } else {
                    reject(new Error(`Upload falló: ${xhr.status} ${xhr.statusText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Error de red durante upload'));
            });
            
            xhr.addEventListener('timeout', () => {
                reject(new Error('Timeout durante upload'));
            });
            
            // Configurar request
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
            xhr.open('POST', url);
            xhr.timeout = 60000; // 1 minuto para uploads
            
            // Agregar autenticación si está disponible
            if (window.authService) {
                window.authService.getToken().then(token => {
                    if (token) {
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    }
                    xhr.send(formData);
                });
            } else {
                xhr.send(formData);
            }
        });
    }
    
    // ====================================
    // UTILIDADES DE MONITOREO
    // ====================================
    
    async monitorearConexion(intervalo = 30000) {
        setInterval(async () => {
            await this.testConnection();
        }, intervalo);
    }
    
    getEstadisticasCache() {
        return {
            entradas: this.cache.size,
            tamaño: JSON.stringify([...this.cache.entries()]).length,
            antigüedad: this.cache.size > 0 ? 
                Math.min(...[...this.cache.values()].map(v => Date.now() - v.timestamp)) : 0
        };
    }
    
    // ====================================
    // UTILIDADES DE DESARROLLO
    // ====================================
    
    debug() {
        console.group('🐛 TANCAT API Client Debug');
        console.log('Base URL:', this.baseURL);
        console.log('Estado conexión:', this.getConnectionStatus());
        console.log('Estadísticas cache:', this.getEstadisticasCache());
        console.log('Interceptores request:', this.requestInterceptors.length);
        console.log('Interceptores response:', this.responseInterceptors.length);
        console.groupEnd();
    }
    
    // ====================================
    // CONFIGURACIÓN AVANZADA
    // ====================================
    
    configurar(opciones) {
        if (opciones.baseURL) {
            this.baseURL = opciones.baseURL;
        }
        
        if (opciones.timeout) {
            this.timeout = opciones.timeout;
        }
        
        if (opciones.retryAttempts) {
            this.retryAttempts = opciones.retryAttempts;
        }
        
        if (opciones.retryDelay) {
            this.retryDelay = opciones.retryDelay;
        }
        
        if (opciones.cacheTimeout) {
            this.cacheTimeout = opciones.cacheTimeout;
        }
        
        console.log('⚙️ API Client reconfigurado:', opciones);
    }
}

// ====================================
// INTERCEPTORES PREDEFINIDOS
// ====================================

// Interceptor para logging de requests
const loggingRequestInterceptor = (config) => {
    if (window.APP_CONFIG?.ENVIRONMENT === 'development') {
        console.log(`📤 ${config.method} ${config.url}`, config.data || '');
    }
    return config;
};

// Interceptor para logging de responses
const loggingResponseInterceptor = (response, config) => {
    if (window.APP_CONFIG?.ENVIRONMENT === 'development') {
        const status = response.success ? '✅' : '❌';
        console.log(`📥 ${status} ${config.method} ${config.url}`, response);
    }
    return response;
};

// Interceptor para manejo de errores de autenticación
const authErrorInterceptor = (response, config) => {
    if (!response.success && response.status === 401 && !config.skipAuth) {
        console.warn('🔐 Token expirado, redirigiendo al login');
        if (window.authService) {
            window.authService.logout();
        }
        if (window.router) {
            window.router.navigateTo('/login');
        }
    }
    return response;
};

// ====================================
// INICIALIZACIÓN Y EXPORTACIÓN
// ====================================

// Crear instancia global
const apiClient = new TancatApiClient();

// Agregar interceptores predefinidos
if (window.APP_CONFIG?.ENVIRONMENT === 'development') {
    apiClient.addRequestInterceptor(loggingRequestInterceptor);
    apiClient.addResponseInterceptor(loggingResponseInterceptor);
}

apiClient.addResponseInterceptor(authErrorInterceptor);

// Hacer disponible globalmente
window.apiClient = apiClient;

// Monitorear conexión
apiClient.monitorearConexion();

// Exportar para uso en módulos
export default apiClient;