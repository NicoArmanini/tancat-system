/**
 * TANCAT - Sistema Cliente Main
 * Archivo: cliente-main.js
 * Descripción: Funcionalidad principal conectada al backend
 */

// ====================================
// ESTADO DE LA APLICACIÓN
// ====================================
let appState = {
    sedes: [],
    deportes: [],
    combinacionesDisponibles: [],
    sedeSeleccionada: null,
    deporteSeleccionado: null,
    fechaSeleccionada: null,
    turnosDisponibles: [],
    cargando: false,
    backendConectado: false
};

// ====================================
// INICIALIZACIÓN
// ====================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Inicializando TANCAT Cliente con Backend...');
    
    try {
        // Verificar conexión al backend
        await verificarConexionBackend();
        
        // Configurar UI básica
        setupSmoothScrolling();
        setupMobileMenu();
        setupDateInput();
        
        // Cargar datos desde backend
        await cargarDatosIniciales();
        
        // Configurar formulario de consulta
        setupConsultaForm();
        setupFormFilters();
        
        // Aplicar animaciones
        applyEntranceAnimations();
        
        console.log('✅ TANCAT Cliente inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        mostrarErrorConexion();
    }
}

// ====================================
// CONEXIÓN AL BACKEND
// ====================================
async function verificarConexionBackend() {
    try {
        console.log('🔗 Verificando conexión al backend...');
        
        const conectado = await window.apiClient.checkConnectivity();
        
        if (conectado) {
            appState.backendConectado = true;
            mostrarEstadoConexion('conectado');
            console.log('✅ Backend conectado correctamente');
        } else {
            throw new Error('Backend no disponible');
        }
        
    } catch (error) {
        appState.backendConectado = false;
        mostrarEstadoConexion('desconectado');
        console.error('❌ Error de conexión al backend:', error.message);
        throw error;
    }
}

function mostrarEstadoConexion(estado) {
    // Crear indicador de estado si no existe
    let indicador = document.getElementById('connection-status-indicator');
    
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'connection-status-indicator';
        indicador.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicador);
    }
    
    if (estado === 'conectado') {
        indicador.innerHTML = '🟢 Backend Conectado';
        indicador.style.background = '#d4edda';
        indicador.style.color = '#155724';
        indicador.style.border = '1px solid #c3e6cb';
    } else {
        indicador.innerHTML = '🔴 Sin Conexión Backend';
        indicador.style.background = '#f8d7da';
        indicador.style.color = '#721c24';
        indicador.style.border = '1px solid #f5c6cb';
    }
}

// ====================================
// CARGA DE DATOS DESDE BACKEND
// ====================================
async function cargarDatosIniciales() {
    if (!appState.backendConectado) {
        throw new Error('Backend no conectado');
    }
    
    try {
        console.log('📊 Cargando datos desde backend...');
        
        // Mostrar loading
        setLoadingState(true);
        
        // Cargar datos en paralelo
        const [sedesResponse, deportesResponse, combinacionesResponse] = await Promise.all([
            window.apiClient.obtenerSedes(),
            window.apiClient.obtenerDeportes(),
            window.apiClient.obtenerCombinacionesDisponibles()
        ]);
        
        // Verificar respuestas exitosas
        if (!sedesResponse.success || !deportesResponse.success || !combinacionesResponse.success) {
            throw new Error('Error en respuestas del servidor');
        }
        
        // Actualizar estado
        appState.sedes = sedesResponse.data || [];
        appState.deportes = deportesResponse.data || [];
        appState.combinacionesDisponibles = combinacionesResponse.data || [];
        
        // Poblar selects del formulario
        poblarSelectSedes();
        
        console.log('✅ Datos cargados desde backend:', {
            sedes: appState.sedes.length,
            deportes: appState.deportes.length,
            combinaciones: appState.combinacionesDisponibles.length
        });
        
    } catch (error) {
        console.error('❌ Error al cargar datos desde backend:', error);
        throw error;
    } finally {
        setLoadingState(false);
    }
}

