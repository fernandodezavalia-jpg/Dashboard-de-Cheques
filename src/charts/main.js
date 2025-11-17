// src/charts/main.js
import { drawEvolucionChart } from './evolucionChart.js';
import { drawVencimientoChart } from './vencimientoChart.js';
import { drawGrupoGastoImporteChart } from './grupoGastoChart.js';
import { drawSaldosPorBancoChart } from './saldosPorBancoChart.js';
import { drawProyeccionFlujoCajaChart } from './flujoCajaChart.js';
import { drawAgingChart } from './agingChart.js';

export function updateAllCharts(data, callback) {
    drawEvolucionChart(data);
    drawVencimientoChart(data);
    drawGrupoGastoImporteChart(data, callback);
    drawSaldosPorBancoChart(data);
    drawProyeccionFlujoCajaChart(data);
    drawAgingChart(data);
}
