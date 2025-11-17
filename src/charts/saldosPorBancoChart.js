// src/charts/saldosPorBancoChart.js
import { handleFilterChange } from '../utils/filters.js';
import { generateHarmoniousColors } from '../utils/ui.js';

let saldosPorBancoChart = null;

export function drawSaldosPorBancoChart(cheques) {
    const saldosPorBanco = cheques.reduce((acc, cheque) => {
        const banco = cheque['BANCO'];
        const saldo = (parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0);
        if (banco && saldo > 0) {
            acc[banco] = (acc[banco] || 0) + saldo;
        }
        return acc;
    }, {});

    const sortedBancos = Object.entries(saldosPorBanco).sort(([, a], [, b]) => b - a);

    const labels = sortedBancos.map(([banco]) => banco);
    const data = sortedBancos.map(([, saldo]) => saldo);

    const backgroundColors = generateHarmoniousColors(labels.length, 210).map(c => c.replace(')', ', 0.7)').replace('hsl', 'hsla'));
    const borderColors = generateHarmoniousColors(labels.length, 210);

    const ctx = document.getElementById('saldosPorBancoChart').getContext('2d');
    if (saldosPorBancoChart) {
        saldosPorBancoChart.destroy();
    }
    saldosPorBancoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Saldo Pendiente',
                data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
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
                    handleFilterChange('BANCO', labels[clickedIndex]);
                }
            }
        }
    });
}