function poblarSelectSedes() {
    const sedeSelect = document.getElementById('sede');
    
    if (!sedeSelect) {
        console.warn('Elemento select de sede no encontrado');
        return;
    }
    
    // Limpiar opciones existentes excepto la primera
    sedeSelect.innerHTML = '<option value="">Selecciona una sede</option>';
    
    // Agregar sedes desde backend
    appState.sedes.forEach(sede => {
        const option = document.createElement('option');
        option.value = sede.id;
        option.textContent = sede.nombre;
        option.dataset.direccion = sede.direccion;
        option.dataset.horarios = sede.horarios.textoCompleto;
        sedeSelect.appendChild(option);
    });
}

// ====================================
// NAVEGACIÓN Y UI
// ====================================
function setupSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const header = document.querySelector('.main-header');
                const headerHeight = header ? header.offsetHeight : 80;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                updateActiveNavLink(this);
            }
        });
    });
    
    window.addEventListener('scroll', debounce(detectarSeccionActiva, 100));
}

function detectarSeccionActiva() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    const header = document.querySelector('.main-header');
    const headerHeight = header ? header.offsetHeight : 80;
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - headerHeight - 50;
        const sectionHeight = section.offsetHeight;
        
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

function setupMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', function() {
            mainNav.classList.toggle('mobile-active');
            this.classList.toggle('active');
        });
        
        mainNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('mobile-active');
                mobileToggle.classList.remove('active');
            });
        });
    }
}

function updateActiveNavLink(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    activeLink.classList.add('active');
}

