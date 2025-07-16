/**
 * TANCAT - Sistema Cliente Main
 * Archivo: cliente-main.js
 * Descripción: Funcionalidad principal para la página del cliente
 */

// ====================================
// CONFIGURACIÓN Y CONSTANTES
// ====================================
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    ENDPOINTS: {
        SEDES: '/cliente/sedes',
        DEPORTES: '/cliente/deportes',
        CANCHAS: '/cliente/canchas',
        CONSULTA_DISPONIBILIDAD: '/cliente/consulta-disponibilidad',
        TORNEOS: '/cliente/torneos',
        ESTADISTICAS: '/cliente/estadisticas',
        COMBINACIONES: '/cliente/combinaciones-disponibles'
    },
    MODO_OFFLINE: false // Cambiar a false cuando el backend esté listo
};

// Datos de ejemplo para modo offline
const DATOS_EJEMPLO = {
    sedes: [
        {
            id: 1,
            nombre: "Jacinto Ríos",
            direccion: "Jacinto Ríos 232, Córdoba",
            telefono: null,
            horarios: {
                apertura: "09:00",
                cierre: "00:00",
                textoCompleto: "Lun-Sáb: 9:00-00:00 / Dom: 17:00-23:00"
            }
        },
        {
            id: 2,
            nombre: "Rincón",
            direccion: "Rincón 985, Córdoba",
            telefono: null,
            horarios: {
                apertura: "17:00",
                cierre: "00:00",
                textoCompleto: "Lun-Sáb: 17:00-00:00 / Dom: Cerrado"
            }
        }
    ],
    deportes: [
        { id: 1, nombre: "Pádel", descripcion: "Deporte principal del complejo", duracion: 90, precioBase: 3000 },
        { id: 2, nombre: "Básquet", descripcion: "Canchas 3v3 y completa", duracion: 60, precioBase: 2000 },
        { id: 3, nombre: "Ping Pong", descripcion: "Mesas para toda la familia", duracion: 30, precioBase: 800 },
        { id: 4, nombre: "Squash", descripcion: "Cancha profesional", duracion: 45, precioBase: 1500 },
        { id: 5, nombre: "Vóley", descripcion: "Cancha compartida", duracion: 60, precioBase: 1800 }
    ],
    combinaciones: [
        {
            sede: { id: 1, nombre: "Jacinto Ríos" },
            deportes: [
                { id: 1, nombre: "Pádel", canchas: 2 },
                { id: 2, nombre: "Básquet", canchas: 1 },
                { id: 3, nombre: "Ping Pong", canchas: 3 }
            ]
        },
        {
            sede: { id: 2, nombre: "Rincón" },
            deportes: [
                { id: 1, nombre: "Pádel", canchas: 2 },
                { id: 2, nombre: "Básquet", canchas: 1 },
                { id: 3, nombre: "Ping Pong", canchas: 1 },
                { id: 4, nombre: "Squash", canchas: 1 },
                { id: 5, nombre: "Vóley", canchas: 1 }
            ]
        }
    ]
};

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
    cache: new Map(),
    backendDisponible: false
};

