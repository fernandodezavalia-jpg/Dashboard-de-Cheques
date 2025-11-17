const API_URL = 'https://script.google.com/macros/s/AKfycbz4JTJqhqh_mugxBVHwB3lxb18hFd6QJeD4IdjM5aZ3ohUoZCeTnvic26QJ2mAAnUQSeQ/exec';
let allData = [];
let activeFilters = {};
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const colorPalette = [
    '#4A90E2', // Blue
    '#50E3C2', // Teal
    '#F5A623', // Orange
    '#BD10E0', // Purple
    '#7ED321', // Green
    '#9013FE', // Violet
    '#F8E71C', // Yellow
];

/*
  Mando de Control de Cheques Emitidos G.S.A.
  Análisis y Visualización de Movimientos Financieros
*/



/**
 * Genera una paleta de colores armoniosa (monocromática) para los gráficos.
 * @param {number} count - El número de colores a generar.
 * @param {number} baseHue - El tono base (0-360) para la paleta de colores.
 * @returns {string[]} Un array de colores en formato HSL.
 */
function generateHarmoniousColors(count, baseHue) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const lightness = 85 - (i * (50 / (count || 1)));
        colors.push(`hsl(${baseHue}, 70%, ${lightness}%)`);
    }
    return colors;
}

let currentPage = 1;
const rowsPerPage = 15;
let sortConfig = { key: 'FECHA', direction: 'descending' }; // Default sort
let highlightedRowId = null; // Variable para guardar el ID de la fila a resaltar
let gastoChartState = {
    level: 'grupo', // 'grupo' o 'categoria'
    filter: null    // El 'GRUPO DE GASTO' por el que se está filtrando en el nivel 'categoria'
};


async function fetchData() {
    try {
        // Añadimos un parámetro aleatorio para evitar la caché de Google Apps Script
        const url = new URL(API_URL);
        url.searchParams.append('cache_bust', new Date().getTime());
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();

        // Filtrar filas en blanco o inválidas
        data = data.filter(item => {
            const hasDate = item['FECHA'] && !isNaN(new Date(item['FECHA']).getTime());
            const hasAmount = item['IMPORTE'] !== undefined && item['IMPORTE'] !== null && item['IMPORTE'] !== '';
            return hasDate && hasAmount;
        });

        // Añadir un ID único a cada fila para una manipulación segura
        data.forEach((item, index) => item._id = index);
        return data;
    } catch (error) {
        console.error('¡Ups! Hubo un error al conectar con la API:', error);
        // Aquí podrías mostrar un mensaje al usuario en la UI
        document.body.innerHTML = `<div style="text-align: center; padding: 50px;"><h1>Error de Conexión</h1><p>No se pudo cargar los datos desde la hoja de cálculo. Por favor, verifica la URL de la API y tu conexión a internet.</p></div>`;
        return null;
    }
}

