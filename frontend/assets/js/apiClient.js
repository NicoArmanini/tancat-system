/**
 * TANCAT - Sistema Cliente
 * Archivo: apiClient.js
 * Descripción: Cliente para comunicación con la API del backend
 */

class ApiClient {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.timeout = 10000; // 10 segundos
        this.isOnline = true;
        this.cache = new Map();
        this.retryAttempts = 3;
        
        // Verificar conectividad inicial
        this.checkConnectivity();
    }

    /**
     * Verificar conectividad con el backend
     */
    async checkConnectivity() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            this.isOnline = response.ok;
            
            if (this.isOnline) {
                console.log('✅ Conexión establecida con el backend');
            } else {
                console.warn('⚠️ Backend responde pero con errores');
            }
            
            return this.isOnline;
            
        } catch (error) {
            this.isOnline = false;
            console.error('❌ Sin conexión al backend:', error.message);
            return false;
        }
    }

    /**
     * Realizar petición HTTP genérica
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Verificar caché para peticiones GET
        if (!options.method || options.method === 'GET') {
            const cached = this.cache.get(url);
            if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutos
                return cached.data;
            }
        }

        let attempt = 0;
        while (attempt < this.retryAttempts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                
                const response = await fetch(url, {
                    ...config,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Cachear respuestas exitosas de GET
                if (!options.method || options.method === 'GET') {
                    this.cache.set(url, {
                        data,
                        timestamp: Date.now()
                    });
                }
                
                this.isOnline = true;
                return data;
                
            } catch (error) {
                attempt++;
                
                if (error.name === 'AbortError') {
                    console.warn(`⏱️ Timeout en petición a ${endpoint} (intento ${attempt})`);
                } else {
                    console.warn(`❌ Error en petición a ${endpoint} (intento ${attempt}):`, error.message);
                }
                
                // Si es el último intento, propagar el error
                if (attempt >= this.retryAttempts) {
                    this.isOnline = false;
                    throw new Error(`Error después de ${this.retryAttempts} intentos: ${error.message}`);
                }
                
                // Esperar antes del siguiente intento
                await this.delay(1000 * attempt);
            }
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Limpiar caché
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Caché de API limpiado');
    }

    // ====================================
    // MÉTODOS ESPECÍFICOS PARA EL CLIENTE
    // ====================================

    /**
     * Obtener todas las sedes
     */
    async obtenerSedes() {
        try {
            const response = await this.request('/cliente/sedes');
            return response;
        } catch (error) {
            console.error('Error obteniendo sedes:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los deportes
     */
    async obtenerDeportes() {
        try {
            const response = await this.request('/cliente/deportes');
            return response;
        } catch (error) {
            console.error('Error obteniendo deportes:', error);
            throw error;
        }
    }

    /**
     * Obtener combinaciones disponibles sede-deporte
     */
    async obtenerCombinacionesDisponibles() {
        try {
            const response = await this.request('/cliente/combinaciones-disponibles');
            return response;
        } catch (error) {
            console.error('Error obteniendo combinaciones:', error);
            throw error;
        }
    }

    /**
     * Consultar disponibilidad de turnos
     */
    async consultarDisponibilidad(sede_id, deporte_id, fecha) {
        try {
            const response = await this.request('/cliente/consulta-disponibilidad', {
                method: 'POST',
                body: JSON.stringify({
                    sede_id: parseInt(sede_id),
                    deporte_id: parseInt(deporte_id),
                    fecha: fecha
                })
            });
            return response;
        } catch (error) {
            console.error('Error consultando disponibilidad:', error);
            throw error;
        }
    }

    /**
     * Obtener torneos activos
     */
    async obtenerTorneosActivos() {
        try {
            const response = await this.request('/cliente/torneos');
            return response;
        } catch (error) {
            console.error('Error obteniendo torneos:', error);
            throw error;
        }
    }

    /**
     * Test de conexión
     */
    async testConnection() {
        try {
            await this.request('/health');
            return true;
        } catch (error) {
            return false;
        }
    }

    // ====================================
    // MÉTODOS DE UTILIDAD
    // ====================================

    /**
     * Obtener estado de conectividad
     */
    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            baseURL: this.baseURL,
            cacheSize: this.cache.size
        };
    }

    /**
     * Actualizar configuración
     */
    updateConfig(config) {
        if (config.baseURL) {
            this.baseURL = config.baseURL;
        }
        if (config.timeout) {
            this.timeout = config.timeout;
        }
        if (config.retryAttempts) {
            this.retryAttempts = config.retryAttempts;
        }
    }
}

// Crear instancia global
window.apiClient = new ApiClient();

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}