// ====================================
// UTILIDADES DE API
// ====================================
class ApiClient {
    static async request(endpoint, options = {}) {
        // Si estamos en modo offline, usar datos de ejemplo
        if (CONFIG.MODO_OFFLINE) {
            return this.getMockData(endpoint, options);
        }
        
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            // Marcar backend como disponible
            appState.backendDisponible = true;
            return data;
        } catch (error) {
            console.warn(`Backend no disponible para ${endpoint}, usando datos de ejemplo:`, error.message);
            appState.backendDisponible = false;
            
            // Fallback a datos de ejemplo
            return this.getMockData(endpoint, options);
        }
    }
    
    static getMockData(endpoint, options = {}) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let data;
                
                switch (endpoint) {
                    case CONFIG.ENDPOINTS.SEDES:
                        data = { success: true, data: DATOS_EJEMPLO.sedes };
                        break;
                        
                    case CONFIG.ENDPOINTS.DEPORTES:
                        data = { success: true, data: DATOS_EJEMPLO.deportes };
                        break;
                        
                    case CONFIG.ENDPOINTS.COMBINACIONES:
                        data = { success: true, data: DATOS_EJEMPLO.combinaciones };
                        break;
                        
                    case CONFIG.ENDPOINTS.CONSULTA_DISPONIBILIDAD:
                        data = this.generarDisponibilidadEjemplo(options.body ? JSON.parse(options.body) : {});
                        break;
                        
                    default:
                        data = { success: true, data: [] };
                }
                
                resolve(data);
            }, 500); // Simular latencia de red
        });
    }
    
    static generarDisponibilidadEjemplo(consultaData) {
        const { sede_id, deporte_id, fecha } = consultaData;
        
        const sede = DATOS_EJEMPLO.sedes.find(s => s.id === sede_id);
        const deporte = DATOS_EJEMPLO.deportes.find(d => d.id === deporte_id);
        
        if (!sede || !deporte) {
            return { success: false, message: 'Sede o deporte no encontrado' };
        }
        
        // Generar turnos de ejemplo
        const horarios = this.getHorariosPorDeporteYSede(deporte_id, sede_id);
        const turnos = horarios.map((hora, index) => ({
            id: `turno_${index}`,
            horaInicio: hora,
            horaFin: this.calcularHoraFin(hora, deporte.duracion),
            cancha: {
                id: Math.floor(index / 4) + 1,
                numero: Math.floor(index / 4) + 1
            },
            precio: deporte.precioBase,
            disponible: Math.random() > 0.3 // 70% disponible
        }));
        
        const disponibles = turnos.filter(t => t.disponible).length;
        const ocupados = turnos.length - disponibles;
        
        return {
            success: true,
            data: {
                fecha: {
                    valor: fecha,
                    nombreDia: this.getNombreDia(fecha),
                    formateada: this.formatearFecha(fecha)
                },
                sede: {
                    id: sede_id,
                    nombre: sede.nombre
                },
                deporte: {
                    id: deporte_id,
                    nombre: deporte.nombre
                },
                turnos: turnos,
                resumen: {
                    total: turnos.length,
                    disponibles: disponibles,
                    ocupados: ocupados,
                    porcentajeDisponibilidad: Math.round((disponibles / turnos.length) * 100)
                }
            }
        };
    }
    
    static getHorariosPorDeporteYSede(deporteId, sedeId) {
        const horariosBase = {
            1: ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30', '20:00', '21:30'], // Pádel
            2: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'], // Básquet
            3: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30'], // Ping Pong
            4: ['17:00', '17:45', '18:30', '19:15', '20:00', '20:45', '21:30'], // Squash
            5: ['17:00', '18:00', '19:00', '20:00', '21:00'] // Vóley
        };
        
        let horarios = horariosBase[deporteId] || horariosBase[1];
        
        // Si es sede Rincón (id: 2), filtrar horarios desde las 17:00
        if (sedeId === 2) {
            horarios = horarios.filter(hora => {
                const [horas] = hora.split(':').map(Number);
                return horas >= 17;
            });
        }
        
        return horarios;
    }
    
    static calcularHoraFin(horaInicio, duracionMinutos) {
        const [horas, minutos] = horaInicio.split(':').map(Number);
        const totalMinutos = horas * 60 + minutos + duracionMinutos;
        const horasFin = Math.floor(totalMinutos / 60);
        const minutosFin = totalMinutos % 60;
        
        return `${horasFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')}`;
    }
    
    static getNombreDia(fecha) {
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const fechaObj = new Date(fecha + 'T00:00:00');
        return dias[fechaObj.getDay()];
    }
    
    static formatearFecha(fecha) {
        const fechaObj = new Date(fecha + 'T00:00:00');
        return fechaObj.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    static async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(fullEndpoint, { method: 'GET' });
    }
    
    static async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