/**
 * Muestra una notificación "Toast" en la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - El tipo de notificación ('success' o 'error').
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✔' : '✖';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
    
    container.appendChild(toast);

    // La animación de salida se encarga de ocultarlo, pero lo eliminamos del DOM después.
    setTimeout(() => {
        toast.remove();
    }, 5000); // 5 segundos
}

async function sendUpdateToAPI(payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors', // Habilitar CORS
            body: JSON.stringify(payload),
            // Google Apps Script espera 'text/plain' para el cuerpo de la solicitud POST
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        if (!response.ok) {
            throw new Error(`Error en la respuesta de la API: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'La API devolvió un error no especificado.');
        }
        return result;
    } catch (error) {
        console.error('Error al enviar actualización a la API:', error);
        showToast(`Error de comunicación: ${error.message}`, 'error');
        return null;
    }
}


function applyFilters(data) {
    if (Object.keys(activeFilters).length === 0) {
        return data;
    }

    return data.filter(item => {
        let isMatch = true;
        for (const filterKey in activeFilters) {
            if (!activeFilters[filterKey]) continue; // Ignorar filtros vacíos

            const filterValue = activeFilters[filterKey];
            const itemDate = new Date(item['FECHA']);

            if (filterKey === 'FECHA') {
                const itemDateStr = itemDate.toISOString().split('T')[0];
                if (itemDateStr !== filterValue) isMatch = false;
            } else if (filterKey === 'MES') {
                const itemMonthYear = `${itemDate.getFullYear()}-${(itemDate.getMonth() + 1).toString().padStart(2, '0')}`;
                if (itemMonthYear !== filterValue) isMatch = false;
            } else if (filterKey === 'VENCIDOS') {
                if (filterValue === true && (new Date(item['FECHA']) >= new Date() || ((parseFloat(item['IMPORTE']) || 0) - (parseFloat(item['PAGADO']) || 0)) <= 0.01)) isMatch = false;
            } else if (filterKey === 'AÑO') {
                if (itemDate.getFullYear().toString() !== filterValue) isMatch = false;
            } else if (filterKey === 'MES_NUMERO') {
                if ((itemDate.getMonth() + 1).toString() !== filterValue) isMatch = false;
            } else if (filterKey === 'NO_PAGADOS') {
                if (filterValue === true && (parseFloat(item['PAGADO']) || 0) > 0) isMatch = false;
            } else if (filterKey === 'BUSQUEDA') {
                const searchTerm = filterValue.toLowerCase();
                const chequeNum = (item['N° CHEQUE'] || '').toString().toLowerCase();
                const observacion = (item['OBSERVACION'] || '').toLowerCase();
                if (!chequeNum.includes(searchTerm) && !observacion.includes(searchTerm)) {
                    isMatch = false;
                }
            } else {
                // Filtro genérico para 'GRUPO DE GASTO', 'BANCO', etc.
                if (item[filterKey] !== filterValue) isMatch = false;
            }
            if (!isMatch) break;
        }
        return isMatch;
    });
}

function updateDashboard(filteredData) {
    // --- 1. Calcular y mostrar KPIs ---

    // Reset drill-down chart if global filters are applied
    if (gastoChartState.level !== 'grupo') {
        gastoChartState = { level: 'grupo', filter: null };
    }

    const kpiValues = filteredData.reduce((acc, cheque) => {
        acc.totalImporte += parseFloat(cheque['IMPORTE']) || 0;
        acc.totalPagado += parseFloat(cheque['PAGADO']) || 0;
        return acc;
    }, { totalImporte: 0, totalPagado: 0 });

    const { totalImporte, totalPagado } = kpiValues;
    const saldoPendiente = totalImporte - totalPagado;
    const totalCheques = filteredData.filter(cheque => {
        const importe = parseFloat(cheque['IMPORTE']) || 0;
        const pagado = parseFloat(cheque['PAGADO']) || 0;
        return (importe - pagado) > 0.01;
    }).length;

    const hoy = new Date();
    const totalVencido = filteredData.filter(cheque => {
        const saldo = (parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0);
        return saldo > 0.01 && new Date(cheque['FECHA']) < hoy;
    }).reduce((sum, cheque) => sum + ((parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0)), 0);

    const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    document.getElementById('total-importe').textContent = `$${totalImporte.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-pagado').textContent = `$${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('saldo-pendiente').textContent = `$${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-cheques').textContent = totalCheques;
    document.getElementById('total-vencido').textContent = `$${formatter.format(totalVencido)}`;

    // --- Calcular y mostrar comparación de período ---
    // Nota: Esta función asume que `allData` está disponible globalmente.
    calculatePeriodComparison({ totalImporte, totalPagado, saldoPendiente, totalCheques, totalVencido });

    // --- Mostrar/Ocultar gráfico de Antigüedad de Deuda ---
    const agingChartCard = document.getElementById('aging-chart-card');
    const hayVencidos = totalVencido > 0;
    if (hayVencidos) {
        agingChartCard.classList.remove('hidden');
        drawAgingChart(filteredData);
    } else {
        agingChartCard.classList.add('hidden');
    }

    // --- Lógica de alerta visual ---
    const saldoCard = document.querySelector('.mc-saldo');
    if (saldoPendiente > 0) {
        saldoCard.classList.add('alert');
    } else {
        saldoCard.classList.remove('alert');
    }

    // --- 2. Muestra u oculta el botón de limpiar filtros ---
    toggleClearButton();

    // --- Sincronizar menús desplegables con filtros activos ---
    syncDropdowns();

    // --- Actualizar opciones de los filtros ---
    updateFilterOptions(filteredData);

    // --- 3. Recrear los gráficos con los datos filtrados ---
    drawEvolucionChart(filteredData);
    drawGrupoGastoImporteChart(filteredData);
    drawVencimientoChart(filteredData);
    drawSaldosPorBancoChart(filteredData);
    drawProyeccionFlujoCajaChart(filteredData);
    

    // --- 4. Ordenar y dibujar la tabla con paginación ---
    currentPage = 1; // Resetear a la primera página con cada filtro
    const sortedData = sortData(filteredData);
    displayTablePage(sortedData);
}

function toggleClearButton() {
    const clearBtn = document.getElementById('clear-filters-btn');
    if (Object.keys(activeFilters).length > 0) {
        clearBtn.style.display = 'inline-block';
    } else {
        clearBtn.style.display = 'none';
    }
}

function calculatePeriodComparison(currentKpis) {
    let previousPeriodData = [];
    let hasPeriodFilter = false;

    if (activeFilters['AÑO'] && activeFilters['MES_NUMERO']) {
        hasPeriodFilter = true;
        const currentYear = parseInt(activeFilters['AÑO']);
        const currentMonth = parseInt(activeFilters['MES_NUMERO']);
        const prevDate = new Date(currentYear, currentMonth - 2, 1); // Mes anterior
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth() + 1;

        previousPeriodData = allData.filter(item => {
            const itemDate = new Date(item['FECHA']);
            return itemDate.getFullYear() === prevYear && (itemDate.getMonth() + 1) === prevMonth;
        });
    } else if (activeFilters['AÑO']) {
        hasPeriodFilter = true;
        const currentYear = parseInt(activeFilters['AÑO']);
        const prevYear = currentYear - 1;
        previousPeriodData = allData.filter(item => new Date(item['FECHA']).getFullYear() === prevYear);
    }

    const kpiCompElements = {
        totalImporte: document.getElementById('total-importe-comp'),
        totalPagado: document.getElementById('total-pagado-comp'),
        saldoPendiente: document.getElementById('saldo-pendiente-comp'),
        totalCheques: document.getElementById('total-cheques-comp'),
        totalVencido: document.getElementById('total-vencido-comp'),
    };

    // Limpiar comparaciones si no hay filtro de período
    if (!hasPeriodFilter) {
        Object.values(kpiCompElements).forEach(el => el.innerHTML = '');
        return;
    }

    const previousKpis = previousPeriodData.reduce((acc, cheque) => {
        acc.totalImporte += parseFloat(cheque['IMPORTE']) || 0;
        acc.totalPagado += parseFloat(cheque['PAGADO']) || 0;
        return acc;
    }, { totalImporte: 0, totalPagado: 0 });
    previousKpis.saldoPendiente = previousKpis.totalImporte - previousKpis.totalPagado;
    previousKpis.totalCheques = previousPeriodData.filter(c => (parseFloat(c['IMPORTE']) || 0) - (parseFloat(c['PAGADO']) || 0) > 0.01).length;
    previousKpis.totalVencido = previousPeriodData.filter(c => {
        const saldo = (parseFloat(c['IMPORTE']) || 0) - (parseFloat(c['PAGADO']) || 0);
        return saldo > 0.01 && new Date(c['FECHA']) < new Date();
    }).reduce((sum, c) => sum + ((parseFloat(c['IMPORTE']) || 0) - (parseFloat(c['PAGADO']) || 0)), 0);

    const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0; // Crecimiento infinito o sin cambio
        return ((current - previous) / previous) * 100;
    };

    const updateCompElement = (element, change, isGoodWhenDown = false) => {
        element.classList.remove('positive', 'negative', 'neutral');
        if (change > 0.1) {
            element.classList.add(isGoodWhenDown ? 'negative' : 'positive');
            element.textContent = `+${change.toFixed(0)}%`;
        } else if (change < -0.1) {
            element.classList.add(isGoodWhenDown ? 'positive' : 'negative');
            element.textContent = `${change.toFixed(0)}%`;
        } else {
            element.classList.add('neutral');
            element.textContent = `~0%`;
        }
    };

    updateCompElement(kpiCompElements.totalImporte, calculateChange(currentKpis.totalImporte, previousKpis.totalImporte), true);
    updateCompElement(kpiCompElements.totalPagado, calculateChange(currentKpis.totalPagado, previousKpis.totalPagado));
    updateCompElement(kpiCompElements.saldoPendiente, calculateChange(currentKpis.saldoPendiente, previousKpis.saldoPendiente), true);
    updateCompElement(kpiCompElements.totalCheques, calculateChange(currentKpis.totalCheques, previousKpis.totalCheques), true);
    updateCompElement(kpiCompElements.totalVencido, calculateChange(currentKpis.totalVencido, previousKpis.totalVencido), true);
}

let evolucionChart = null;
function drawEvolucionChart(cheques) {
    const now = new Date();
    // Generar un rango de meses: 3 pasados, el actual y 4 futuros (total 8 meses)
    const monthRange = new Array(8).fill(null).map((_, i) => {
        const d = new Date(now);
        const monthOffset = i - 3; // Offset de -3 a +4
        d.setMonth(now.getMonth() + monthOffset);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    });

    const dataByMonth = monthRange.reduce((acc, month) => {
        acc[month] = { importe: 0, pagado: 0 };
        return acc;
    }, {});

    cheques.forEach(cheque => {
        const fecha = new Date(cheque['FECHA']);
        const monthYear = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
        if (dataByMonth[monthYear]) {
            dataByMonth[monthYear].importe += parseFloat(cheque['IMPORTE']) || 0;
            dataByMonth[monthYear].pagado += parseFloat(cheque['PAGADO']) || 0;
        }
    });

    const labels = monthRange.map(my => {
        const [year, month] = my.split('-');
        return `${months[parseInt(month) - 1]} ${year}`;
    });
    const importes = monthRange.map(my => dataByMonth[my].importe);
    const pagados = monthRange.map(my => dataByMonth[my].pagado);

    const ctx = document.getElementById('evolucionChart').getContext('2d');
    if (evolucionChart) {
        evolucionChart.destroy();
    }
    evolucionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Importe Emitido',
                    data: importes,
                    backgroundColor: colorPalette[2] + '99', // Naranja con opacidad
                    borderColor: colorPalette[2],
                    borderWidth: 1
                },
                {
                    label: 'Importe Pagado',
                    data: pagados,
                    backgroundColor: colorPalette[1] + '99', // Teal con opacidad
                    borderColor: colorPalette[1],
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: true }, // Añadido para la consistencia
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed.y;
                            label += new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
                            return label;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const monthYear = monthRange[clickedIndex];
                    const newFilterValue = activeFilters['MES'] === monthYear ? null : monthYear;
                    handleFilterChange('MES', newFilterValue);
                }
            }
        }
    });
}

let vencimientoChart = null;
function drawVencimientoChart(cheques) {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const vencimientos = cheques.filter(cheque => {
        const fecha = new Date(cheque['FECHA']);
        return fecha >= today && fecha <= next30Days;
    }).reduce((acc, cheque) => {
        const fecha = new Date(cheque['FECHA']).toISOString().split('T')[0];
        acc[fecha] = (acc[fecha] || 0) + (parseFloat(cheque['IMPORTE']) || 0);
        return acc;
    }, {});

    const sortedDates = Object.keys(vencimientos).sort();
    const labels = sortedDates.map(date => {
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const data = sortedDates.map(date => vencimientos[date]);

    const ctx = document.getElementById('vencimientoChart').getContext('2d');
    if (vencimientoChart) {
        vencimientoChart.destroy();
    }
    vencimientoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Importes a Vencer',
                data: data,
                backgroundColor: colorPalette[2] + '99', // Naranja con opacidad
                borderColor: colorPalette[2],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }, // Añadido para corregir el error
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Vencimiento: ${context[0].label}`;
                        },
                        label: function(context) {
                            const value = context.raw;
                            return `Total: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)}`;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const clickedDate = sortedDates[clickedIndex];
                    const newFilterValue = activeFilters['FECHA'] === clickedDate ? null : clickedDate;
                    handleFilterChange('FECHA', newFilterValue);
                }
            }
        }
    });
}

let grupoGastoImporteChart = null;
function drawGrupoGastoImporteChart(cheques) {
    const chartCard = document.getElementById('grupoGastoImporteChart').closest('.chart-card');
    const titleElement = chartCard.querySelector('h2');
    const backButton = document.getElementById('gasto-chart-back-btn');

    let data, labels, totalImportes;

    if (gastoChartState.level === 'grupo') {
        titleElement.textContent = 'Importes por Grupo de Gasto';
        backButton.style.display = 'none';

        const importesPorGrupo = cheques.reduce((acc, cheque) => {
            const grupo = cheque['GRUPO DE GASTO'] || 'Sin Grupo';
            acc[grupo] = (acc[grupo] || 0) + (parseFloat(cheque['IMPORTE']) || 0);
            return acc;
        }, {});

        const sortedGrupos = Object.entries(importesPorGrupo).sort(([,a],[,b]) => b - a);
        labels = sortedGrupos.map(([label]) => label);
        data = sortedGrupos.map(([, value]) => value);

    } else { // Nivel 'categoria'
        const groupName = gastoChartState.filter;
        titleElement.textContent = `Desglose de ${groupName}`;
        backButton.style.display = 'block';

        const chequesDelGrupo = cheques.filter(c => c['GRUPO DE GASTO'] === groupName);
        const importesPorCategoria = chequesDelGrupo.reduce((acc, cheque) => {
            const categoria = cheque['CATEGORIA'] || 'Sin Categoría';
            acc[categoria] = (acc[categoria] || 0) + (parseFloat(cheque['IMPORTE']) || 0);
            return acc;
        }, {});

        const sortedCategorias = Object.entries(importesPorCategoria).sort(([,a],[,b]) => b - a);
        labels = sortedCategorias.map(([label]) => label);
        data = sortedCategorias.map(([, value]) => value);
    }

    const backgroundColors = labels.map((_, i) => colorPalette[i % colorPalette.length] + 'BF'); // BF = 75% opacity

    const ctx = document.getElementById('grupoGastoImporteChart').getContext('2d');
    if (grupoGastoImporteChart) {
        grupoGastoImporteChart.destroy();
    }
    grupoGastoImporteChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Importe por Grupo',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.substring(0, 7)),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: {
                legend: { display: false }, // This was missing
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.raw)}`
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    if (gastoChartState.level === 'grupo') {
                        // Drill down a categorías
                        gastoChartState.level = 'categoria';
                        gastoChartState.filter = labels[clickedIndex];
                        drawGrupoGastoImporteChart(applyFilters(allData)); // Redibujar solo este gráfico
                    } else {
                        // Aplicar filtro global de categoría
                        const clickedCategory = labels[clickedIndex];
                        handleFilterChange('CATEGORIA', activeFilters['CATEGORIA'] === clickedCategory ? null : clickedCategory);
                    }
                }
            }
        }
    });
}

let saldosPorBancoChart = null;
function drawSaldosPorBancoChart(cheques) {
    const saldosPorBanco = cheques.reduce((acc, cheque) => {
        const banco = cheque['BANCO'];
        const saldo = (parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0);
        if (banco) {
            acc[banco] = (acc[banco] || 0) + saldo;
        }
        return acc;
    }, {});

    const sortedBancos = Object.entries(saldosPorBanco)
        .filter(([, saldo]) => saldo > 0.01) // Mostrar solo bancos con saldo pendiente
        .sort(([, a], [, b]) => b - a);

    const labels = sortedBancos.map(([banco]) => banco);
    const data = sortedBancos.map(([, saldo]) => saldo);

    const backgroundColors = generateHarmoniousColors(labels.length, 210).map(c => c.replace(')', ', 0.7)').replace('hsl', 'hsla')); // Tono base azul (primary) con opacidad
    const borderColors = generateHarmoniousColors(labels.length, 210);

    const ctx = document.getElementById('saldosPorBancoChart').getContext('2d');
    if (saldosPorBancoChart) {
        saldosPorBancoChart.destroy();
    }
    saldosPorBancoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Saldo Pendiente',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Muestra las barras horizontalmente para mejor legibilidad
            scales: {
                x: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }, // Añadido para corregir el error
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return ` ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)}`;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const clickedLabel = labels[clickedIndex];
                    const newFilterValue = activeFilters['BANCO'] === clickedLabel ? null : clickedLabel;
                    handleFilterChange('BANCO', newFilterValue);
                }
            }
        }
    });
}

let proyeccionFlujoCajaChart = null;
function drawProyeccionFlujoCajaChart(cheques) {
    const now = new Date();
    const nextSixMonths = new Array(6).fill(null).map((_, i) => {
        const d = new Date(now);
        d.setDate(1); // Ir al primer día del mes actual
        d.setMonth(now.getMonth() + i);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    });

    const proyeccionPorMes = nextSixMonths.reduce((acc, month) => {
        acc[month] = 0;
        return acc;
    }, {});

    cheques.forEach(cheque => {
        const fecha = new Date(cheque['FECHA']);
        const monthYear = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
        if (proyeccionPorMes.hasOwnProperty(monthYear)) {
            proyeccionPorMes[monthYear] += parseFloat(cheque['IMPORTE']) || 0;
        }
    });

    const labels = nextSixMonths.map(my => {
        const [year, month] = my.split('-');
        return `${months[parseInt(month) - 1]} ${year}`;
    });
    const data = nextSixMonths.map(my => proyeccionPorMes[my]);

    const ctx = document.getElementById('proyeccionFlujoCajaChart').getContext('2d');
    if (proyeccionFlujoCajaChart) {
        proyeccionFlujoCajaChart.destroy();
    }
    proyeccionFlujoCajaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Importes a Vencer por Mes',
                data: data,
                fill: true,
                backgroundColor: colorPalette[5] + '40', // Violeta con baja opacidad
                borderColor: colorPalette[5],
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: true }, // Añadido para la consistencia
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `Total: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)}`;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const monthYear = nextSixMonths[clickedIndex];
                    const newFilterValue = activeFilters['MES'] === monthYear ? null : monthYear;
                    handleFilterChange('MES', newFilterValue);
                }
            }
        }
    });
}

let agingChart = null;
function drawAgingChart(cheques) {
    const hoy = new Date();
    const vencidos = cheques.filter(c => {
        const saldo = (parseFloat(c['IMPORTE']) || 0) - (parseFloat(c['PAGADO']) || 0);
        return saldo > 0.01 && new Date(c['FECHA']) < hoy;
    });

    const agingBuckets = {
        "0-30 días": 0,
        "31-60 días": 0,
        "61-90 días": 0,
        "91-120 días": 0,
        ">120 días": 0,
    };

    vencidos.forEach(c => {
        const fechaVto = new Date(c['FECHA']);
        const diasVencido = Math.floor((hoy - fechaVto) / (1000 * 60 * 60 * 24));
        const saldo = (parseFloat(c['IMPORTE']) || 0) - (parseFloat(c['PAGADO']) || 0);

        if (diasVencido <= 30) agingBuckets["0-30 días"] += saldo;
        else if (diasVencido <= 60) agingBuckets["31-60 días"] += saldo;
        else if (diasVencido <= 90) agingBuckets["61-90 días"] += saldo;
        else if (diasVencido <= 120) agingBuckets["91-120 días"] += saldo;
        else agingBuckets[">120 días"] += saldo;
    });

    const labels = Object.keys(agingBuckets);
    const data = Object.values(agingBuckets);

    const ctx = document.getElementById('agingChart').getContext('2d');
    if (agingChart) {
        agingChart.destroy();
    }
    agingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monto Vencido',
                data: data,
                backgroundColor: generateHarmoniousColors(labels.length, 0).map(c => c.replace(')', ', 0.7)').replace('hsl', 'hsla')), // Tono rojo
                borderColor: generateHarmoniousColors(labels.length, 0),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.raw)}`
                    }
                }
            }
        }
    });
}

function sortData(data) {
    const getSortValue = (item, key) => {
        const importe = parseFloat(item['IMPORTE']) || 0;
        const pagado = parseFloat(item['PAGADO']) || 0;

        switch (key) {
            case 'FECHA': return new Date(item['FECHA']);
            case 'IMPORTE': return importe;
            case 'FECHA DE PAGO': return item['FECHA DE PAGO'] ? new Date(item['FECHA DE PAGO']) : null;
            case 'PAGADO': return pagado;
            case 'PAGADO_STATUS': return pagado > 0;
            case 'SALDO': return importe - pagado;
            case 'DIAS_VTO': {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = new Date(item['FECHA']);
                return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            }
            case 'CONDICION': {
                const saldo = importe - pagado;
                if (saldo <= 0.01) return 'Pagado';
                const dueDate = new Date(item['FECHA']);
                return dueDate < new Date() ? 'Vencido' : 'A Vencer';
            }
            default:
                return (item[key] || '').toString().toLowerCase();
        }
    };

    const sortedData = [...data];
    sortedData.sort((a, b) => {
        const key = sortConfig.key;
        const valA = getSortValue(a, key);
        const valB = getSortValue(b, key);

        if (valA < valB) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });
    return sortedData;
}

function displayTablePage(data) {
    // Update sort indicators in table headers
    document.querySelectorAll('#data-table thead th[data-sort-key]').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        th.removeAttribute('aria-sort');
        if (th.dataset.sortKey === sortConfig.key) {
            th.classList.add(sortConfig.direction === 'ascending' ? 'sorted-asc' : 'sorted-desc');
            th.setAttribute('aria-sort', sortConfig.direction);
        }
    });

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = data.slice(startIndex, endIndex);

    // Actualizar el resumen de la tabla
    const summaryEl = document.getElementById('table-summary');
    if (data.length > 0) {
        const startItem = startIndex + 1;
        const endItem = Math.min(endIndex, data.length);
        const totalSaldo = data.reduce((sum, cheque) => {
            const importe = parseFloat(cheque['IMPORTE']) || 0;
            const pagado = parseFloat(cheque['PAGADO']) || 0;
            return sum + (importe - pagado);
        }, 0);
        summaryEl.textContent = `Mostrando ${startItem}-${endItem} de ${data.length} cheques (Saldo pendiente: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalSaldo)})`;
    } else {
        summaryEl.textContent = 'No se encontraron cheques con los filtros aplicados.';
    }

    drawDataTable(paginatedItems);
    setupPaginationControls(data);
}

function drawDataTable(paginatedCheques) {
    const tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = ''; // Limpiar tabla anterior

    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

    paginatedCheques.forEach(cheque => {
        const row = document.createElement('tr');
        row.dataset.id = cheque._id; // Asignar ID a la fila
        
        // Si esta es la fila que acabamos de añadir, la resaltamos
        if (highlightedRowId !== null && cheque._id === highlightedRowId) {
            row.classList.add('highlight');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightedRowId = null; // Limpiar para que no se resalte en futuros redibujados
        }

        // --- Cálculos para las nuevas columnas ---
        const fecha = new Date(cheque['FECHA']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diasParaVto = Math.ceil((fecha - today) / (1000 * 60 * 60 * 24));

        const importe = parseFloat(cheque['IMPORTE']) || 0;
        const pagado = parseFloat(cheque['PAGADO']) || 0;
        const saldo = importe - pagado;

        // Resaltar filas con vencimiento próximo (amarillo)
        if (diasParaVto >= 0 && diasParaVto <= 7 && saldo > 0.01) {
            row.classList.add('due-soon');
        }

        // Resaltar filas vencidas y no pagadas
        if (diasParaVto < 0 && saldo > 0.01) {
            row.classList.add('overdue-unpaid');
        }

        let condicion = '';
        let pillClass = '';
        if (saldo <= 0.01) { // Usamos un umbral pequeño por problemas de punto flotante
            condicion = 'Pagado';
            pillClass = 'pill-paid';
        } else if (diasParaVto < 0) {
            condicion = 'Vencido';
            pillClass = 'pill-overdue';
        } else {
            condicion = 'A Vencer';
            pillClass = 'pill-due';
        }

        // --- Formateo para visualización ---
        const fechaFormateada = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const importeFormateado = formatter.format(importe);
        const pagadoFormateado = formatter.format(pagado);
        const saldoFormateado = formatter.format(saldo);
        const isChecked = saldo <= 0.01;
        const fechaPago = cheque['FECHA DE PAGO']
            ? new Date(cheque['FECHA DE PAGO']).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-';
        const observacion = cheque["OBSERVACION"] || '-';
        const observacionHtml = `<div class="truncate" title="${observacion}">${observacion}</div>`;

        const ariaLabelBase = `el cheque del ${fechaFormateada}`;

        const pagadoCheckbox = `<input type="checkbox" class="payment-checkbox" data-id="${cheque._id}" ${isChecked ? 'checked' : ''} aria-label="Marcar como pagado ${ariaLabelBase}">`;
        
        const editBtn = `
            <button class="btn-icon edit-btn" data-id="${cheque._id}" aria-label="Editar ${ariaLabelBase}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>`;

        const diasVtoClass = diasParaVto < 0 ? 'days-to-due overdue' : 'days-to-due';

        row.innerHTML = `
            <td class="editable-cell" data-key="FECHA">${fechaFormateada}</td>
            <td class="${diasVtoClass}">${diasParaVto}</td>
            <td class="editable-cell" data-key="BANCO">${cheque['BANCO'] || '-'}</td>
            <td class="editable-cell" data-key="N° CHEQUE">${cheque["N° CHEQUE"] || '-'}</td>
            <td class="text-left">${observacionHtml}</td>
            <td class="text-right editable-cell" data-key="IMPORTE">${importeFormateado}</td>
            <td class="text-right">${pagadoFormateado}</td>
            <td class="text-right">${saldoFormateado}</td>
            <td>${fechaPago}</td>
            <td><span class="condition-pill ${pillClass}">${condicion}</span></td>
            <td class="action-cell">
                ${pagadoCheckbox}
                ${editBtn}
            </td>
        `;
        tableBody.appendChild(row);
    });
}
 
function setupPaginationControls(fullData) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';
    const pageCount = Math.ceil(fullData.length / rowsPerPage);

    if (pageCount <= 1) return;

    // Botón Anterior
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.id = 'prev-page-btn';
    prevButton.classList.add('pagination-btn');
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        currentPage--;
        displayTablePage(fullData);
    });

    // Indicador de página
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${pageCount}`;

    // Botón Siguiente
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente';
    nextButton.id = 'next-page-btn';
    nextButton.classList.add('pagination-btn');
    nextButton.disabled = currentPage === pageCount;
    nextButton.addEventListener('click', () => {
        currentPage++;
        displayTablePage(fullData);
    });

    paginationContainer.append(prevButton, pageIndicator, nextButton);
}

function handleSearchInput(value) {
    const lowerCaseValue = value.toLowerCase();

    // Borrar filtros conflictivos
    delete activeFilters['VENCIMIENTO_15_DIAS'];
    delete activeFilters['BUSQUEDA'];

    if (lowerCaseValue.includes('vencen en 15 días') || lowerCaseValue.includes('vencimiento 15 dias')) {
        activeFilters['VENCIMIENTO_15_DIAS'] = true;
    } else {
        activeFilters['BUSQUEDA'] = value;
    }
    updateDashboard(applyFilters(allData));
}

function populateFilters(data) {
    const yearFilter = document.getElementById('year-filter');
    const monthFilter = document.getElementById('month-filter');
    const bankFilter = document.getElementById('bank-filter');
    const categoryFilter = document.getElementById('category-filter');
    const groupFilter = document.getElementById('group-filter');

    const years = [...new Set(data.map(item => new Date(item['FECHA']).getFullYear()))].sort((a, b) => b - a);
    const banks = [...new Set(data.map(item => item['BANCO']).filter(Boolean))].sort();
    const categories = [...new Set(data.map(item => item['CATEGORIA']).filter(Boolean))].sort();
    const groups = [...new Set(data.map(item => item['GRUPO DE GASTO']).filter(Boolean))].sort();

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = month;
        monthFilter.appendChild(option);
    });

    banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank;
        option.textContent = bank;
        bankFilter.appendChild(option);
    });

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupFilter.appendChild(option);
    });

    // Añadir listeners
    yearFilter.addEventListener('change', (e) => handleFilterChange('AÑO', e.target.value));
    monthFilter.addEventListener('change', (e) => handleFilterChange('MES_NUMERO', e.target.value));
    bankFilter.addEventListener('change', (e) => handleFilterChange('BANCO', e.target.value));
    categoryFilter.addEventListener('change', (e) => handleFilterChange('CATEGORIA', e.target.value));
    groupFilter.addEventListener('change', (e) => handleFilterChange('GRUPO DE GASTO', e.target.value));

    document.getElementById('search-input').addEventListener('input', (e) => handleFilterChange('BUSQUEDA', e.target.value));
    document.getElementById('unpaid-filter').addEventListener('change', (e) => handleFilterChange('NO_PAGADOS', e.target.checked));
    document.getElementById('print-btn').addEventListener('click', () => window.print());
}

function updateFilterOptions(filteredData) {
    const updateSelect = (elementId, items, currentSelection) => {
        const select = document.getElementById(elementId);
        const firstOption = select.options[0]; // Guardar "Todos los..."
        select.innerHTML = '';
        select.appendChild(firstOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
        select.value = currentSelection || '';
    };

    // No actualizamos el filtro de año ni de mes, ya que son fijos.
    // Pero sí actualizamos los que dependen de los datos.

    const banks = [...new Set(filteredData.map(item => item['BANCO']).filter(Boolean))].sort();
    updateSelect('bank-filter', banks, activeFilters['BANCO']);

    const categories = [...new Set(filteredData.map(item => item['CATEGORIA']).filter(Boolean))].sort();
    updateSelect('category-filter', categories, activeFilters['CATEGORIA']);

    const groups = [...new Set(filteredData.map(item => item['GRUPO DE GASTO']).filter(Boolean))].sort();
    updateSelect('group-filter', groups, activeFilters['GRUPO DE GASTO']);
}

function updateURLWithFilters() {
    const params = new URLSearchParams();
    for (const key in activeFilters) {
        if (activeFilters[key]) {
            params.set(key, activeFilters[key]);
        }
    }
    // Actualiza la URL sin recargar la página
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
}

function handleFilterChange(key, value) {
    if (value) {
        activeFilters[key] = value;
    } else {
        delete activeFilters[key];
    }
    updateURLWithFilters();
    updateDashboard(applyFilters(allData));
}

function syncDropdowns() {
    document.getElementById('year-filter').value = activeFilters['AÑO'] || '';
    document.getElementById('month-filter').value = activeFilters['MES_NUMERO'] || '';
    document.getElementById('bank-filter').value = activeFilters['BANCO'] || '';
    document.getElementById('category-filter').value = activeFilters['CATEGORIA'] || '';
    document.getElementById('group-filter').value = activeFilters['GRUPO DE GASTO'] || '';
}

function setupSortableTable() {
    document.querySelectorAll('#data-table thead th[data-sort-key]').forEach(headerCell => {
        headerCell.setAttribute('scope', 'col'); // Añadir scope para accesibilidad
        headerCell.addEventListener('click', () => {
            const sortKey = headerCell.dataset.sortKey;
            let direction = 'ascending';
            if (sortConfig.key === sortKey && sortConfig.direction === 'ascending') {
                direction = 'descending';
            }
            sortConfig = { key: sortKey, direction };

            // Re-render the table with the new sort order
            const filteredData = applyFilters(allData);
            const sortedData = sortData(filteredData);
            displayTablePage(sortedData);
        });
    });
}

function setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        // Evitar la navegación si el usuario está escribiendo en un input, textarea o el modal está abierto
        const activeElement = document.activeElement;
        const isTyping = ['INPUT', 'TEXTAREA'].includes(activeElement.tagName);
        const isModalVisible = document.getElementById('new-check-modal').classList.contains('visible');

        if (isTyping || isModalVisible) {
            return;
        }

        if (e.key === 'ArrowRight') {
            const nextBtn = document.getElementById('next-page-btn');
            if (nextBtn && !nextBtn.disabled) {
                nextBtn.click();
            }
        } else if (e.key === 'ArrowLeft') {
            const prevBtn = document.getElementById('prev-page-btn');
            if (prevBtn && !prevBtn.disabled) {
                prevBtn.click();
            }
        }
    });
}

/**
 * Abre el modal y lo configura para la edición de un cheque existente.
 * @param {object} check - El objeto cheque a editar.
 */