function debounce(func, wait) {
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
// FORMULARIO DE CONSULTA
// ====================================
function setupConsultaForm() {
    const form = document.getElementById('consultaForm');
    
    if (form) {
        form.addEventListener('submit', handleConsultaSubmit);
    } else {
        console.warn('Formulario de consulta no encontrado');
    }
}

function setupDateInput() {
    const fechaInput = document.getElementById('fecha');
    
    if (fechaInput) {
        const today = new Date().toISOString().split('T')[0];
        fechaInput.min = today;
        fechaInput.value = today;
        
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        fechaInput.max = maxDate.toISOString().split('T')[0];
    }
}

function setupFormFilters() {
    const sedeSelect = document.getElementById('sede');
    const deporteSelect = document.getElementById('deporte');
    
    if (sedeSelect) {
        sedeSelect.addEventListener('change', function() {
            const sedeId = parseInt(this.value);
            appState.sedeSeleccionada = sedeId;
            updateDeportesDisponibles(sedeId);
            mostrarInfoSede(sedeId);
        });
    }
    
    if (deporteSelect) {
        deporteSelect.addEventListener('change', function() {
            appState.deporteSeleccionado = parseInt(this.value);
        });
    }
}

function updateDeportesDisponibles(sedeId) {
    const deporteSelect = document.getElementById('deporte');
    
    if (!deporteSelect) {
        console.warn('Select de deporte no encontrado');
        return;
    }
    
    if (!sedeId) {
        deporteSelect.innerHTML = '<option value="">Selecciona un deporte</option>';
        return;
    }
    
    // Encontrar la sede en las combinaciones disponibles
    const sedeInfo = appState.combinacionesDisponibles.find(s => s.sede.id === sedeId);
    
    if (!sedeInfo) {
        deporteSelect.innerHTML = '<option value="">No hay deportes disponibles</option>';
        return;
    }
    
    // Limpiar y poblar opciones de deportes
    deporteSelect.innerHTML = '<option value="">Selecciona un deporte</option>';
    
    sedeInfo.deportes.forEach(deporte => {
        const option = document.createElement('option');
        option.value = deporte.id;
        option.textContent = `${deporte.nombre} (${deporte.canchas} cancha${deporte.canchas > 1 ? 's' : ''})`;
        deporteSelect.appendChild(option);
    });
}

function mostrarInfoSede(sedeId) {
    if (!sedeId) {
        ocultarInfoSede();
        return;
    }
    
    const sede = appState.sedes.find(s => s.id === sedeId);
    
    if (!sede) return;
    
    let infoElement = document.getElementById('sede-info-display');
    
    if (!infoElement) {
        infoElement = document.createElement('div');
        infoElement.id = 'sede-info-display';
        infoElement.className = 'sede-info-display';
        
        const form = document.getElementById('consultaForm');
        if (form && form.parentNode) {
            form.parentNode.insertBefore(infoElement, form.nextSibling);
        }
    }
    
    infoElement.innerHTML = `
        <div class="info-sede-seleccionada">
            <h4>📍 ${sede.nombre}</h4>
            <p><strong>Dirección:</strong> ${sede.direccion}</p>
            <p><strong>Horarios:</strong> ${sede.horarios.textoCompleto}</p>
        </div>
    `;
    
    infoElement.style.cssText = `
        margin-top: 1rem;
        padding: 1rem;
        background: var(--background-light);
        border-radius: 8px;
        border-left: 4px solid var(--accent-red);
        animation: fadeInUp 0.3s ease-out;
    `;
}

function ocultarInfoSede() {
    const infoElement = document.getElementById('sede-info-display');
    if (infoElement) {
        infoElement.remove();
    }
}

// ====================================
// MANEJO DE CONSULTAS AL BACKEND
// ====================================
async function handleConsultaSubmit(e) {
    e.preventDefault();
    
    if (!appState.backendConectado) {
        mostrarErrorConsulta('No hay conexión al servidor. Verifica tu conexión.');
        return;
    }
    
    const formData = new FormData(e.target);
    const consultaData = {
        sede_id: parseInt(formData.get('sede')),
        deporte_id: parseInt(formData.get('deporte')),
        fecha: formData.get('fecha')
    };
    
    // Validar datos localmente
    if (!validateConsultaData(consultaData)) {
        return;
    }
    
    // Actualizar estado
    Object.assign(appState, {
        sedeSeleccionada: consultaData.sede_id,
        deporteSeleccionado: consultaData.deporte_id,
        fechaSeleccionada: consultaData.fecha
    });
    
    try {
        setLoadingState(true);
        
        console.log('🔍 Consultando disponibilidad al backend...', consultaData);
        
        // Realizar consulta al backend
        const response = await window.apiClient.consultarDisponibilidad(
            consultaData.sede_id,
            consultaData.deporte_id,
            consultaData.fecha
        );
        
        if (response.success) {
            console.log('✅ Disponibilidad obtenida:', response.data);
            mostrarResultadosDisponibilidad(response.data);
        } else {
            throw new Error(response.message || 'Error en la consulta');
        }
        
    } catch (error) {
        console.error('❌ Error al consultar disponibilidad:', error);
        mostrarErrorConsulta(error.message || 'Error al consultar disponibilidad. Intenta nuevamente.');
    } finally {
        setLoadingState(false);
    }
}

function validateConsultaData(data) {
    const errores = [];
    
    if (!data.sede_id || isNaN(data.sede_id)) {
        errores.push('Debe seleccionar una sede válida');
    }
    
    if (!data.deporte_id || isNaN(data.deporte_id)) {
        errores.push('Debe seleccionar un deporte válido');
    }
    
    if (!data.fecha) {
        errores.push('Debe seleccionar una fecha');
    } else {
        const fechaConsulta = new Date(data.fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fechaConsulta < hoy) {
            errores.push('La fecha debe ser hoy o posterior');
        }
        
        const maxFecha = new Date();
        maxFecha.setDate(maxFecha.getDate() + 30);
        
        if (fechaConsulta > maxFecha) {
            errores.push('No se pueden hacer consultas con más de 30 días de anticipación');
        }
    }
    
    if (errores.length > 0) {
        mostrarErrorConsulta(errores.join('\n'));
        return false;
    }
    
    return true;
}

// ====================================
// MOSTRAR RESULTADOS DESDE BACKEND
// ====================================
function mostrarResultadosDisponibilidad(data) {
    let resultContainer = document.getElementById('resultados-disponibilidad');
    
    if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.id = 'resultados-disponibilidad';
        resultContainer.className = 'resultados-container';
        
        const consultaSection = document.querySelector('.reservas-section .container');
        if (consultaSection) {
            consultaSection.appendChild(resultContainer);
        }
    }
    
    const turnosDisponibles = data.turnos.filter(turno => turno.disponible);
    const turnosOcupados = data.turnos.filter(turno => !turno.disponible);
    
    resultContainer.innerHTML = `
        <div class="resultados-header">
            <h3>Disponibilidad para ${data.deporte.nombre}</h3>
            <p><strong>Sede:</strong> ${data.sede.nombre} | <strong>Fecha:</strong> ${data.fecha.formateada}</p>
            <div class="resumen-disponibilidad">
                <div class="resumen-item">
                    <span class="numero">${data.resumen.disponibles}</span>
                    <span class="texto">Disponibles</span>
                </div>
                <div class="resumen-item">
                    <span class="numero">${data.resumen.ocupados}</span>
                    <span class="texto">Ocupados</span>
                </div>
                <div class="resumen-item">
                    <span class="numero">${data.resumen.porcentajeDisponibilidad}%</span>
                    <span class="texto">Disponibilidad</span>
                </div>
            </div>
        </div>
        
        ${turnosDisponibles.length > 0 ? `
            <div class="turnos-disponibles">
                <h4>✅ Turnos Disponibles (${turnosDisponibles.length})</h4>
                <div class="turnos-grid">
                    ${turnosDisponibles.map(turno => `
                        <div class="turno-card disponible" data-turno-id="${turno.id}">
                            <div class="turno-hora">${turno.horaInicio} - ${turno.horaFin}</div>
                            <div class="turno-info">
                                <span class="turno-cancha">Cancha ${turno.cancha.numero}</span>
                                <span class="turno-precio">${turno.precio.toLocaleString('es-AR')}</span>
                            </div>
                            <button class="btn-reservar" onclick="iniciarReserva('${turno.id}')">
                                Consultar Reserva
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div class="sin-turnos">
                <h4>😔 No hay turnos disponibles</h4>
                <p>Intenta con otra fecha o deporte.</p>
            </div>
        `}
        
        ${turnosOcupados.length > 0 ? `
            <div class="turnos-ocupados">
                <h4>❌ Turnos No Disponibles (${turnosOcupados.length})</h4>
                <div class="turnos-grid">
                    ${turnosOcupados.map(turno => `
                        <div class="turno-card ocupado">
                            <div class="turno-hora">${turno.horaInicio} - ${turno.horaFin}</div>
                            <div class="turno-info">
                                <span class="turno-cancha">Cancha ${turno.cancha.numero}</span>
                                <span class="turno-estado">Ocupado</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="consulta-contacto">
            <div class="contacto-info">
                <h4>📞 Para Confirmar tu Reserva</h4>
                <p><strong>Sede Principal:</strong> Jacinto Ríos 232</p>
                <p><strong>Reservas:</strong> Presenciales o por WhatsApp</p>
                <p><strong>💡 Importante:</strong> Las reservas se gestionan desde la sede principal. Puedes pagar el total del turno o dejar una seña.</p>
                <p><strong>✅ Datos:</strong> Información obtenida en tiempo real desde nuestro sistema.</p>
            </div>
        </div>
    `;
    
    // Aplicar estilos a los resultados
    aplicarEstilosResultados();
    
    // Scroll suave hacia los resultados
    setTimeout(() => {
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ====================================
// UTILIDADES
// ====================================
function setLoadingState(loading) {
    appState.cargando = loading;
    const submitBtn = document.querySelector('#consultaForm button[type="submit"]');
    
    if (submitBtn) {
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                    <span class="spinner"></span>
                    Consultando al servidor...
                </span>
            `;
            submitBtn.classList.add('loading');
            
            if (!document.getElementById('spin-animation')) {
                const spinStyle = document.createElement('style');
                spinStyle.id = 'spin-animation';
                spinStyle.textContent = `
                    .spinner {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        border: 2px solid transparent;
                        border-top: 2px solid currentColor;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(spinStyle);
            }
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ver Disponibilidad';
            submitBtn.classList.remove('loading');
        }
    }
}

function mostrarErrorConsulta(mensaje) {
    const errorModal = document.createElement('div');
    errorModal.className = 'error-modal';
    errorModal.innerHTML = `
        <div class="error-modal-content">
            <div class="error-icon">⚠️</div>
            <h3>Error en la consulta</h3>
            <p>${mensaje.replace(/\n/g, '<br>')}</p>
            <button class="btn-cerrar-error">Entendido</button>
        </div>
        <div class="error-modal-backdrop"></div>
    `;
    
    errorModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const modalContent = errorModal.querySelector('.error-modal-content');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        z-index: 10001;
        position: relative;
    `;
    
    const backdrop = errorModal.querySelector('.error-modal-backdrop');
    backdrop.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
    `;
    
    const cerrarModal = () => {
        errorModal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(errorModal)) {
                document.body.removeChild(errorModal);
            }
        }, 300);
    };
    
    errorModal.querySelector('.btn-cerrar-error').addEventListener('click', cerrarModal);
    backdrop.addEventListener('click', cerrarModal);
    
    document.addEventListener('keydown', function handleEscape(e) {
        if (e.key === 'Escape') {
            cerrarModal();
            document.removeEventListener('keydown', handleEscape);
        }
    });
    
    document.body.appendChild(errorModal);
}

function mostrarErrorConexion() {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            text-align: center;
            z-index: 10000;
            max-width: 400px;
            width: 90%;
        ">
            <h3 style="color: #e74c3c; margin-bottom: 1rem;">🔌 Sin Conexión al Servidor</h3>
            <p style="margin-bottom: 1.5rem; color: #666;">
                No se pudo conectar al backend. Verifica que el servidor esté ejecutándose en puerto 3000.
            </p>
            <button onclick="location.reload()" style="
                background: #e74c3c;
                color: white;
                border: none;
                padding: 0.8rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
            ">
                Reintentar
            </button>
        </div>
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        "></div>
    `;
    
    document.body.appendChild(errorDiv);
}

function aplicarEstilosResultados() {
    if (document.getElementById('estilos-resultados')) return;
    
    const style = document.createElement('style');
    style.id = 'estilos-resultados';
    style.textContent = `
        .resultados-container {
            margin-top: 2rem;
            padding: 2rem;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            animation: fadeInUp 0.5s ease-out;
        }
        
        .resultados-header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--background-lighter);
        }
        
        .resultados-header h3 {
            color: var(--primary-dark);
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }
        
        .resumen-disponibilidad {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        
        .resumen-item {
            text-align: center;
            min-width: 80px;
        }
        
        .resumen-item .numero {
            display: block;
            font-size: 2rem;
            font-weight: bold;
            color: var(--accent-red);
        }
        
        .resumen-item .texto {
            display: block;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }
        
        .turnos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .turno-card {
            padding: 1.2rem;
            border-radius: 10px;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 2px solid;
        }
        
        .turno-card.disponible {
            background: rgba(39, 174, 96, 0.05);
            border-color: var(--success-green);
        }
        
        .turno-card.ocupado {
            background: rgba(231, 76, 60, 0.05);
            border-color: var(--accent-red);
            opacity: 0.7;
        }
        
        .turno-card.disponible:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(39, 174, 96, 0.2);
        }
        
        .btn-reservar {
            background: var(--success-green);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            width: 100%;
            font-size: 0.9rem;
        }
        
        .btn-reservar:hover {
            background: #219a52;
            transform: translateY(-1px);
        }
        
        .consulta-contacto {
            background: var(--background-light);
            border-radius: 10px;
            padding: 1.5rem;
            border-left: 4px solid var(--success-green);
            margin-top: 2rem;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

function applyEntranceAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.sede-card, .deporte-card, .servicio-item').forEach(el => {
        observer.observe(el);
    });
}

// ====================================
// FUNCIONES GLOBALES
// ====================================
window.iniciarReserva = function(turnoId) {
    const sedeInfo = appState.sedes.find(s => s.id === appState.sedeSeleccionada);
    const deporteInfo = appState.deportes.find(d => d.id === appState.deporteSeleccionado);
    
    const mensaje = `Para reservar este turno:

📍 Acércate a: ${sedeInfo?.nombre || 'Sede Principal'} - Jacinto Ríos 232
🏓 Deporte: ${deporteInfo?.nombre || 'Seleccionado'}
📅 Fecha: ${appState.fechaSeleccionada}

También puedes reservar por WhatsApp.

💰 Opciones de pago:
• Pago total del turno
• Dejar una seña

✅ Datos obtenidos en tiempo real desde nuestro sistema.`;
    
    mostrarModalReserva(mensaje, turnoId);
};

function mostrarModalReserva(mensaje, turnoId) {
    const modal = document.createElement('div');
    modal.className = 'reserva-modal';
    modal.innerHTML = `
        <div class="reserva-modal-content">
            <div class="reserva-icon">🏓</div>
            <h3>Información de Reserva</h3>
            <div class="mensaje-reserva">${mensaje.replace(/\n/g, '<br>')}</div>
            <div class="modal-buttons">
                <button class="btn-entendido">Entendido</button>
                <button class="btn-nueva-consulta">Nueva Consulta</button>
            </div>
        </div>
        <div class="reserva-modal-backdrop"></div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const modalContent = modal.querySelector('.reserva-modal-content');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        z-index: 10001;
        position: relative;
    `;
    
    const backdrop = modal.querySelector('.reserva-modal-backdrop');
    backdrop.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
    `;
    
    const mensajeDiv = modal.querySelector('.mensaje-reserva');
    mensajeDiv.style.cssText = `
        text-align: left;
        line-height: 1.6;
        color: var(--text-secondary);
        margin: 1.5rem 0;
        padding: 1rem;
        background: var(--background-light);
        border-radius: 8px;
        border-left: 4px solid var(--success-green);
    `;
    
    const modalButtons = modal.querySelector('.modal-buttons');
    modalButtons.style.cssText = `
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-top: 1.5rem;
        flex-wrap: wrap;
    `;
    
    const btnEntendido = modal.querySelector('.btn-entendido');
    const btnNuevaConsulta = modal.querySelector('.btn-nueva-consulta');
    
    [btnEntendido, btnNuevaConsulta].forEach(btn => {
        btn.style.cssText = `
            padding: 0.8rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        `;
    });
    
    btnEntendido.style.background = 'var(--success-green)';
    btnEntendido.style.color = 'white';
    
    btnNuevaConsulta.style.background = 'var(--background-lighter)';
    btnNuevaConsulta.style.color = 'var(--primary-dark)';
    
    const cerrarModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        }, 300);
    };
    
    btnEntendido.addEventListener('click', cerrarModal);
    btnNuevaConsulta.addEventListener('click', () => {
        cerrarModal();
        const form = document.getElementById('consultaForm');
        if (form) {
            form.reset();
            setupDateInput();
        }
        ocultarInfoSede();
        
        const resultContainer = document.getElementById('resultados-disponibilidad');
        if (resultContainer) {
            resultContainer.remove();
        }
        
        const reservasSection = document.getElementById('reservas');
        if (reservasSection) {
            reservasSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    backdrop.addEventListener('click', cerrarModal);
    
    document.body.appendChild(modal);
    
    console.log('📋 Información de reserva para turno:', turnoId, {
        sede: appState.sedeSeleccionada,
        deporte: appState.deporteSeleccionado,
        fecha: appState.fechaSeleccionada
    });
}

// ====================================
// FUNCIONES DE DEPURACIÓN
// ====================================
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.TANCAT_DEBUG = {
        appState: () => appState,
        testBackend: async () => {
            try {
                const conectado = await window.apiClient.testConnection();
                console.log('🧪 Test de conexión:', conectado ? '✅ Exitoso' : '❌ Falló');
                return conectado;
            } catch (error) {
                console.error('🧪 Error en test:', error);
                return false;
            }
        },
        reloadData: () => cargarDatosIniciales(),
        getConnectionStatus: () => window.apiClient.getConnectionStatus(),
        clearCache: () => window.apiClient.clearCache()
    };
    
    console.log('🛠️ Modo desarrollo activo. Funciones de debug disponibles en TANCAT_DEBUG');
}

// ====================================
// MANEJO DE ERRORES GLOBALES
// ====================================
window.addEventListener('error', function(e) {
    console.error('❌ Error en cliente:', e.error);
    
    if (e.error && e.error.message && e.error.message.includes('fetch')) {
        console.warn('⚠️ Error de red detectado');
        mostrarEstadoConexion('desconectado');
    }
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('❌ Promise rechazada:', e.reason);
    
    if (e.reason && e.reason.message) {
        if (e.reason.message.includes('Failed to fetch')) {
            console.warn('⚠️ Error de conexión detectado');
            mostrarEstadoConexion('desconectado');
            appState.backendConectado = false;
        }
    }
});

console.log('📋 cliente-main.js cargado - Conectado al Backend TANCAT');