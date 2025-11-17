// src/utils/filters.js
import { state, setFilter, clearFilters } from './state.js';

let updateCallback;

export function applyFilters(data) {
    if (Object.keys(state.activeFilters).length === 0) {
        return data;
    }

    return data.filter(item => {
        for (const filterKey in state.activeFilters) {
            const filterValue = state.activeFilters[filterKey];
            const itemDate = new Date(item['FECHA']);

            if (filterKey === 'AÑO' && itemDate.getFullYear().toString() !== filterValue) return false;
            if (filterKey === 'MES_NUMERO' && (itemDate.getMonth() + 1).toString() !== filterValue) return false;
            if (filterKey === 'BANCO' && item[filterKey] !== filterValue) return false;
            if (filterKey === 'CATEGORIA' && item[filterKey] !== filterValue) return false;
            if (filterKey === 'GRUPO DE GASTO' && item[filterKey] !== filterValue) return false;
            if (filterKey === 'NO_PAGADOS' && (parseFloat(item['PAGADO']) || 0) > 0) return false;
            if (filterKey === 'VENCIDOS' && (new Date(item['FECHA']) >= new Date() || ((parseFloat(item['IMPORTE']) || 0) - (parseFloat(item['PAGADO']) || 0)) <= 0.01)) return false;

            if (filterKey === 'BUSQUEDA') {
                const searchTerm = filterValue.toLowerCase();
                const chequeNum = (item['N° CHEQUE'] || '').toString().toLowerCase();
                const observacion = (item['OBSERVACION'] || '').toLowerCase();
                if (!chequeNum.includes(searchTerm) && !observacion.includes(searchTerm)) {
                    return false;
                }
            }
        }
        return true;
    });
}

export function handleFilterChange(key, value) {
    setFilter(key, value);
    updateCallback();
}

export function setupFilterInteractions(callback) {
    updateCallback = callback;
    document.getElementById('year-filter').addEventListener('change', (e) => handleFilterChange('AÑO', e.target.value));
    document.getElementById('month-filter').addEventListener('change', (e) => handleFilterChange('MES_NUMERO', e.target.value));
    document.getElementById('bank-filter').addEventListener('change', (e) => handleFilterChange('BANCO', e.target.value));
    document.getElementById('category-filter').addEventListener('change', (e) => handleFilterChange('CATEGORIA', e.target.value));
    document.getElementById('group-filter').addEventListener('change', (e) => handleFilterChange('GRUPO DE GASTO', e.target.value));
    document.getElementById('search-input').addEventListener('input', (e) => handleFilterChange('BUSQUEDA', e.target.value));
    document.getElementById('unpaid-filter').addEventListener('change', (e) => handleFilterChange('NO_PAGADOS', e.target.checked));

    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        clearFilters();
        // Reset dropdowns
        document.getElementById('year-filter').value = '';
        document.getElementById('month-filter').value = '';
        document.getElementById('bank-filter').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('group-filter').value = '';
        document.getElementById('search-input').value = '';
        document.getElementById('unpaid-filter').checked = false;
        updateCallback();
    });
}