function openEditModal(check) {
    const modal = document.getElementById('new-check-modal');
    const deleteBtn = document.getElementById('modal-delete-btn');
    const form = document.getElementById('new-check-form');
    form.reset();

    document.getElementById('modal-title').textContent = 'Editar Cheque';
    document.getElementById('form-check-id').value = check._id;
    
    // Rellenar el formulario con los datos del cheque
    document.getElementById('form-fecha').value = new Date(check['FECHA']).toISOString().split('T')[0];
    document.getElementById('form-importe').value = check['IMPORTE'];
    document.getElementById('form-banco').value = check['BANCO'] || '';
    document.getElementById('form-cheque-nro').value = check['N° CHEQUE'] || '';
    document.getElementById('form-talon-nro').value = check['TALON N°'] || ''; 
    document.getElementById('form-categoria').value = check['CATEGORIA'] || '';
    document.getElementById('form-grupo-gasto').value = check['GRUPO DE GASTO'] || '';
    document.getElementById('form-observacion').value = check['OBSERVACION'] || '';

    deleteBtn.style.display = 'block'; // Mostrar el botón de eliminar
    modal.classList.add('visible');
    
    // Poblar los datalists
    populateModalDatalists();
    validateForm();
}

function createInlineEditor(cell, checkId, originalValue) {
    const key = cell.dataset.key;
    cell.innerHTML = ''; // Limpiar la celda

    const input = document.createElement('input');
    input.className = 'inline-edit-input';

    // Configurar tipo de input según la columna
    if (key === 'FECHA') {
        input.type = 'date';
        input.value = new Date(originalValue).toISOString().split('T')[0];
    } else if (key === 'IMPORTE') {
        input.type = 'number';
        input.step = '0.01';
        input.value = originalValue;
    } else {
        input.type = 'text';
        input.value = originalValue;
    }

    cell.appendChild(input);
    input.focus();
    input.select();

    const saveChanges = async () => {
        const newValue = input.value;

        // Si no hay cambios, simplemente revertir
        if (String(newValue) === String(originalValue)) {
            revertCell();
            return;
        }

        // Validación simple
        if (key === 'IMPORTE' && (isNaN(parseFloat(newValue)) || parseFloat(newValue) <= 0)) {
            showToast('El importe debe ser un número positivo.', 'error');
            revertCell();
            return;
        }

        const payload = {
            action: 'editCheck',
            id: checkId,
            [key]: newValue
        };

        const result = await sendUpdateToAPI(payload);
        if (result) {
            showToast('Cheque actualizado con éxito.', 'success');
            // 1. Actualizar el dato en la memoria local para respuesta visual inmediata
            const checkToUpdate = allData.find(c => c._id === checkId);
            if (checkToUpdate) checkToUpdate[key] = newValue;
            highlightedRowId = checkId; // Marcar para resaltar
            updateDashboard(applyFilters(allData)); // Redibujar con datos locales para inmediatez
        } else {
            // La API falló, revertir visualmente
            revertCell();
        }
    };

    const revertCell = () => {
        // Para revertir, simplemente recargamos el dashboard. Es más seguro.
        updateDashboard(applyFilters(allData));
    };

    input.addEventListener('blur', saveChanges);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // Dispara el guardado
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // Eliminar el listener de blur para evitar el guardado y luego revertir
            input.removeEventListener('blur', saveChanges);
            revertCell();
        }
    });
}

