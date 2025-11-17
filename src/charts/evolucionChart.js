// src/charts/evolucionChart.js
import { handleFilterChange } from '../utils/filters.js';
import { colorPalette } from '../utils/constants.js';

let evolucionChart = null;

export function drawEvolucionChart(cheques) {
    const now = new Date();
    const monthRange = new Array(8).fill(null).map((_, i) => {
        const d = new Date(now);
        d.setMonth(now.getMonth() + (i - 3));
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
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
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
            labels,
            datasets: [
                {
                    label: 'Importe Emitido',
                    data: importes,
                    backgroundColor: colorPalette[2] + '99',
                    borderColor: colorPalette[2],
                    borderWidth: 1
                },
                {
                    label: 'Importe Pagado',
                    data: pagados,
                    backgroundColor: colorPalette[1] + '99',
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
                legend: { display: true },
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
                    handleFilterChange('MES', monthYear);
                }
            }
        }
    });
}
