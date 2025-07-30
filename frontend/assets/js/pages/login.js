/**
 * TANCAT - Sistema de Administración Frontend
 * Archivo: assets/js/pages/login.js
 * Descripción: Controller para la página de login
 */

class LoginController {
    constructor() {
        this.form = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupForm();
        this.setupEventListeners();
        this.checkAuthRedirect();
        
        console.log('🔐 LoginController inicializado');
    }

    setupForm() {
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.submitButton = this.form?.querySelector('button[type="submit"]');
        this.errorContainer = document.getElementById('login-error');
        
        if (!this.form) {
            console.error('❌ Formulario de login no encontrado');
            return;
        }
    }

    setupEventListeners() {
        if (!this.form) return;

        // Submit del formulario
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Enter en campos de input
        this.emailInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.passwordInput?.focus();
            }
        });

        this.passwordInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.form.requestSubmit();
            }
        });

        // Limpiar errores al escribir
        [this.emailInput, this.passwordInput].forEach(input => {
            input?.addEventListener('input', () => this.clearErrors());
        });

        // Credenciales de desarrollo
        if (window.TANCAT_CONFIG.DEBUG) {
            this.addDevelopmentButtons();
        }
    }

    async checkAuthRedirect() {
        // Si ya está autenticado, redirigir al dashboard
        try {
            const isAuthenticated = await window.authService.isAuthenticated();
            if (isAuthenticated) {
                console.log('🔄 Usuario ya autenticado, redirigiendo...');
                window.router.navigate('/dashboard');
            }
        } catch (error) {
            console.warn('⚠️ Error verificando autenticación:', error);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isLoading) return;

        try {
            this.setLoading(true);
            this.clearErrors();

            // Obtener datos del formulario
            const formData = new FormData(this.form);
            const credentials = {
                email: formData.get('email')?.trim(),
                password: formData.get('password')
            };

            // Validar datos
            const validation = this.validateCredentials(credentials);
            if (!validation.isValid) {
                this.showError(validation.errors.join('\n'));
                return;
            }

            // Intentar login
            const result = await window.authService.login(credentials);

            if (result.success) {
                this.showSuccess();
                
                // Notificar cambio de autenticación
                window.dispatchEvent(new CustomEvent('tancat:auth', {
                    detail: { type: 'login', data: result }
                }));

                // Redirigir al dashboard
                setTimeout(() => {
                    window.router.navigate('/dashboard');
                }, 1500);

            } else {
                this.showError(result.error || 'Error de autenticación');
            }

        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showError('Error de conexión. Verifica tu red e intenta nuevamente.');
        } finally {
            this.setLoading(false);
        }
    }

    validateCredentials(credentials) {
        const errors = [];

        if (!credentials.email || credentials.email.length < 3) {
            errors.push('El email o usuario debe tener al menos 3 caracteres');
        }

        if (!credentials.password || credentials.password.length < 4) {
            errors.push('La contraseña debe tener al menos 4 caracteres');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    setLoading(loading) {
        this.isLoading = loading;

        if (!this.submitButton) return;

        if (loading) {
            this.submitButton.disabled = true;
            this.submitButton.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <div class="loading-spinner" style="width: 16px; height: 16px;"></div>
                    Iniciando sesión...
                </div>
            `;
            this.form.classList.add('loading');
        } else {
            this.submitButton.disabled = false;
            this.submitButton.textContent = 'Ingresar al Sistema';
            this.form.classList.remove('loading');
        }
    }

    showError(message) {
        if (!this.errorContainer) {
            // Crear contenedor de error si no existe
            this.errorContainer = document.createElement('div');
            this.errorContainer.id = 'login-error';
            this.errorContainer.className = 'error-message';
            this.form.appendChild(this.errorContainer);
        }

        this.errorContainer.textContent = message;
        this.errorContainer.style.display = 'block';
        this.errorContainer.style.background = '#fdf2f2';
        this.errorContainer.style.color = '#e74c3c';
        this.errorContainer.style.padding = '1rem';
        this.errorContainer.style.borderRadius = '8px';
        this.errorContainer.style.marginTop = '1rem';
        this.errorContainer.style.border = '1px solid #e74c3c';

        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            this.clearErrors();
        }, 5000);
    }

    showSuccess() {
        this.clearErrors();

        if (!this.errorContainer) {
            this.errorContainer = document.createElement('div');
            this.errorContainer.id = 'login-success';
            this.errorContainer.className = 'success-message';
            this.form.appendChild(this.errorContainer);
        }

        this.errorContainer.textContent = '✅ Inicio de sesión exitoso. Redirigiendo...';
        this.errorContainer.style.display = 'block';
        this.errorContainer.style.background = '#f2fdf2';
        this.errorContainer.style.color = '#27ae60';
        this.errorContainer.style.padding = '1rem';
        this.errorContainer.style.borderRadius = '8px';
        this.errorContainer.style.marginTop = '1rem';
        this.errorContainer.style.border = '1px solid #27ae60';
    }

    clearErrors() {
        if (this.errorContainer) {
            this.errorContainer.style.display = 'none';
        }

        // Limpiar estilos de error en inputs
        [this.emailInput, this.passwordInput].forEach(input => {
            if (input) {
                input.style.borderColor = '';
                input.style.backgroundColor = '';
            }
        });
    }

    addDevelopmentButtons() {
        const devContainer = document.createElement('div');
        devContainer.className = 'dev-buttons';
        devContainer.style.cssText = `
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(52, 73, 94, 0.1);
            border-radius: 8px;
            border: 1px dashed #34495e;
        `;

        devContainer.innerHTML = `
            <div style="margin-bottom: 0.5rem; font-size: 0.8rem; color: #7f8c8d; font-weight: bold;">
                🛠️ DESARROLLO - Credenciales de prueba:
            </div>
            <button type="button" id="loginAdmin" class="btn-dev" style="
                background: #3498db; 
                color: white; 
                border: none; 
                padding: 0.5rem 1rem; 
                border-radius: 4px; 
                margin-right: 0.5rem;
                font-size: 0.8rem;
                cursor: pointer;
            ">
                👨‍💼 Admin
            </button>
            <button type="button" id="loginEmpleado" class="btn-dev" style="
                background: #2ecc71; 
                color: white; 
                border: none; 
                padding: 0.5rem 1rem; 
                border-radius: 4px; 
                font-size: 0.8rem;
                cursor: pointer;
            ">
                👤 Empleado
            </button>
        `;

        this.form.appendChild(devContainer);

        // Event listeners para botones de desarrollo
        document.getElementById('loginAdmin')?.addEventListener('click', () => {
            if (this.emailInput) this.emailInput.value = 'admin@tancat.com';
            if (this.passwordInput) this.passwordInput.value = 'admin123';
        });

        document.getElementById('loginEmpleado')?.addEventListener('click', () => {
            if (this.emailInput) this.emailInput.value = 'empleado@tancat.com';
            if (this.passwordInput) this.passwordInput.value = 'empleado123';
        });
    }
}

// ====================================
// INICIALIZACIÓN AUTOMÁTICA
// ====================================

// Inicializar cuando se carga la página de login
if (document.getElementById('loginForm')) {
    window.loginController = new LoginController();
} else {
    // Si no hay formulario, esperar a que se cargue dinámicamente
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const loginForm = document.getElementById('loginForm');
                if (loginForm && !window.loginController) {
                    window.loginController = new LoginController();
                    observer.disconnect();
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Exponer para debugging
if (window.TANCAT_CONFIG?.DEBUG) {
    window.TANCAT_LOGIN_DEBUG = {
        controller: () => window.loginController,
        testLogin: (email, password) => {
            if (window.loginController) {
                window.loginController.emailInput.value = email;
                window.loginController.passwordInput.value = password;
                window.loginController.form.requestSubmit();
            }
        },
        fillAdmin: () => {
            if (window.loginController) {
                window.loginController.emailInput.value = 'admin@tancat.com';
                window.loginController.passwordInput.value = 'admin123';
            }
        }
    };
}