/**
 * Valida un campo individual del formulario y muestra/oculta su mensaje de error.
 * @param {HTMLInputElement} field - El campo del formulario a validar.
 * @returns {boolean} - `true` si el campo es válido, de lo contrario `false`.
 */
function validateField(field) {
    const errorDiv = field.nextElementSibling;
    let isValid = true;
    if (field.required && !field.value.trim()) {
        errorDiv.textContent = 'Este campo es obligatorio.';
        errorDiv.style.display = 'block';
        isValid = false;
    } else if (field.type === 'number' && (parseFloat(field.value) <= 0 || isNaN(parseFloat(field.value)))) {
        errorDiv.textContent = 'El importe debe ser un número positivo.';
        errorDiv.style.display = 'block';
        isValid = false;
    } else {
        errorDiv.style.display = 'none';
    }
    return isValid;
}

/**
 * Valida todo el formulario del modal y habilita/deshabilita el botón de guardar.
 * @returns {boolean} - `true` si todo el formulario es válido, de lo contrario `false`.
 */
function validateForm() {
    const form = document.getElementById('new-check-form');
    const saveBtn = document.getElementById('modal-save-btn');
    let isFormValid = true;
    form.querySelectorAll('input[required], input[type="number"]').forEach(field => {
        if (!validateField(field)) isFormValid = false;
    });
    saveBtn.disabled = !isFormValid;
    return isFormValid;
}

