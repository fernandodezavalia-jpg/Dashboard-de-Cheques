// src/charts/vencimientoChart.js
import { handleFilterChange } from '../utils/filters.js';
import { colorPalette } from '../utils/constants.js';

let vencimientoChart = null;

export function drawVencimientoChart(cheques) {
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
            labels,
            datasets: [{
                label: 'Importes a Vencer',
                data,
                backgroundColor: colorPalette[2] + '99',
                borderColor: colorPalette[2],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false },
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
                    handleFilterChange('FECHA', clickedDate);
                }
            }
        }
    });
}