// ====================================
// INICIALIZACIÓN
// ====================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Inicializando TANCAT Cliente...');
    
    try {
        // Configurar navegación y UI básica
        setupSmoothScrolling();
        setupMobileMenu();
        setupDateInput();
        
        // Mostrar indicador de modo
        mostrarIndicadorModo();
        
        // Cargar datos iniciales
        await cargarDatosIniciales();
        
        // Configurar formulario de consulta
        setupConsultaForm();
        setupFormFilters();
        
        // Aplicar animaciones de entrada
        applyEntranceAnimations();
        
        console.log('✅ TANCAT Cliente inicializado correctamente');
        console.log(`📡 Modo: ${CONFIG.MODO_OFFLINE ? 'OFFLINE (datos de ejemplo)' : 'ONLINE (conectado al backend)'}`);
        
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        mostrarErrorGeneral('Error al cargar la aplicación. Usando datos de ejemplo.');
    }
}

function mostrarIndicadorModo() {
    if (CONFIG.MODO_OFFLINE) {
        const indicador = document.createElement('div');
        indicador.id = 'modo-offline-indicator';
        indicador.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                padding: 0.5rem 1rem;
                text-align: center;
                font-size: 0.9rem;
                font-weight: bold;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            ">
                🔧 MODO DESARROLLO - Usando datos de ejemplo (Backend no conectado)
            </div>
        `;
        
        document.body.appendChild(indicador);
        
        // Ajustar el header para que no se superponga
        const header = document.querySelector('.main-header');
        if (header) {
            header.style.top = '40px';
        }
        
        // Ajustar el hero para compensar
        const hero = document.querySelector('.hero-section');
        if (hero) {
            hero.style.paddingTop = '100px';
        }
    }
}

// ====================================
// CARGA DE DATOS INICIALES
// ====================================
async function cargarDatosIniciales() {
    try {
        // Cargar datos en paralelo
        const [sedesData, deportesData, combinacionesData] = await Promise.all([
            ApiClient.get(CONFIG.ENDPOINTS.SEDES),
            ApiClient.get(CONFIG.ENDPOINTS.DEPORTES),
            ApiClient.get(CONFIG.ENDPOINTS.COMBINACIONES)
        ]);
        
        // Actualizar estado
        appState.sedes = sedesData.data || [];
        appState.deportes = deportesData.data || [];
        appState.combinacionesDisponibles = combinacionesData.data || [];
        
        // Poblar selects del formulario
        poblarSelectSedes();
        
        console.log('✅ Datos iniciales cargados:', {
            sedes: appState.sedes.length,
            deportes: appState.deportes.length,
            combinaciones: appState.combinacionesDisponibles.length
        });
        
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        
        // Fallback a datos de ejemplo
        appState.sedes = DATOS_EJEMPLO.sedes;
        appState.deportes = DATOS_EJEMPLO.deportes;
        appState.combinacionesDisponibles = DATOS_EJEMPLO.combinaciones;
        
        poblarSelectSedes();
        
        console.warn('⚠️ Usando datos de ejemplo debido a error en carga inicial');
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
    
    // Agregar sedes disponibles
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
                const offset = CONFIG.MODO_OFFLINE ? 40 : 0; // Compensar indicador de modo
                const targetPosition = targetElement.offsetTop - headerHeight - offset - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                updateActiveNavLink(this);
            }
        });
    });
    
    // Detectar sección activa al hacer scroll
    window.addEventListener('scroll', debounce(detectarSeccionActiva, 100));
}

function detectarSeccionActiva() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    const header = document.querySelector('.main-header');
    const headerHeight = header ? header.offsetHeight : 80;
    const offset = CONFIG.MODO_OFFLINE ? 40 : 0;
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - headerHeight - offset - 50;
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
            
            // Agregar/quitar estilos para menú móvil
            if (mainNav.classList.contains('mobile-active')) {
                mainNav.style.cssText = `
                    display: flex;
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--primary-dark);
                    flex-direction: column;
                    padding: 1rem;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                `;
                const ul = mainNav.querySelector('ul');
                if (ul) ul.style.flexDirection = 'column';
            } else {
                mainNav.style.cssText = '';
                const ul = mainNav.querySelector('ul');
                if (ul) ul.style.flexDirection = '';
            }
        });
        
        // Cerrar menú al hacer clic en un enlace
        mainNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('mobile-active');
                mobileToggle.classList.remove('active');
                mainNav.style.cssText = '';
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

// Función debounce para optimización
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
        
        // Limitar a máximo 30 días en el futuro
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
// MANEJO DE CONSULTAS
// ====================================
async function handleConsultaSubmit(e) {
    e.preventDefault();
    
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
        
        // Realizar consulta a la API
        const response = await ApiClient.post(CONFIG.ENDPOINTS.CONSULTA_DISPONIBILIDAD, consultaData);
        
        if (response.success) {
            mostrarResultadosDisponibilidad(response.data);
        } else {
            throw new Error(response.message || 'Error en la consulta');
        }
        
    } catch (error) {
        console.error('Error al consultar disponibilidad:', error);
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
// MOSTRAR RESULTADOS
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
                            <div class="turno-hora">${formatearHora(turno.horaInicio)} - ${formatearHora(turno.horaFin)}</div>
                            <div class="turno-info">
                                <span class="turno-cancha">Cancha ${turno.cancha.numero}</span>
                                <span class="turno-precio">$${turno.precio.toLocaleString('es-AR')}</span>
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
                            <div class="turno-hora">${formatearHora(turno.horaInicio)} - ${formatearHora(turno.horaFin)}</div>
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
                ${CONFIG.MODO_OFFLINE ? '<p><strong>⚠️ Nota:</strong> Datos de ejemplo - Para reservas reales contacta directamente.</p>' : ''}
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

function aplicarEstilosResultados() {
    // Verificar si ya existen los estilos
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
        
        .turnos-disponibles, .turnos-ocupados, .sin-turnos {
            margin-bottom: 2rem;
        }
        
        .turnos-disponibles h4, .turnos-ocupados h4, .sin-turnos h4 {
            color: var(--primary-dark);
            margin-bottom: 1rem;
            padding: 0.8rem;
            border-radius: 8px;
            font-size: 1.1rem;
        }
        
        .turnos-disponibles h4 {
            background: rgba(39, 174, 96, 0.1);
            border-left: 4px solid var(--success-green);
        }
        
        .turnos-ocupados h4 {
            background: rgba(231, 76, 60, 0.1);
            border-left: 4px solid var(--accent-red);
        }
        
        .sin-turnos {
            text-align: center;
            padding: 2rem;
            background: var(--background-light);
            border-radius: 10px;
        }
        
        .sin-turnos h4 {
            background: none;
            border: none;
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
        
        .turno-hora {
            font-size: 1.1rem;
            font-weight: bold;
            color: var(--primary-dark);
            margin-bottom: 0.8rem;
        }
        
        .turno-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        
        .turno-cancha {
            color: var(--text-secondary);
            font-weight: 500;
        }
        
        .turno-precio {
            color: var(--success-green);
            font-weight: bold;
            font-size: 1rem;
        }
        
        .turno-estado {
            color: var(--accent-red);
            font-weight: bold;
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
            border-left: 4px solid var(--accent-red);
        }
        
        .contacto-info h4 {
            color: var(--primary-dark);
            margin-bottom: 1rem;
        }
        
        .contacto-info p {
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .turnos-grid {
                grid-template-columns: 1fr;
            }
            
            .resumen-disponibilidad {
                flex-direction: column;
                gap: 1rem;
            }
            
            .resultados-container {
                padding: 1rem;
                margin-top: 1rem;
            }
        }
        
        @media (max-width: 480px) {
            .resumen-disponibilidad {
                gap: 0.5rem;
            }
            
            .resumen-item .numero {
                font-size: 1.5rem;
            }
        }
    `;
    document.head.appendChild(style);
}

