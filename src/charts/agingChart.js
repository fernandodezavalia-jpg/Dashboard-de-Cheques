// src/charts/agingChart.js
import { generateHarmoniousColors } from '../utils/ui.js';

let agingChart = null;

export function drawAgingChart(cheques) {
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
            labels,
            datasets: [{
                label: 'Monto Vencido',
                data,
                backgroundColor: generateHarmoniousColors(labels.length, 0).map(c => c.replace(')', ', 0.7)').replace('hsl', 'hsla')),
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
