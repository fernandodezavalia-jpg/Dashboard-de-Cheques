// src/charts/flujoCajaChart.js
import { handleFilterChange } from '../utils/filters.js';
import { colorPalette } from '../utils/constants.js';

let proyeccionFlujoCajaChart = null;

export function drawProyeccionFlujoCajaChart(cheques) {
    const now = new Date();
    const nextSixMonths = new Array(6).fill(null).map((_, i) => {
        const d = new Date(now);
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
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
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
            labels,
            datasets: [{
                label: 'Importes a Vencer por Mes',
                data,
                fill: true,
                backgroundColor: colorPalette[5] + '40',
                borderColor: colorPalette[5],
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: true },
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
                    handleFilterChange('MES', monthYear);
                }
            }
        }
    });
}