// ====================================
// UTILIDADES
// ====================================
function formatearHora(hora) {
    if (!hora) return '';
    
    // Si ya está en formato HH:MM, devolverlo tal como está
    if (typeof hora === 'string' && hora.includes(':')) {
        return hora.substring(0, 5); // Asegurar formato HH:MM
    }
    
    // Si es un objeto Date, formatear
    if (hora instanceof Date) {
        return hora.toTimeString().substring(0, 5);
    }
    
    return hora.toString();
}

function setLoadingState(loading) {
    appState.cargando = loading;
    const submitBtn = document.querySelector('#consultaForm button[type="submit"]');
    
    if (submitBtn) {
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                    <span class="spinner"></span>
                    Consultando...
                </span>
            `;
            submitBtn.classList.add('loading');
            
            // Agregar animación de spin si no existe
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
    // Crear modal de error más elegante
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
    
    // Estilos del modal
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
    
    // Estilos de los elementos internos
    const errorIcon = errorModal.querySelector('.error-icon');
    errorIcon.style.cssText = `
        font-size: 3rem;
        margin-bottom: 1rem;
    `;
    
    const errorTitle = errorModal.querySelector('h3');
    errorTitle.style.cssText = `
        color: var(--accent-red);
        margin-bottom: 1rem;
    `;
    
    const errorText = errorModal.querySelector('p');
    errorText.style.cssText = `
        color: var(--text-secondary);
        margin-bottom: 2rem;
        line-height: 1.5;
    `;
    
    const btnCerrar = errorModal.querySelector('.btn-cerrar-error');
    btnCerrar.style.cssText = `
        background: var(--accent-red);
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: background 0.3s ease;
    `;
    
    // Eventos para cerrar el modal
    const cerrarModal = () => {
        errorModal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(errorModal)) {
                document.body.removeChild(errorModal);
            }
        }, 300);
    };
    
    btnCerrar.addEventListener('click', cerrarModal);
    backdrop.addEventListener('click', cerrarModal);
    
    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cerrarModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Agregar al DOM
    document.body.appendChild(errorModal);
    
    // Agregar animaciones si no existen
    if (!document.getElementById('modal-animations')) {
        const modalStyles = document.createElement('style');
        modalStyles.id = 'modal-animations';
        modalStyles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(modalStyles);
    }
}

function mostrarErrorGeneral(mensaje) {
    console.error('Error general:', mensaje);
    mostrarErrorConsulta(mensaje);
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
                observer.unobserve(entry.target); // Solo animar una vez
            }
        });
    }, observerOptions);
    
    // Observar elementos para animación
    document.querySelectorAll('.sede-card, .deporte-card, .servicio-item').forEach(el => {
        observer.observe(el);
    });
}

// ====================================
// FUNCIONES GLOBALES PARA BOTONES
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
• Dejar una seña${CONFIG.MODO_OFFLINE ? '\n\n⚠️ Nota: Datos de ejemplo para demostración' : ''}`;
    
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
    
    // Estilos del modal
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
    
    // Estilos del mensaje
    const mensajeDiv = modal.querySelector('.mensaje-reserva');
    mensajeDiv.style.cssText = `
        text-align: left;
        line-height: 1.6;
        color: var(--text-secondary);
        margin: 1.5rem 0;
        padding: 1rem;
        background: var(--background-light);
        border-radius: 8px;
        border-left: 4px solid var(--accent-red);
    `;
    
    // Estilos de botones
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
    
    // Eventos
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
        // Limpiar formulario para nueva consulta
        const form = document.getElementById('consultaForm');
        if (form) {
            form.reset();
            setupDateInput(); // Reestablecer fecha mínima
        }
        ocultarInfoSede();
        
        // Limpiar resultados
        const resultContainer = document.getElementById('resultados-disponibilidad');
        if (resultContainer) {
            resultContainer.remove();
        }
        
        // Scroll al formulario
        const reservasSection = document.getElementById('reservas');
        if (reservasSection) {
            reservasSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    backdrop.addEventListener('click', cerrarModal);
    
    document.body.appendChild(modal);
    
    console.log('Información de reserva para turno:', turnoId, {
        sede: appState.sedeSeleccionada,
        deporte: appState.deporteSeleccionado,
        fecha: appState.fechaSeleccionada
    });
}

// ====================================
// CONTROL DE MODO BACKEND
// ====================================
window.TANCAT_TOGGLE_MODE = function() {
    CONFIG.MODO_OFFLINE = !CONFIG.MODO_OFFLINE;
    console.log(`🔄 Modo cambiado a: ${CONFIG.MODO_OFFLINE ? 'OFFLINE' : 'ONLINE'}`);
    
    // Recargar datos
    cargarDatosIniciales().then(() => {
        console.log('✅ Datos recargados en nuevo modo');
    });
    
    // Actualizar indicador
    const indicador = document.getElementById('modo-offline-indicator');
    if (CONFIG.MODO_OFFLINE && !indicador) {
        mostrarIndicadorModo();
    } else if (!CONFIG.MODO_OFFLINE && indicador) {
        indicador.remove();
        
        // Restaurar posiciones del header y hero
        const header = document.querySelector('.main-header');
        const hero = document.querySelector('.hero-section');
        if (header) header.style.top = '0';
        if (hero) hero.style.paddingTop = '';
    }
};

// ====================================
// FUNCIONES DE DEPURACIÓN (DESARROLLO)
// ====================================
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Funciones de desarrollo disponibles en consola
    window.TANCAT_DEBUG = {
        appState: () => appState,
        toggleMode: () => window.TANCAT_TOGGLE_MODE(),
        testApiConnection: async () => {
            const originalMode = CONFIG.MODO_OFFLINE;
            CONFIG.MODO_OFFLINE = false;
            
            try {
                const response = await ApiClient.get(CONFIG.ENDPOINTS.SEDES);
                console.log('✅ Conexión API exitosa:', response);
                return response;
            } catch (error) {
                console.error('❌ Error de conexión API:', error);
                return error;
            } finally {
                CONFIG.MODO_OFFLINE = originalMode;
            }
        },
        clearCache: () => {
            appState.cache.clear();
            console.log('🗑️ Cache limpiado');
        },
        reloadData: () => cargarDatosIniciales(),
        showCurrentData: () => {
            console.log('📊 Datos actuales:', {
                sedes: appState.sedes,
                deportes: appState.deportes,
                combinaciones: appState.combinacionesDisponibles
            });
        }
    };
    
    console.log('🛠️ Modo desarrollo activo. Funciones de debug disponibles en TANCAT_DEBUG');
    console.log('💡 Usa TANCAT_DEBUG.toggleMode() para alternar entre online/offline');
}

// ====================================
// MANEJO DE ERRORES GLOBALES
// ====================================
window.addEventListener('error', function(e) {
    console.error('Error en cliente:', e.error);
    
    // No mostrar errores de red menores al usuario
    if (e.error && e.error.message && e.error.message.includes('fetch')) {
        console.warn('Error de red detectado, pero no se mostrará al usuario');
        return;
    }
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada:', e.reason);
    
    // Manejar errores de API específicos
    if (e.reason && e.reason.message) {
        if (e.reason.message.includes('Failed to fetch')) {
            console.warn('Error de conexión detectado, cambiando a modo offline');
            CONFIG.MODO_OFFLINE = true;
        } else if (e.reason.message.includes('404')) {
            console.warn('Servicio no encontrado, usando datos de ejemplo');
        } else if (e.reason.message.includes('500')) {
            console.warn('Error del servidor, usando datos de ejemplo');
        }
    }
});

// ====================================
// CLEANUP Y OPTIMIZACIÓN DE MEMORIA
// ====================================
window.addEventListener('beforeunload', () => {
    // Limpiar cache
    if (appState.cache) {
        appState.cache.clear();
    }
    
    console.log('🧹 Recursos limpiados antes de salir');
});

console.log('📋 cliente-main.js cargado correctamente - Versión limpia sin duplicaciones');
console.log(`🔧 Modo actual: ${CONFIG.MODO_OFFLINE ? 'OFFLINE (datos de ejemplo)' : 'ONLINE (backend)'}`);