function setupModalInteractions() {
    const modal = document.getElementById('new-check-modal');
    const openBtn = document.getElementById('new-check-btn');
    const deleteBtn = document.getElementById('modal-delete-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const form = document.getElementById('new-check-form');
    const saveBtn = document.getElementById('modal-save-btn');

    openBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('modal-title').textContent = 'Añadir Nuevo Cheque';
        deleteBtn.style.display = 'none'; // Ocultar botón de eliminar al añadir
        document.getElementById('form-check-id').value = ''; // Asegurarse que no estamos en modo edición
        form.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
        modal.classList.add('visible');

        // Poblar los datalists con los datos existentes
        populateModalDatalists();
        
        validateForm(); // Validar al abrir para asegurar estado correcto del botón
    });

    const closeModal = () => modal.classList.remove('visible');
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());

    form.addEventListener('input', (e) => {
        validateField(e.target);
        validateForm();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        const checkId = document.getElementById('form-check-id').value;
        const isEditing = checkId !== '';

        const payload = { 
            action: isEditing ? 'editCheck' : 'addCheck',
            id: isEditing ? parseInt(checkId, 10) : undefined
        };
        new FormData(form).forEach((value, key) => payload[key] = value);
        const result = await sendUpdateToAPI(payload);
        if (result) {
            closeModal();
            showToast(isEditing ? 'Cheque actualizado con éxito.' : 'Cheque añadido con éxito.', 'success');
            // Si estamos añadiendo, marcamos la nueva fila para resaltarla
            if (!isEditing) {
                highlightedRowId = allData.length;
            } else {
                highlightedRowId = parseInt(checkId, 10);
            }
            allData = await fetchData(); // Solo recargamos los datos
            updateDashboard(applyFilters(allData)); // Y actualizamos la vista
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cheque';
    });

    deleteBtn.addEventListener('click', async () => {
        const checkId = document.getElementById('form-check-id').value;
        if (!checkId) return;

        if (confirm('¿Estás seguro de que quieres eliminar este cheque? Esta acción no se puede deshacer.')) {
            const payload = {
                action: 'deleteCheck',
                id: parseInt(checkId, 10)
            };

            const result = await sendUpdateToAPI(payload);
            if (result) {
                closeModal();
                showToast('Cheque eliminado con éxito.', 'success');
                
                // Recargar los datos desde la API para asegurar la consistencia
                allData = await fetchData();
                updateDashboard(applyFilters(allData));
            }
        }
    });
}

