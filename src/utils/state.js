// src/utils/state.js

/**
 * El estado global de la aplicación.
 * @property {Array} allData - Todos los datos de los cheques.
 * @property {object} activeFilters - Los filtros activos.
 * @property {number} currentPage - La página actual de la tabla.
 * @property {object} sortConfig - La configuración de ordenación de la tabla.
 * @property {string|null} highlightedRowId - El ID de la fila a resaltar.
 */
export const state = {
    allData: [],
    activeFilters: {},
    currentPage: 1,
    rowsPerPage: 15,
    sortConfig: { key: 'FECHA', direction: 'descending' },
    highlightedRowId: null,
};

/**
 * Actualiza los datos de la aplicación.
 * @param {Array} data - Los nuevos datos.
 */
export function setAllData(data) {
    state.allData = data;
}

/**
 * Actualiza un filtro.
 * @param {string} key - La clave del filtro.
 * @param {any} value - El valor del filtro.
 */
export function setFilter(key, value) {
    if (value) {
        state.activeFilters[key] = value;
    } else {
        delete state.activeFilters[key];
    }
}

/**
 * Limpia todos los filtros.
 */
export function clearFilters() {
    state.activeFilters = {};
}

/**
 * Actualiza la página actual.
 * @param {number} page - La nueva página.
 */
export function setCurrentPage(page) {
    state.currentPage = page;
}

/**
 * Actualiza la configuración de ordenación.
 * @param {string} key - La nueva clave de ordenación.
 * @param {string} direction - La nueva dirección de ordenación.
 */
export function setSortConfig(key, direction) {
    state.sortConfig = { key, direction };
}

/**
 * Actualiza el ID de la fila a resaltar.
 * @param {string|null} id - El nuevo ID.
 */
export function setHighlightedRowId(id) {
    state.highlightedRowId = id;
}
