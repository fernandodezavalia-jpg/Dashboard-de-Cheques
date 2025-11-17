// src/components/modal.js
import { state, setAllData, setHighlightedRowId } from '../utils/state.js';
import { sendUpdateToAPI, fetchData } from '../api/sheet.js';
import { showToast } from '../utils/ui.js';

let updateCallback;

const modal = document.getElementById('new-check-modal');
const form = document.getElementById('new-check-form');
const deleteBtn = document.getElementById('modal-delete-btn');
const cancelBtn = document.getElementById('modal-cancel-btn');
const saveBtn = document.getElementById('modal-save-btn');
const modalTitle = document.getElementById('modal-title');
const checkIdInput = document.getElementById('form-check-id');

function validateField(field) {
    const errorDiv = field.nextElementSibling;
    let isValid = true;
    if (field.required && !field.value.trim()) {
        errorDiv.textContent = 'Este campo es obligatorio.';
        errorDiv.style.display = 'block';
        isValid = false;
    } else if (field.type === 'number' && (parseFloat(field.value) <= 0 || isNaN(parseFloat(field.value)))) {
        errorDiv.textContent = 'El importe debe ser un número positivo.';
        errorDiv.style.display = 'block';
        isValid = false;
    } else {
        errorDiv.style.display = 'none';
    }
    return isValid;
}

function validateForm() {
    let isFormValid = true;
    form.querySelectorAll('input[required], input[type="number"]').forEach(field => {
        if (!validateField(field)) isFormValid = false;
    });
    saveBtn.disabled = !isFormValid;
    return isFormValid;
}

function populateModalDatalists() {
    const bankList = document.getElementById('bank-list');
    bankList.innerHTML = '';
    const banks = [...new Set(state.allData.map(item => item['BANCO']).filter(Boolean))].sort();
    banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank;
        bankList.appendChild(option);
    });
}

export function openEditModal(check) {
    form.reset();
    modalTitle.textContent = 'Editar Cheque';
    checkIdInput.value = check._id;

    document.getElementById('form-fecha').value = new Date(check['FECHA']).toISOString().split('T')[0];
    document.getElementById('form-importe').value = check['IMPORTE'];
    document.getElementById('form-banco').value = check['BANCO'] || '';
    document.getElementById('form-cheque-nro').value = check['N° CHEQUE'] || '';
    document.getElementById('form-observacion').value = check['OBSERVACION'] || '';

    deleteBtn.style.display = 'block';
    modal.classList.add('visible');

    populateModalDatalists();
    validateForm();
}

function closeModal() {
    modal.classList.remove('visible');
}

export function setupModalInteractions(callback) {
    updateCallback = callback;
    const openBtn = document.getElementById('new-check-btn');

    openBtn.addEventListener('click', () => {
        form.reset();
        modalTitle.textContent = 'Añadir Nuevo Cheque';
        deleteBtn.style.display = 'none';
        checkIdInput.value = '';
        form.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
        modal.classList.add('visible');
        populateModalDatalists();
        validateForm();
    });

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());

    form.addEventListener('input', (e) => {
        validateField(e.target);
        validateForm();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        const checkId = checkIdInput.value;
        const isEditing = checkId !== '';

        const payload = {
            action: isEditing ? 'editCheck' : 'addCheck',
            id: isEditing ? parseInt(checkId, 10) : undefined
        };
        new FormData(form).forEach((value, key) => payload[key] = value);

        const result = await sendUpdateToAPI(payload);
        if (result) {
            closeModal();
            showToast(isEditing ? 'Cheque actualizado.' : 'Cheque añadido.', 'success');

            if (!isEditing) {
                setHighlightedRowId(state.allData.length);
            } else {
                setHighlightedRowId(parseInt(checkId, 10));
            }

            const newData = await fetchData();
            setAllData(newData);
            updateCallback();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cheque';
    });

    deleteBtn.addEventListener('click', async () => {
        const checkId = checkIdInput.value;
        if (!checkId) return;

        if (confirm('¿Estás seguro de que quieres eliminar este cheque?')) {
            const payload = { action: 'deleteCheck', id: parseInt(checkId, 10) };
            const result = await sendUpdateToAPI(payload);
            if (result) {
                closeModal();
                showToast('Cheque eliminado.', 'success');
                const newData = await fetchData();
                setAllData(newData);
                updateCallback();
            }
        }
    });
}
