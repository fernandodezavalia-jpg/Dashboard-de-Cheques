// src/charts/grupoGastoChart.js
import { handleFilterChange } from '../utils/filters.js';
import { colorPalette } from '../utils/constants.js';
import { state } from '../utils/state.js';
import { applyFilters } from '../utils/filters.js';

let grupoGastoImporteChart = null;
let gastoChartState = {
    level: 'grupo',
    filter: null
};
let updateCallback;

export function drawGrupoGastoImporteChart(cheques, callback) {
    if (callback) {
        updateCallback = callback;
    }
    const chartCard = document.getElementById('grupoGastoImporteChart').closest('.chart-card');
    const titleElement = chartCard.querySelector('h2');
    const backButton = document.getElementById('gasto-chart-back-btn');

    let data, labels;

    if (gastoChartState.level === 'grupo') {
        titleElement.textContent = 'Importes por Grupo de Gasto';
        backButton.style.display = 'none';

        const importesPorGrupo = cheques.reduce((acc, cheque) => {
            const grupo = cheque['GRUPO DE GASTO'] || 'Sin Grupo';
            acc[grupo] = (acc[grupo] || 0) + (parseFloat(cheque['IMPORTE']) || 0);
            return acc;
        }, {});

        const sortedGrupos = Object.entries(importesPorGrupo).sort(([, a], [, b]) => b - a);
        labels = sortedGrupos.map(([label]) => label);
        data = sortedGrupos.map(([, value]) => value);

    } else {
        const groupName = gastoChartState.filter;
        titleElement.textContent = `Desglose de ${groupName}`;
        backButton.style.display = 'block';

        const chequesDelGrupo = cheques.filter(c => c['GRUPO DE GASTO'] === groupName);
        const importesPorCategoria = chequesDelGrupo.reduce((acc, cheque) => {
            const categoria = cheque['CATEGORIA'] || 'Sin Categoría';
            acc[categoria] = (acc[categoria] || 0) + (parseFloat(cheque['IMPORTE']) || 0);
            return acc;
        }, {});

        const sortedCategorias = Object.entries(importesPorCategoria).sort(([, a], [, b]) => b - a);
        labels = sortedCategorias.map(([label]) => label);
        data = sortedCategorias.map(([, value]) => value);
    }

    const backgroundColors = labels.map((_, i) => colorPalette[i % colorPalette.length] + 'BF');

    const ctx = document.getElementById('grupoGastoImporteChart').getContext('2d');
    if (grupoGastoImporteChart) {
        grupoGastoImporteChart.destroy();
    }
    grupoGastoImporteChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Importe',
                data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.substring(0, 7)),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: {
                legend: { display: false },
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
                        gastoChartState.level = 'categoria';
                        gastoChartState.filter = labels[clickedIndex];
                        drawGrupoGastoImporteChart(cheques);
                    } else {
                        handleFilterChange('CATEGORIA', labels[clickedIndex]);
                    }
                }
            }
        }
    });
}

document.getElementById('gasto-chart-back-btn').addEventListener('click', () => {
    gastoChartState.level = 'grupo';
    gastoChartState.filter = null;
    drawGrupoGastoImporteChart(applyFilters(state.allData));
});
