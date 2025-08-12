/**
 * TANCAT - Sistema Cliente Main
 * Archivo: cliente-main.js
 * Descripción: Funcionalidad principal para la página del cliente - CORREGIDO
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
    MODO_OFFLINE: false // Activado para conectar al backend
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
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ...options
        };

        try {
            console.log(`🔄 Realizando petición a: ${url}`);
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Respuesta exitosa de ${endpoint}:`, data);
            
            return {
                success: true,
                data: data.data || data,
                message: data.message || 'OK'
            };
            
        } catch (error) {
            console.error(`❌ Error en petición a ${endpoint}:`, error);
            
            // Si el backend no está disponible, usar datos de fallback
            return this.getFallbackData(endpoint);
        }
    }

    static async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(fullEndpoint);
    }

    static getFallbackData(endpoint) {
        console.warn(`⚠️ Usando datos de fallback para ${endpoint}`);
        
        const fallbackData = {
            '/cliente/sedes': {
                success: true,
                data: [
                    {
                        id_sede: 1,
                        nombre: "Jacinto Rios",
                        direccion: "Jacinto Rios 232, Gral Paz, Cordoba",
                        telefono: "3511375468",
                        horario_apertura: "09:00:00",
                        horario_cierre: "00:00:00",
                        dias_funcionamiento: "Lunes a Sabado de 09 a 00 - Domingo de 14 a 22 pm",
                        activo: true
                    },
                    {
                        id_sede: 2,
                        nombre: "Rincon",
                        direccion: "Rincon 985, Gral Paz, Cordoba",
                        telefono: "3511375468",
                        horario_apertura: "15:00:00",
                        horario_cierre: "00:00:00",
                        dias_funcionamiento: "Lunes a Sabado de 15 a 00 - Domingos Cerrado",
                        activo: true
                    }
                ]
            },
            '/cliente/deportes': {
                success: true,
                data: [
                    {
                        id_deporte: 1,
                        nombre: "Padel",
                        descripcion: "Duracion 90 min",
                        duracion_turno: 90,
                        precio_base: "25000.00",
                        activo: true
                    },
                    {
                        id_deporte: 2,
                        nombre: "Basquet",
                        descripcion: "Duracion 60 min",
                        duracion_turno: 60,
                        precio_base: "20000.00",
                        activo: true
                    },
                    {
                        id_deporte: 3,
                        nombre: "Squash",
                        descripcion: "Duracion 60 min",
                        duracion_turno: 60,
                        precio_base: "25000.00",
                        activo: true
                    },
                    {
                        id_deporte: 4,
                        nombre: "Ping Pong",
                        descripcion: "Duracion 30 min",
                        duracion_turno: 30,
                        precio_base: "10000.00",
                        activo: true
                    },
                    {
                        id_deporte: 5,
                        nombre: "Voley",
                        descripcion: "Duracion 60 min",
                        duracion_turno: 60,
                        precio_base: "20000.00",
                        activo: true
                    }
                ]
            }
        };

        return fallbackData[endpoint] || { success: false, data: [], message: 'No hay datos de fallback disponibles' };
    }
}

// ====================================
// UTILIDADES DE INTERFAZ
// ====================================
function mostrarCargando(elemento, mostrar = true) {
    if (!elemento) return;
    
    if (mostrar) {
        elemento.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Cargando información...</p>
            </div>
        `;
    }
}

function mostrarError(elemento, mensaje) {
    if (!elemento) return;
    
    elemento.innerHTML = `
        <div class="error-message">
            <div class="error-icon">⚠️</div>
            <h3>Error al cargar datos</h3>
            <p>${mensaje}</p>
            <button onclick="location.reload()" class="btn btn-primary">Reintentar</button>
        </div>
    `;
}

function formatearPrecio(precio) {
    const num = typeof precio === 'string' ? parseFloat(precio) : precio;
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(num);
}

function formatearHorario(apertura, cierre) {
    if (!apertura || !cierre) return 'Horario no disponible';
    
    const formatHora = (hora) => {
        return hora.substring(0, 5); // HH:MM
    };
    
    return `${formatHora(apertura)} - ${formatHora(cierre)}`;
}

// ====================================
// CARGA Y RENDERIZADO DE SEDES
// ====================================
async function cargarSedes() {
    const sedesContainer = document.getElementById('sedes-container');
    if (!sedesContainer) return;

    mostrarCargando(sedesContainer);

    try {
        const response = await ApiClient.get(CONFIG.ENDPOINTS.SEDES);
        
        if (response.success && response.data && response.data.length > 0) {
            appState.sedes = response.data;
            renderizarSedes(response.data);
        } else {
            throw new Error('No se encontraron sedes disponibles');
        }
        
    } catch (error) {
        console.error('Error al cargar sedes:', error);
        mostrarError(sedesContainer, 'No se pudieron cargar las sedes. Verifica la conexión con el servidor.');
    }
}

function renderizarSedes(sedes) {
    const sedesContainer = document.getElementById('sedes-container');
    if (!sedesContainer) return;

    sedesContainer.innerHTML = sedes.map(sede => `
        <div class="sede-card">
            <div class="sede-header">
                <h3>${sede.nombre}</h3>
                <span class="sede-badge ${sede.id_sede === 1 ? 'principal' : 'sucursal'}">
                    ${sede.id_sede === 1 ? 'Principal' : 'Sucursal'}
                </span>
            </div>
            
            <div class="sede-info">
                <div class="info-item">
                    <span class="icon">📍</span>
                    <span>${sede.direccion}</span>
                </div>
                
                ${sede.telefono ? `
                <div class="info-item">
                    <span class="icon">📞</span>
                    <span>${sede.telefono}</span>
                </div>
                ` : ''}
                
                <div class="info-item">
                    <span class="icon">🕒</span>
                    <span>${sede.dias_funcionamiento}</span>
                </div>
            </div>
            
            <div class="sede-deportes">
                <h4>Deportes Disponibles</h4>
                <div id="deportes-sede-${sede.id_sede}" class="deportes-list">
                    <div class="loading-mini">Cargando deportes...</div>
                </div>
            </div>
        </div>
    `).join('');

    // Cargar deportes para cada sede
    sedes.forEach(sede => {
        cargarDeportesPorSede(sede.id_sede);
    });
}

async function cargarDeportesPorSede(idSede) {
    const deportesContainer = document.getElementById(`deportes-sede-${idSede}`);
    if (!deportesContainer) return;

    try {
        // Por ahora mostrar todos los deportes para cada sede
        // En el futuro se puede filtrar por sede específica
        const response = await ApiClient.get(CONFIG.ENDPOINTS.DEPORTES);
        
        if (response.success && response.data) {
            const deportesHtml = response.data.map(deporte => `
                <div class="deporte-item">
                    <span class="deporte-nombre">${deporte.nombre}</span>
                    <span class="deporte-precio">${formatearPrecio(deporte.precio_base)}</span>
                </div>
            `).join('');
            
            deportesContainer.innerHTML = deportesHtml;
        }
        
    } catch (error) {
        console.error('Error al cargar deportes por sede:', error);
        deportesContainer.innerHTML = '<span class="error-mini">Error al cargar deportes</span>';
    }
}

// ====================================
// CARGA Y RENDERIZADO DE DEPORTES
// ====================================
async function cargarDeportes() {
    const deportesContainer = document.getElementById('deportes-container');
    if (!deportesContainer) return;

    mostrarCargando(deportesContainer);

    try {
        const response = await ApiClient.get(CONFIG.ENDPOINTS.DEPORTES);
        
        if (response.success && response.data && response.data.length > 0) {
            appState.deportes = response.data;
            renderizarDeportes(response.data);
        } else {
            throw new Error('No se encontraron deportes disponibles');
        }
        
    } catch (error) {
        console.error('Error al cargar deportes:', error);
        mostrarError(deportesContainer, 'No se pudieron cargar los deportes. Verifica la conexión con el servidor.');
    }
}

function renderizarDeportes(deportes) {
    const deportesContainer = document.getElementById('deportes-container');
    if (!deportesContainer) return;

    const iconosDeportes = {
        'Padel': '🏓',
        'Basquet': '🏀',
        'Squash': '🎾',
        'Ping Pong': '🏓',
        'Voley': '🏐'
    };

    deportesContainer.innerHTML = deportes.map((deporte, index) => `
        <div class="deporte-card ${index === 0 ? 'featured' : ''}" data-deporte-id="${deporte.id_deporte}">
            <div class="deporte-icon">
                ${iconosDeportes[deporte.nombre] || '⚽'}
            </div>
            
            <h3>${deporte.nombre}</h3>
            
            <p>${deporte.descripcion}</p>
            
            <div class="deporte-details">
                <span>Duración: ${deporte.duracion_turno} min</span>
                <span>Desde: ${formatearPrecio(deporte.precio_base)}</span>
            </div>
            
            <button class="btn btn-primary" onclick="seleccionarDeporte(${deporte.id_deporte})">
                Reservar
            </button>
        </div>
    `).join('');
}

// ====================================
// CARGA DE SERVICIOS ADICIONALES
// ====================================
function cargarServiciosAdicionales() {
    const serviciosContainer = document.getElementById('servicios-container');
    if (!serviciosContainer) return;

    const servicios = [
        {
            icono: '🏆',
            titulo: 'Torneos Mensuales',
            descripcion: 'Participa en nuestros torneos organizados cada mes. Competencias para todos los niveles con premios atractivos y un ambiente competitivo pero amigable.'
        },
        {
            icono: '🎯',
            titulo: 'Clases Particulares',
            descripcion: 'Mejora tu técnica con instructores certificados. Clases personalizadas para principiantes y avanzados, enfocadas en el desarrollo de habilidades específicas.'
        },
        {
            icono: '👥',
            titulo: 'Grupos y Eventos',
            descripcion: 'Organiza eventos corporativos, cumpleaños y reuniones especiales. Paquetes completos con catering opcional y atención personalizada para tu grupo.'
        },
        {
            icono: '🛍️',
            titulo: 'Tienda Deportiva',
            descripcion: 'Encuentra todo el equipamiento que necesitas. Paletas, pelotas, indumentaria y accesorios de las mejores marcas, con precios especiales para socios.'
        },
        {
            icono: '🚿',
            titulo: 'Vestuarios Completos',
            descripcion: 'Vestuarios amplios y modernos con duchas de agua caliente, lockers seguros y área de descanso. Toallas y artículos de higiene disponibles.'
        },
        {
            icono: '☕',
            titulo: 'Cafetería y Snacks',
            descripcion: 'Disfruta de nuestra cafetería con bebidas frías y calientes, snacks saludables y menús ligeros. El lugar perfecto para relajarse después del juego.'
        }
    ];

    serviciosContainer.innerHTML = servicios.map(servicio => `
        <div class="servicio-item">
            <div class="servicio-icon">${servicio.icono}</div>
            <div class="servicio-content">
                <h4>${servicio.titulo}</h4>
                <p>${servicio.descripcion}</p>
            </div>
        </div>
    `).join('');
}

// ====================================
// FUNCIONES DE RESERVA
// ====================================
function seleccionarDeporte(idDeporte) {
    const deporte = appState.deportes.find(d => d.id_deporte === idDeporte);
    if (!deporte) return;

    appState.deporteSeleccionado = deporte;
    
    // Scroll hasta la sección de reservas
    const reservasSection = document.getElementById('reservas');
    if (reservasSection) {
        reservasSection.scrollIntoView({ behavior: 'smooth' });
        
        // Actualizar el formulario
        const selectDeporte = document.getElementById('deporte-select');
        if (selectDeporte) {
            selectDeporte.value = idDeporte;
        }
    }
}

async function poblarSelectSedes() {
    const selectSede = document.getElementById('sede-select');
    if (!selectSede) return;

    try {
        if (appState.sedes.length === 0) {
            const response = await ApiClient.get(CONFIG.ENDPOINTS.SEDES);
            if (response.success) {
                appState.sedes = response.data;
            }
        }

        selectSede.innerHTML = '<option value="">Selecciona una sede</option>' +
            appState.sedes.map(sede => 
                `<option value="${sede.id_sede}">${sede.nombre}</option>`
            ).join('');

    } catch (error) {
        console.error('Error al poblar sedes:', error);
        selectSede.innerHTML = '<option value="">Error al cargar sedes</option>';
    }
}

async function poblarSelectDeportes() {
    const selectDeporte = document.getElementById('deporte-select');
    if (!selectDeporte) return;

    try {
        if (appState.deportes.length === 0) {
            const response = await ApiClient.get(CONFIG.ENDPOINTS.DEPORTES);
            if (response.success) {
                appState.deportes = response.data;
            }
        }

        selectDeporte.innerHTML = '<option value="">Selecciona un deporte</option>' +
            appState.deportes.map(deporte => 
                `<option value="${deporte.id_deporte}">${deporte.nombre} - ${formatearPrecio(deporte.precio_base)}</option>`
            ).join('');

    } catch (error) {
        console.error('Error al poblar deportes:', error);
        selectDeporte.innerHTML = '<option value="">Error al cargar deportes</option>';
    }
}

// ====================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ====================================
function mostrarIndicadorConexion() {
    const indicador = document.createElement('div');
    indicador.id = 'connection-indicator';
    indicador.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #3498db, #2980b9);
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
            🌐 Conectando con el servidor...
        </div>
    `;
    
    document.body.appendChild(indicador);
    
    // Verificar conexión después de 3 segundos
    setTimeout(() => {
        verificarConexionBackend();
    }, 3000);
}

async function verificarConexionBackend() {
    const indicador = document.getElementById('connection-indicator');
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
        if (response.ok) {
            appState.backendDisponible = true;
            if (indicador) {
                indicador.style.background = 'linear-gradient(135deg, #27ae60, #229954)';
                indicador.innerHTML = '✅ Conectado al servidor - Datos en tiempo real';
                setTimeout(() => {
                    indicador.remove();
                }, 2000);
            }
        } else {
            throw new Error('Backend no disponible');
        }
    } catch (error) {
        console.warn('Backend no disponible, usando datos de fallback');
        if (indicador) {
            indicador.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
            indicador.innerHTML = '⚠️ Servidor no disponible - Usando datos de ejemplo';
            setTimeout(() => {
                indicador.remove();
            }, 5000);
        }
    }
}

async function inicializarAplicacion() {
    try {
        console.log('🚀 Inicializando aplicación TANCAT Cliente...');
        
        // Mostrar indicador de conexión
        mostrarIndicadorConexion();
        
        // Cargar datos principales
        await Promise.all([
            cargarSedes(),
            cargarDeportes()
        ]);
        
        // Cargar servicios adicionales
        cargarServiciosAdicionales();
        
        // Poblar selects del formulario
        await Promise.all([
            poblarSelectSedes(),
            poblarSelectDeportes()
        ]);
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
    }
}

// ====================================
// EVENT LISTENERS
// ====================================
document.addEventListener('DOMContentLoaded', inicializarAplicacion);

// Navegación suave
document.addEventListener('click', (e) => {
    if (e.target.matches('a[href^="#"]')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});

// Manejo del formulario de reservas
document.addEventListener('change', (e) => {
    if (e.target.id === 'sede-select') {
        const sedeId = parseInt(e.target.value);
        if (sedeId) {
            appState.sedeSeleccionada = appState.sedes.find(s => s.id_sede === sedeId);
            console.log('Sede seleccionada:', appState.sedeSeleccionada);
        }
    }
    
    if (e.target.id === 'deporte-select') {
        const deporteId = parseInt(e.target.value);
        if (deporteId) {
            appState.deporteSeleccionado = appState.deportes.find(d => d.id_deporte === deporteId);
            console.log('Deporte seleccionado:', appState.deporteSeleccionado);
        }
    }
});

// ====================================
// ESTILOS ADICIONALES PARA CARGA
// ====================================
const estilosAdicionales = `
<style>
.loading-spinner {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
}

.spinner {
    border: 4px solid var(--background-lighter);
    border-top: 4px solid var(--accent-red);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.error-message {
    text-align: center;
    padding: 2rem;
    color: var(--accent-red);
}

.error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.loading-mini {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    padding: 0.5rem;
}

.error-mini {
    color: var(--accent-red);
    font-size: 0.9rem;
    text-align: center;
    padding: 0.5rem;
}

.deportes-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.deporte-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 5px;
    font-size: 0.9rem;
}

.deporte-nombre {
    font-weight: bold;
    color: var(--primary-dark);
}

.deporte-precio {
    color: var(--accent-red);
    font-weight: bold;
}

.servicio-item {
    display: flex;
    align-items: flex-start;
    padding: 1.5rem;
    background: var(--background-light);
    border-radius: 10px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid var(--background-lighter);
}

.servicio-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px var(--shadow-medium);
}

.servicio-icon {
    font-size: 2.5rem;
    margin-right: 1.5rem;
    margin-top: 0.2rem;
    flex-shrink: 0;
}

.servicio-content {
    flex: 1;
}

.servicio-content h4 {
    color: var(--primary-dark);
    margin-bottom: 0.8rem;
    font-size: 1.2rem;
    font-weight: bold;
}

.servicio-content p {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
}
</style>
`;

// Inyectar estilos adicionales
document.head.insertAdjacentHTML('beforeend', estilosAdicionales);