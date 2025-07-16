/**
 * TANCAT - Sistema de Administración
 * Archivo: LoginController.js
 * Descripción: Controlador para la página de login
 */

import authService from '../authService.js';
import apiClient from '../apiClient.js';

class LoginController {
    constructor() {
        this.form = null;
        this.isLoading = false;
        this.connectionChecked = false;
        this.validationRules = {
            username: {
                required: true,
                minLength: 2,
                message: 'El usuario debe tener al menos 2 caracteres'
            },
            password: {
                required: true,
                minLength: 4,
                message: 'La contraseña debe tener al menos 4 caracteres'
            }
        };
        
        console.log('🔐 LoginController inicializado');
    }
    
    // ====================================
    // INICIALIZACIÓN
    // ====================================
    
    async init() {
        try {
            console.log('🔐 Inicializando Login Controller');
            
            // Verificar si ya está autenticado
            if (authService.isAuthenticated()) {
                const isValid = await authService.verifySession();
                if (isValid) {
                    console.log('Usuario ya autenticado, redirigiendo...');
                    window.navigateTo('/dashboard');
                    return;
                }
            }

            this.setupElements();
            this.setupEventListeners();
            await this.checkConnection();
            this.setupDemoMode();
            
            // Focus automático en el primer campo
            if (this.usernameInput) {
                this.usernameInput.focus();
            }
            
            console.log('✅ Login Controller inicializado');
        } catch (error) {
            console.error('❌ Error inicializando login:', error);
            this.showError('Error al inicializar la página de login');
        }
    }
    
    setupElements() {
        // Elementos del formulario
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.rememberMeCheckbox = document.getElementById('rememberMe');
        this.loginButton = document.getElementById('loginBtn');
        
        // Elementos de estado
        this.connectionStatus = document.getElementById('connectionStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Verificar elementos críticos
        if (!this.form || !this.usernameInput || !this.passwordInput || !this.loginButton) {
            console.error('❌ Elementos críticos del formulario no encontrados');
            this.showError('Error en la configuración de la página');
        }
    }
    
    setupEventListeners() {
        // Formulario de login
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Navegación con Enter
        if (this.usernameInput) {
            this.usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.passwordInput?.focus();
                }
            });
            