function setupTableInteractions() {
    const tableBody = document.getElementById('data-table-body');

    // Delegación de eventos para toda la tabla
    tableBody.addEventListener('click', async (event) => {
        const target = event.target;

        // Clic en el checkbox de pagado
        if (target.classList.contains('payment-checkbox')) {
            target.disabled = true; // Deshabilitar mientras se procesa
            const checkId = parseInt(target.dataset.id, 10);
            
            const payload = {
                action: 'updatePayment',
                id: checkId,
                isPaid: target.checked
            };

            const result = await sendUpdateToAPI(payload);
            if (result) {
                const checkToUpdate = allData.find(c => c._id === checkId);
                if (checkToUpdate) {
                    checkToUpdate['PAGADO'] = target.checked ? checkToUpdate['IMPORTE'] : 0;
                    checkToUpdate['FECHA DE PAGO'] = target.checked ? new Date().toISOString() : null;
                }
                showToast('Estado del cheque actualizado con éxito.', 'success');
                highlightedRowId = checkId;
                updateDashboard(applyFilters(allData));
            } else {
                target.checked = !target.checked; // Revertir si falla
                target.disabled = false;
            }
            return; // Terminar ejecución para este evento
        }

        // Clic en el botón de editar (lápiz)
        const editButton = target.closest('.edit-btn');
        if (editButton) {
            const checkId = parseInt(editButton.dataset.id, 10);
            const checkToEdit = allData.find(c => c._id === checkId);
            if (checkToEdit) openEditModal(checkToEdit);
            return;
        }

        // Clic en una celda para edición en línea
        const editableCell = target.closest('td.editable-cell');
        if (editableCell) {
            const row = editableCell.closest('tr');
            const checkId = parseInt(row.dataset.id, 10);
            const check = allData.find(c => c._id === checkId);
            const key = editableCell.dataset.key;
            if (check && key) {
                createInlineEditor(editableCell, checkId, check[key]);
            }
        }
    });

    // Doble clic en una fila para abrir el modal de edición
    tableBody.addEventListener('dblclick', (event) => {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.id) return;

        const checkId = parseInt(row.dataset.id, 10);
        const checkToEdit = allData.find(c => c._id === checkId);
        if (checkToEdit) {
            openEditModal(checkToEdit);
        }
    });
}

