// src/main.js
import { fetchData } from './api/sheet.js';
import { setAllData, state } from './utils/state.js';
import { applyFilters, setupFilterInteractions } from './utils/filters.js';
import { setupTableInteractions, displayTablePage } from './components/table.js';
import { setupModalInteractions } from './components/modal.js';
import { updateAllCharts } from './charts/main.js';
import { setupActionButtons } from './utils/actions.js';

function calculatePeriodComparison(currentKpis) {
    let previousPeriodData = [];
    let hasPeriodFilter = false;

    if (state.activeFilters['AÑO'] && state.activeFilters['MES_NUMERO']) {
        hasPeriodFilter = true;
        const currentYear = parseInt(state.activeFilters['AÑO']);
        const currentMonth = parseInt(state.activeFilters['MES_NUMERO']);
        const prevDate = new Date(currentYear, currentMonth - 2, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth() + 1;

        previousPeriodData = state.allData.filter(item => {
            const itemDate = new Date(item['FECHA']);
            return itemDate.getFullYear() === prevYear && (itemDate.getMonth() + 1) === prevMonth;
        });
    } else if (state.activeFilters['AÑO']) {
        hasPeriodFilter = true;
        const currentYear = parseInt(state.activeFilters['AÑO']);
        const prevYear = currentYear - 1;
        previousPeriodData = state.allData.filter(item => new Date(item['FECHA']).getFullYear() === prevYear);
    }

    const kpiCompElements = {
        totalImporte: document.getElementById('total-importe-comp'),
        totalPagado: document.getElementById('total-pagado-comp'),
        saldoPendiente: document.getElementById('saldo-pendiente-comp'),
        totalCheques: document.getElementById('total-cheques-comp'),
        totalVencido: document.getElementById('total-vencido-comp'),
    };

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
        if (previous === 0) return current > 0 ? 100 : 0;
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


function updateKPIs(data) {
    const kpiValues = data.reduce((acc, cheque) => {
        acc.totalImporte += parseFloat(cheque['IMPORTE']) || 0;
        acc.totalPagado += parseFloat(cheque['PAGADO']) || 0;
        return acc;
    }, { totalImporte: 0, totalPagado: 0 });

    const saldoPendiente = kpiValues.totalImporte - kpiValues.totalPagado;
    const totalCheques = data.filter(cheque => (parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0) > 0.01).length;
    const totalVencido = data.filter(cheque => {
        const saldo = (parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0);
        return saldo > 0.01 && new Date(cheque['FECHA']) < new Date();
    }).reduce((sum, cheque) => sum + ((parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0)), 0);

    document.getElementById('total-importe').textContent = `$${kpiValues.totalImporte.toLocaleString('es-AR')}`;
    document.getElementById('total-pagado').textContent = `$${kpiValues.totalPagado.toLocaleString('es-AR')}`;
    document.getElementById('saldo-pendiente').textContent = `$${saldoPendiente.toLocaleString('es-AR')}`;
    document.getElementById('total-cheques').textContent = totalCheques;
    document.getElementById('total-vencido').textContent = `$${totalVencido.toLocaleString('es-AR')}`;

    calculatePeriodComparison(kpiValues);
}

function updateDashboard(data) {
    updateKPIs(data);
    updateAllCharts(data, () => updateDashboard(applyFilters(state.allData)));
    displayTablePage(data);
}

function setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        const isTyping = ['INPUT', 'TEXTAREA'].includes(activeElement.tagName);
        const isModalVisible = document.getElementById('new-check-modal').classList.contains('visible');

        if (isTyping || isModalVisible) {
            return;
        }

        if (e.key === 'ArrowRight') {
            const nextBtn = document.querySelector('#pagination-container button:last-child');
            if (nextBtn && !nextBtn.disabled) {
                nextBtn.click();
            }
        } else if (e.key === 'ArrowLeft') {
            const prevBtn = document.querySelector('#pagination-container button:first-child');
            if (prevBtn && !prevBtn.disabled) {
                prevBtn.click();
            }
        }
    });
}

async function initDashboard() {
    const data = await fetchData();
    if (data) {
        setAllData(data);
        const updateFn = () => updateDashboard(applyFilters(state.allData));
        setupFilterInteractions(updateFn);
        setupTableInteractions(updateFn);
        setupModalInteractions(updateFn);
        setupActionButtons();
        setupKeyboardNav();
        updateDashboard(applyFilters(state.allData));
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