            this.usernameInput.addEventListener('input', () => {
                this.clearFieldError('username');
                this.validateField('username');
            });
        }
        
        if (this.passwordInput) {
            this.passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.form?.requestSubmit();
                }
            });
            
            this.passwordInput.addEventListener('input', () => {
                this.clearFieldError('password');
                this.validateField('password');
            });
        }
        
        // Enlaces adicionales
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }
        
        // Botón de demostración (si existe)
        const demoButton = document.getElementById('demoLoginBtn');
        if (demoButton) {
            demoButton.addEventListener('click', () => this.handleDemoLogin());
        }
    }
    
    // ====================================
    // VERIFICACIÓN DE CONEXIÓN
    // ====================================
    
    async checkConnection() {
        try {
            this.updateConnectionStatus('checking', 'Verificando conexión...');
            
            const isConnected = await apiClient.testConnection();
            
            if (isConnected) {
                this.updateConnectionStatus('connected', 'Conectado al servidor');
                this.connectionChecked = true;
            } else {
                this.updateConnectionStatus('disconnected', 'Sin conexión al servidor');
                this.showWarning('No se puede conectar al servidor. Verifica tu conexión.');
            }
            
        } catch (error) {
            this.updateConnectionStatus('error', 'Error de conexión');
            console.error('❌ Error verificando conexión:', error);
            this.showWarning('Error al verificar la conexión con el servidor.');
        }
    }
    
    updateConnectionStatus(status, message) {
        if (!this.connectionStatus) return;
        
        const statusElement = this.connectionStatus.querySelector('.status-indicator');
        const textElement = this.connectionStatus.querySelector('.status-text');
        
        if (statusElement) {
            statusElement.className = `status-indicator status-${status}`;
        }
        
        if (textElement) {
            textElement.textContent = message;
        }
        
        // Mostrar/ocultar elemento de estado
        this.connectionStatus.style.display = 'block';
        
        // Auto-ocultar si está conectado
        if (status === 'connected') {
            setTimeout(() => {
                if (this.connectionStatus) {
                    this.connectionStatus.style.display = 'none';
                }
            }, 3000);
        }
    }
    
    // ====================================
    // MANEJO DEL LOGIN
    // ====================================
    
    async handleLogin(event) {
        event.preventDefault();
        
        if (this.isLoading) {
            console.warn('⚠️ Login ya en progreso');
            return;
        }
        
        try {
            this.setLoading(true);
            this.clearAllErrors();
            
            // Obtener datos del formulario
            const formData = new FormData(this.form);
            const credentials = {
                username: formData.get('username')?.trim() || '',
                password: formData.get('password') || '',
                rememberMe: formData.get('rememberMe') === 'on'
            };
            
            console.log('🔑 Intentando login para:', credentials.username);
            
            // Validar campos localmente
            const validation = this.validateCredentials(credentials);
            if (!validation.isValid) {
                this.showFieldErrors(validation.errors);
                return;
            }
            
            // Verificar conexión si no se ha hecho
            if (!this.connectionChecked) {
                await this.checkConnection();
            }
            
            // Intentar login
            const result = await authService.login(credentials);
            
            if (result.success) {
                this.showSuccess('Login exitoso, redirigiendo...');
                
                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.navigateTo(result.redirectTo || '/dashboard');
                }, 1500);
                
            } else {
                // Manejar errores específicos
                if (result.validationErrors) {
                    this.showFieldErrors(result.validationErrors);
                } else if (result.isNetworkError) {
                    this.showError('Error de conexión. Verifica tu red e inténtalo de nuevo.');
                } else {
                    this.showError(result.error || 'Credenciales incorrectas');
                }
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showError('Error inesperado. Inténtalo de nuevo.');
        } finally {
            this.setLoading(false);
        }
    }
    
    // ====================================
    // VALIDACIÓN
    // ====================================
    
    validateCredentials(credentials) {
        const errors = {};
        
        // Validar username
        if (!credentials.username) {
            errors.username = 'El usuario es requerido';
        } else if (credentials.username.length < this.validationRules.username.minLength) {
            errors.username = this.validationRules.username.message;
        }
        
        // Validar password
        if (!credentials.password) {
            errors.password = 'La contraseña es requerida';
        } else if (credentials.password.length < this.validationRules.password.minLength) {
            errors.password = this.validationRules.password.message;
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
    
    validateField(fieldName) {
        const field = this[fieldName + 'Input'];
        if (!field) return true;
        
        const value = field.value.trim();
        const rule = this.validationRules[fieldName];
        
        if (!rule) return true;
        
        // Validar según reglas
        if (rule.required && !value) {
            this.showFieldError(fieldName, `${fieldName} es requerido`);
            return false;
        }
        
        if (rule.minLength && value.length < rule.minLength) {
            this.showFieldError(fieldName, rule.message);
            return false;
        }
        
        // Si llega aquí, el campo es válido
        this.showFieldSuccess(fieldName);
        return true;
    }
    
    // ====================================
    // MANEJO DE ERRORES Y ESTADOS
    // ====================================
    
    showFieldErrors(errors) {
        Object.entries(errors).forEach(([field, message]) => {
            this.showFieldError(field, message);
        });
    }
    
    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        const formGroup = inputElement?.closest('.form-group');
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        if (formGroup) {
            formGroup.classList.add('error');
            formGroup.classList.remove('success');
        }
        
        if (inputElement) {
            inputElement.setAttribute('aria-invalid', 'true');
        }
    }
    
    showFieldSuccess(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        const formGroup = inputElement?.closest('.form-group');
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        if (formGroup) {
            formGroup.classList.remove('error');
            formGroup.classList.add('success');
        }
        
        if (inputElement) {
            inputElement.setAttribute('aria-invalid', 'false');
        }
    }
    
    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        const formGroup = inputElement?.closest('.form-group');
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        if (formGroup) {
            formGroup.classList.remove('error', 'success');
        }
        
        if (inputElement) {
            inputElement.removeAttribute('aria-invalid');
        }
    }
    
    clearAllErrors() {
        ['username', 'password'].forEach(field => this.clearFieldError(field));
        this.hideAllMessages();
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showWarning(message) {
        this.showMessage(message, 'warning');
    }
    
    showMessage(message, type = 'info') {
        // Remover mensajes existentes
        this.hideAllMessages();
        
        // Crear elemento de mensaje
        const messageElement = document.createElement('div');
        messageElement.className = `login-message message-${type}`;
        messageElement.innerHTML = `
            <div class="message-content">
                <span class="message-icon">${this.getMessageIcon(type)}</span>
                <span class="message-text">${message}</span>
            </div>
        `;
        
        // Insertar después del formulario
        this.form.appendChild(messageElement);
        
        // Auto-remover mensajes de éxito/info después de un tiempo
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 5000);
        }
    }
    
    hideAllMessages() {
        const messages = document.querySelectorAll('.login-message');
        messages.forEach(msg => msg.remove());
    }
    
    getMessageIcon(type) {
        const icons = {
            error: '❌',
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    // ====================================
    // ESTADO DE CARGA
    // ====================================
    
    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.loginButton) {
            if (loading) {
                this.loginButton.disabled = true;
                this.loginButton.innerHTML = `
                    <span class="loading-spinner"></span>
                    Iniciando sesión...
                `;
                this.loginButton.classList.add('loading');
            } else {
                this.loginButton.disabled = false;
                this.loginButton.textContent = 'Ingresar al Sistema';
                this.loginButton.classList.remove('loading');
            }
        }
        
        // Deshabilitar/habilitar form
        const formElements = this.form?.querySelectorAll('input, button');
        formElements?.forEach(element => {
            element.disabled = loading;
        });
        
        // Mostrar/ocultar overlay de carga
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
    }
    
    // ====================================
    // FUNCIONALIDADES ADICIONALES
    // ====================================
    
    handleForgotPassword() {
        const message = `
            Para recuperar tu contraseña, contacta al administrador del sistema:
            
            📧 Email: admin@tancat.com
            📞 Teléfono: Consultar en recepción
            📍 Visítanos: Jacinto Ríos 232, Córdoba
        `;
        
        alert(message);
    }
    
    setupDemoMode() {
        // Solo en desarrollo
        if (import.meta.env?.VITE_ENVIRONMENT !== 'development') {
            return;
        }
        
        console.log('🧪 Modo demo disponible para desarrollo');
        
        // Agregar botón de demo si no existe
        let demoButton = document.getElementById('demoLoginBtn');
        
        if (!demoButton) {
            demoButton = document.createElement('button');
            demoButton.type = 'button';
            demoButton.id = 'demoLoginBtn';
            demoButton.className = 'btn-demo';
            demoButton.innerHTML = '🧪 Login Demo (Desarrollo)';
            demoButton.addEventListener('click', () => this.handleDemoLogin());
            
            // Insertar después del botón de login
            if (this.loginButton && this.loginButton.parentNode) {
                this.loginButton.parentNode.insertBefore(demoButton, this.loginButton.nextSibling);
            }
        }
        
        // Agregar credenciales de ejemplo en placeholder
        if (this.usernameInput) {
            this.usernameInput.placeholder = 'admin@tancat.com (demo)';
        }
        
        if (this.passwordInput) {
            this.passwordInput.placeholder = 'admin123 (demo)';
        }
    }
    
    handleDemoLogin() {
        if (import.meta.env?.VITE_ENVIRONMENT !== 'development') {
            console.warn('⚠️ Demo login solo disponible en desarrollo');
            return;
        }
        
        console.log('🧪 Iniciando login demo');
        
        // Llenar campos con credenciales demo
        if (this.usernameInput) {
            this.usernameInput.value = 'admin@tancat.com';
        }
        
        if (this.passwordInput) {
            this.passwordInput.value = 'admin123';
        }
        
        // Limpiar errores
        this.clearAllErrors();
        
        // Simular login automático
        setTimeout(() => {
            this.form?.requestSubmit();
        }, 500);
    }
    
    // ====================================
    // CLEANUP
    // ====================================
    
    destroy() {
        console.log('🧹 Limpiando LoginController');
        
        // Limpiar timers y listeners
        if (this.connectionCheckTimer) {
            clearTimeout(this.connectionCheckTimer);
        }
        
        // Limpiar estado de carga
        this.setLoading(false);
        
        // Limpiar referencias
        this.form = null;
        this.usernameInput = null;
        this.passwordInput = null;
        this.loginButton = null;
    }
    
    // ====================================
    // MÉTODOS DE DEBUG
    // ====================================
    
    getDebugInfo() {
        return {
            isLoading: this.isLoading,
            connectionChecked: this.connectionChecked,
            hasForm: !!this.form,
            hasInputs: !!(this.usernameInput && this.passwordInput),
            formData: this.form ? {
                username: this.usernameInput?.value || '',
                hasPassword: !!this.passwordInput?.value,
                rememberMe: this.rememberMeCheckbox?.checked || false
            } : null
        };
    }
}

export default LoginController;