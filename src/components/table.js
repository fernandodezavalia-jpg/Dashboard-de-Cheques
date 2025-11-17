// src/components/table.js
import { state, setCurrentPage, setSortConfig, setHighlightedRowId } from '../utils/state.js';
import { openEditModal } from './modal.js';
import { sendUpdateToAPI } from '../api/sheet.js';
import { showToast } from '../utils/ui.js';
import { applyFilters } from '../utils/filters.js';

let updateCallback;

const tableBody = document.getElementById('data-table-body');
const paginationContainer = document.getElementById('pagination-container');
const summaryEl = document.getElementById('table-summary');

function createInlineEditor(cell, checkId, originalValue) {
    const key = cell.dataset.key;
    cell.innerHTML = '';

    const input = document.createElement('input');
    input.className = 'inline-edit-input';

    if (key === 'FECHA') {
        input.type = 'date';
        input.value = new Date(originalValue).toISOString().split('T')[0];
    } else if (key === 'IMPORTE') {
        input.type = 'number';
        input.step = '0.01';
        input.value = originalValue;
    } else {
        input.type = 'text';
        input.value = originalValue;
    }

    cell.appendChild(input);
    input.focus();
    input.select();

    const saveChanges = async () => {
        const newValue = input.value;

        if (String(newValue) === String(originalValue)) {
            revertCell();
            return;
        }

        if (key === 'IMPORTE' && (isNaN(parseFloat(newValue)) || parseFloat(newValue) <= 0)) {
            showToast('El importe debe ser un número positivo.', 'error');
            revertCell();
            return;
        }

        const payload = {
            action: 'editCheck',
            id: checkId,
            [key]: newValue
        };

        const result = await sendUpdateToAPI(payload);
        if (result) {
            showToast('Cheque actualizado.', 'success');
            const checkToUpdate = state.allData.find(c => c._id === checkId);
            if (checkToUpdate) checkToUpdate[key] = newValue;
            setHighlightedRowId(checkId);
            updateCallback();
        } else {
            revertCell();
        }
    };

    const revertCell = () => {
        updateCallback();
    };

    input.addEventListener('blur', saveChanges);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            input.removeEventListener('blur', saveChanges);
            revertCell();
        }
    });
}


function getSortValue(item, key) {
    const importe = parseFloat(item['IMPORTE']) || 0;
    const pagado = parseFloat(item['PAGADO']) || 0;

    switch (key) {
        case 'FECHA': return new Date(item['FECHA']);
        case 'IMPORTE': return importe;
        case 'FECHA DE PAGO': return item['FECHA DE PAGO'] ? new Date(item['FECHA DE PAGO']) : null;
        case 'PAGADO': return pagado;
        case 'PAGADO_STATUS': return pagado > 0;
        case 'SALDO': return importe - pagado;
        case 'DIAS_VTO': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(item['FECHA']);
            return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        }
        case 'CONDICION': {
            const saldo = importe - pagado;
            if (saldo <= 0.01) return 'Pagado';
            const dueDate = new Date(item['FECHA']);
            return dueDate < new Date() ? 'Vencido' : 'A Vencer';
        }
        default:
            return (item[key] || '').toString().toLowerCase();
    }
}