function setupChartInteractions() {
    // Listener para el botón de "volver" del drill-down
    document.getElementById('gasto-chart-back-btn').addEventListener('click', () => {
        gastoChartState.level = 'grupo';
        gastoChartState.filter = null;
        drawGrupoGastoImporteChart(applyFilters(allData));
    });
}

function exportToCSV() {
    const filteredData = applyFilters(allData);
    if (filteredData.length === 0) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }

    const headers = [
        "Fecha de Cheque", "Días P/Vencimiento", "Banco", "Cheque N°", "Observaciones", 
        "Importe", "Pagado", "Saldo", "Fecha de Pago", "Condición"
    ];

    const csvRows = [headers.join(',')]; // Add header row

    const sortedData = sortData(filteredData); // Use the current sort order

    sortedData.forEach(cheque => {
        const fecha = new Date(cheque['FECHA']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diasParaVto = Math.ceil((fecha - today) / (1000 * 60 * 60 * 24));
        const importe = parseFloat(cheque['IMPORTE']) || 0;
        const pagado = parseFloat(cheque['PAGADO']) || 0;
        const saldo = importe - pagado;

        let condicion = '';
        if (saldo <= 0.01) {
            condicion = 'Pagado';
        } else if (diasParaVto < 0) {
            condicion = 'Vencido';
        } else {
            condicion = 'A Vencer';
        }

        const fechaFormateada = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const fechaPagoFormateada = cheque['FECHA DE PAGO']
            ? new Date(cheque['FECHA DE PAGO']).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
        
        // Escapar comillas y envolver en comillas para manejar comas en el texto
        const observacion = `"${(cheque['OBSERVACION'] || '').replace(/"/g, '""')}"`;

        const row = [
            fechaFormateada,
            diasParaVto,
            cheque['BANCO'] || '',
            cheque['N° CHEQUE'] || '',
            observacion,
            importe.toFixed(2),
            pagado.toFixed(2),
            saldo.toFixed(2),
            fechaPagoFormateada,
            condicion
        ].join(',');
        csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF (BOM) para compatibilidad con Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'reporte_cheques.csv');
    a.click();
}

/**
 * Rellena los datalists del modal con opciones basadas en los datos actuales.
 */
function populateModalDatalists() {
    // 1. Bancos
    const bankList = document.getElementById('bank-list');
    bankList.innerHTML = ''; 
    const banks = [...new Set(allData.map(item => item['BANCO']).filter(Boolean))].sort();
    banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank;
        bankList.appendChild(option);
    });

    // 2. Talones
    const talonList = document.getElementById('talon-list');
    talonList.innerHTML = ''; 
    const talons = [...new Set(allData.map(item => item['TALON N°']).filter(Boolean))].sort();
    talons.forEach(talon => {
        const option = document.createElement('option');
        option.value = talon;
        talonList.appendChild(option);
    });

    // 3. Grupos de Gasto
    const groupList = document.getElementById('group-list');
    groupList.innerHTML = ''; 
    const groups = [...new Set(allData.map(item => item['GRUPO DE GASTO']).filter(Boolean))].sort();
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        groupList.appendChild(option);
    });

    // 4. Categorías
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = ''; 
    const categories = [...new Set(allData.map(item => item['CATEGORIA']).filter(Boolean))].sort();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        categoryList.appendChild(option);
    });
}

