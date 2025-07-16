// frontend/js/pages/loginController.js

class LoginController {
    constructor() {
        this.form = null;
        this.isLoading = false;
        this.connectionChecked = false;
    }

    async init() {
        try {
            console.log('🔐 Inicializando Login Controller');
            
            // Verificar si ya está autenticado
            if (await window.authService.isAuthenticated()) {
                console.log('Usuario ya autenticado, redirigiendo...');
                window.navigateTo('/main');
                return;
            }

            this.setupElements();
            this.setupEventListeners();
            await this.checkConnection();
            this.setupDemoCredentials();
            
            console.log('✅ Login Controller inicializado');
        } catch (error) {
            console.error('Error inicializando login:', error);
        }
    }

    setupElements() {
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.rememberMe = document.getElementById('rememberMe');
        this.loginButton = document.getElementById('loginButton');
        this.loginError = document.getElementById('loginError');
        this.loginSuccess = document.getElementById('loginSuccess');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
    }

    setupEventListeners() {
        // Formulario de login
        this.form?.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Toggle de contraseña
        this.passwordToggle?.addEventListener('click', () => this.togglePassword());
        
        // Enter en campos
        this.usernameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.passwordInput?.focus();
            }
        });
        
        this.passwordInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.form?.requestSubmit();
            }
        });

        // Limpiar errores cuando se escriba
        this.usernameInput?.addEventListener('input', () => this.clearFieldError('username'));
        this.passwordInput?.addEventListener('input', () => this.clearFieldError('password'));

        // Olvidé mi contraseña
        document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
    }

    async checkConnection() {
        try {
            this.updateConnectionStatus('checking', 'Verificando conexión...');
            
            const isConnected = await window.apiClient.testConnection();
            
            if (isConnected) {
                this.updateConnectionStatus('connected', 'Conectado al servidor');
            } else {
                this.updateConnectionStatus('disconnected', 'Sin conexión al servidor');
            }
            
            this.connectionChecked = true;
        } catch (error) {
            this.updateConnectionStatus('error', 'Error de conexión');
            console.error('Error verificando conexión:', error);
        }
    }

    updateConnectionStatus(status, message) {
        if (!this.statusIndicator || !this.statusText) return;
        
        // Remover clases previas
        this.statusIndicator.className = 'status-indicator';
        
        // Agregar nueva clase
        this.statusIndicator.classList.add(`status-${status}`);
        this.statusText.textContent = message;
    }

    setupDemoCredentials() {
        // Credenciales de demostración (remover en producción)
        if (window.APP_CONFIG?.DEVELOPMENT) {
            console.log('🔧 Modo desarrollo - Credenciales demo disponibles');
            
            // Agregar botón de demo
            const demoButton = document.createElement('button');
            demoButton.type = 'button';
            demoButton.className = 'btn btn-secondary btn-demo';
            demoButton.innerHTML = '🧪 Usar credenciales demo';
            demoButton.addEventListener('click', () => this.fillDemoCredentials());
            
            this.form?.appendChild(demoButton);
        }
    }

    fillDemoCredentials() {
        if (this.usernameInput) this.usernameInput.value = 'admin';
        if (this.passwordInput) this.passwordInput.value = 'admin123';
        this.clearAllErrors();
    }

    async handleLogin(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        try {
            this.setLoading(true);
            this.clearAllErrors();
            
            // Obtener datos del formulario
            const formData = new FormData(this.form);
            const credentials = {
                username: formData.get('username')?.trim(),
                password: formData.get('password'),
                rememberMe: formData.get('rememberMe') === 'on'
            };
            
            // Validar campos
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
            const result = await window.authService.login(credentials);
            
            if (result.success) {
                this.showSuccess();
                
                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.navigateTo('/main');
                }, 1500);
                
            } else {
                this.showError(result.error || 'Error de autenticación');
            }
            
        } catch (error) {
            console.error('Error en login:', error);
            this.showError('Error de conexión. Verifica tu red.');
        } finally {
            this.setLoading(false);
        }
    }

    validateCredentials(credentials) {
        const errors = {};
        
        if (!credentials.username || credentials.username.length < 2) {
            errors.username = 'El usuario debe tener al menos 2 caracteres';
        }
        
        if (!credentials.password || credentials.password.length < 4) {
            errors.password = 'La contraseña debe tener al menos 4 caracteres';
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    showFieldErrors(errors) {
        Object.entries(errors).forEach(([field, message]) => {
            this.showFieldError(field, message);
        });
    }

    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        if (inputElement) {
            inputElement.classList.add('error');
        }
    }

    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        if (inputElement) {
            inputElement.classList.remove('error');
        }
    }

    clearAllErrors() {
        ['username', 'password'].forEach(field => this.clearFieldError(field));
        
        if (this.loginError) {
            this.loginError.style.display = 'none';
        }
    }

    showError(message) {
        if (this.loginError) {
            this.loginError.querySelector('.alert-message').textContent = message;
            this.loginError.style.display = 'block';
        }
        
        if (this.loginSuccess) {
            this.loginSuccess.style.display = 'none';
        }
    }

    showSuccess() {
        if (this.loginSuccess) {
            this.loginSuccess.style.display = 'block';
        }
        
        if (this.loginError) {
            this.loginError.style.display = 'none';
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.loginButton) {
            const btnText = this.loginButton.querySelector('.btn-text');
            const btnLoading = this.loginButton.querySelector('.btn-loading');
            
            if (loading) {
                this.loginButton.disabled = true;
                btnText.style.display = 'none';
                btnLoading.style.display = 'inline-flex';
            } else {
                this.loginButton.disabled = false;
                btnText.style.display = 'inline';
                btnLoading.style.display = 'none';
            }
        }
    }

    togglePassword() {
        if (!this.passwordInput) return;
        
        const isPassword = this.passwordInput.type === 'password';
        this.passwordInput.type = isPassword ? 'text' : 'password';
        
        if (this.passwordToggle) {
            this.passwordToggle.textContent = isPassword ? '🙈' : '👁️';
        }
    }

    handleForgotPassword() {
        alert('Para recuperar tu contraseña, contacta al administrador del sistema.');
    }
}

// Exportar el controlador
export default new LoginController();