function sortData(data) {
    const sortedData = [...data];
    sortedData.sort((a, b) => {
        const valA = getSortValue(a, state.sortConfig.key);
        const valB = getSortValue(b, state.sortConfig.key);

        if (valA < valB) {
            return state.sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
            return state.sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });
    return sortedData;
}

export function drawDataTable(paginatedCheques) {
    tableBody.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

    paginatedCheques.forEach(cheque => {
        const row = document.createElement('tr');
        row.dataset.id = cheque._id;

        if (state.highlightedRowId !== null && cheque._id === state.highlightedRowId) {
            row.classList.add('highlight');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedRowId(null);
        }

        const fecha = new Date(cheque['FECHA']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diasParaVto = Math.ceil((fecha - today) / (1000 * 60 * 60 * 24));

        const importe = parseFloat(cheque['IMPORTE']) || 0;
        const pagado = parseFloat(cheque['PAGADO']) || 0;
        const saldo = importe - pagado;

        if (diasParaVto >= 0 && diasParaVto <= 7 && saldo > 0.01) {
            row.classList.add('due-soon');
        }

        if (diasParaVto < 0 && saldo > 0.01) {
            row.classList.add('overdue-unpaid');
        }

        let condicion = '';
        let pillClass = '';
        if (saldo <= 0.01) {
            condicion = 'Pagado';
            pillClass = 'pill-paid';
        } else if (diasParaVto < 0) {
            condicion = 'Vencido';
            pillClass = 'pill-overdue';
        } else {
            condicion = 'A Vencer';
            pillClass = 'pill-due';
        }

        const fechaFormateada = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const importeFormateado = formatter.format(importe);
        const pagadoFormateado = formatter.format(pagado);
        const saldoFormateado = formatter.format(saldo);
        const isChecked = saldo <= 0.01;
        const fechaPago = cheque['FECHA DE PAGO'] ? new Date(cheque['FECHA DE PAGO']).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        const observacion = cheque["OBSERVACION"] || '-';
        const observacionHtml = `<div class="truncate" title="${observacion}">${observacion}</div>`;
        const ariaLabelBase = `el cheque del ${fechaFormateada}`;

        const pagadoCheckbox = `<input type="checkbox" class="payment-checkbox" data-id="${cheque._id}" ${isChecked ? 'checked' : ''} aria-label="Marcar como pagado ${ariaLabelBase}">`;
        const editBtn = `
            <button class="btn-icon edit-btn" data-id="${cheque._id}" aria-label="Editar ${ariaLabelBase}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>`;

        row.innerHTML = `
            <td class="editable-cell" data-key="FECHA">${fechaFormateada}</td>
            <td class="days-to-due">${diasParaVto}</td>
            <td class="editable-cell" data-key="BANCO">${cheque['BANCO'] || '-'}</td>
            <td class="editable-cell" data-key="N° CHEQUE">${cheque["N° CHEQUE"] || '-'}</td>
            <td>${observacionHtml}</td>
            <td class="text-right editable-cell" data-key="IMPORTE">${importeFormateado}</td>
            <td class="text-right">${pagadoFormateado}</td>
            <td class="text-right">${saldoFormateado}</td>
            <td>${fechaPago}</td>
            <td><span class="condition-pill ${pillClass}">${condicion}</span></td>
            <td class="action-cell">${pagadoCheckbox}${editBtn}</td>
        `;
        tableBody.appendChild(row);
    });
}

function setupPaginationControls(fullData) {
    paginationContainer.innerHTML = '';
    const pageCount = Math.ceil(fullData.length / state.rowsPerPage);

    if (pageCount <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.disabled = state.currentPage === 1;
    prevButton.addEventListener('click', () => {
        setCurrentPage(state.currentPage - 1);
        displayTablePage(fullData);
    });

    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${state.currentPage} de ${pageCount}`;

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente';
    nextButton.disabled = state.currentPage === pageCount;
    nextButton.addEventListener('click', () => {
        setCurrentPage(state.currentPage + 1);
        displayTablePage(fullData);
    });

    paginationContainer.append(prevButton, pageIndicator, nextButton);
}

export function displayTablePage(data) {
    document.querySelectorAll('#data-table thead th[data-sort-key]').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.sortKey === state.sortConfig.key) {
            th.classList.add(state.sortConfig.direction === 'ascending' ? 'sorted-asc' : 'sorted-desc');
        }
    });

    const startIndex = (state.currentPage - 1) * state.rowsPerPage;
    const endIndex = startIndex + state.rowsPerPage;
    const paginatedItems = data.slice(startIndex, endIndex);

    if (data.length > 0) {
        const startItem = startIndex + 1;
        const endItem = Math.min(endIndex, data.length);
        const totalSaldo = data.reduce((sum, cheque) => sum + ((parseFloat(cheque['IMPORTE']) || 0) - (parseFloat(cheque['PAGADO']) || 0)), 0);
        summaryEl.textContent = `Mostrando ${startItem}-${endItem} de ${data.length} cheques (Saldo pendiente: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalSaldo)})`;
    } else {
        summaryEl.textContent = 'No se encontraron cheques con los filtros aplicados.';
    }

    drawDataTable(paginatedItems);
    setupPaginationControls(data);
}

export function setupTableInteractions(callback) {
    updateCallback = callback;
    tableBody.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('payment-checkbox')) {
            const checkId = parseInt(target.dataset.id, 10);
            const payload = {
                action: 'updatePayment',
                id: checkId,
                isPaid: target.checked
            };
            const result = await sendUpdateToAPI(payload);
            if (result) {
                const checkToUpdate = state.allData.find(c => c._id === checkId);
                if (checkToUpdate) {
                    checkToUpdate['PAGADO'] = target.checked ? checkToUpdate['IMPORTE'] : 0;
                    checkToUpdate['FECHA DE PAGO'] = target.checked ? new Date().toISOString() : null;
                }
                showToast('Estado del cheque actualizado.', 'success');
                setHighlightedRowId(checkId);
                updateCallback();
            }
        }

        const editButton = target.closest('.edit-btn');
        if (editButton) {
            const checkId = parseInt(editButton.dataset.id, 10);
            const checkToEdit = state.allData.find(c => c._id === checkId);
            if (checkToEdit) openEditModal(checkToEdit);
            return;
        }

        const editableCell = target.closest('td.editable-cell');
        if (editableCell) {
            const row = editableCell.closest('tr');
            const checkId = parseInt(row.dataset.id, 10);
            const check = state.allData.find(c => c._id === checkId);
            const key = editableCell.dataset.key;
            if (check && key) {
                createInlineEditor(editableCell, checkId, check[key]);
            }
        }
    });

    tableBody.addEventListener('dblclick', (event) => {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.id) return;

        const checkId = parseInt(row.dataset.id, 10);
        const checkToEdit = state.allData.find(c => c._id === checkId);
        if (checkToEdit) {
            openEditModal(checkToEdit);
        }
    });

    document.querySelectorAll('#data-table thead th[data-sort-key]').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const sortKey = headerCell.dataset.sortKey;
            let direction = 'ascending';
            if (state.sortConfig.key === sortKey && state.sortConfig.direction === 'ascending') {
                direction = 'descending';
            }
            setSortConfig(sortKey, direction);
            const filteredData = applyFilters(state.allData);
            displayTablePage(sortData(filteredData));
        });
    });
}