async function initDashboard() {
    // Leer filtros desde la URL al iniciar
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
        // Convertir 'true'/'false' de string a boolean para checkboxes
        if (value === 'true') activeFilters[key] = true;
        else if (value === 'false') activeFilters[key] = false;
        else activeFilters[key] = value;
    });

    allData = await fetchData();

    if (allData) {
        const filteredData = applyFilters(allData);
        updateDashboard(filteredData);

        setupSortableTable();
        setupTableInteractions();
        setupModalInteractions();
        setupChartInteractions();
        setupKeyboardNav();
        // Configurar el botón de limpiar filtros
        const clearBtn = document.getElementById('clear-filters-btn');
        clearBtn.addEventListener('click', () => {
            window.history.replaceState({}, '', window.location.pathname); // Limpiar URL
            activeFilters = {};
            // Resetear los menús desplegables
            document.getElementById('year-filter').value = '';
            document.getElementById('month-filter').value = '';
            document.getElementById('bank-filter').value = '';
            document.getElementById('category-filter').value = '';
            document.getElementById('group-filter').value = '';
            document.getElementById('search-input').value = '';
            document.getElementById('unpaid-filter').checked = false;
            // Al limpiar, las opciones de los filtros deben volver a mostrar todo
            updateFilterOptions(allData);
            updateDashboard(allData);
        });
        document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

        // Listener para el nuevo KPI de vencidos
        document.getElementById('kpi-vencido').addEventListener('click', () => handleFilterChange('VENCIDOS', activeFilters['VENCIDOS'] ? null : true));
        
        // Sincronizar el estado inicial del checkbox de no pagados si viene de la URL
        document.getElementById('unpaid-filter').checked = activeFilters['NO_PAGADOS'] || false;

        populateFilters(allData);
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);