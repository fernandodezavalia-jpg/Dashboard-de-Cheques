// src/utils/actions.js
import { state } from './state.js';
import { applyFilters } from './filters.js';
import { showToast } from './ui.js';

function sortData(data) {
    // This is a simplified sort for the CSV export.
    // The main table sort is more complex and lives in table.js
    return data.sort((a, b) => new Date(b['FECHA']) - new Date(a['FECHA']));
}


export function exportToCSV() {
    const filteredData = applyFilters(state.allData);
    if (filteredData.length === 0) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }

    const headers = [
        "Fecha de Cheque", "Días P/Vencimiento", "Banco", "Cheque N°", "Observaciones",
        "Importe", "Pagado", "Saldo", "Fecha de Pago", "Condición"
    ];

    const csvRows = [headers.join(',')];
    const sortedData = sortData(filteredData);

    sortedData.forEach(cheque => {
        const fecha = new Date(cheque['FECHA']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diasParaVto = Math.ceil((fecha - today) / (1000 * 60 * 60 * 24));
        const importe = parseFloat(cheque['IMPORTE']) || 0;
        const pagado = parseFloat(cheque['PAGADO']) || 0;
        const saldo = importe - pagado;

        let condicion = '';
        if (saldo <= 0.01) {
            condicion = 'Pagado';
        } else if (diasParaVto < 0) {
            condicion = 'Vencido';
        } else {
            condicion = 'A Vencer';
        }

        const fechaFormateada = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const fechaPagoFormateada = cheque['FECHA DE PAGO'] ? new Date(cheque['FECHA DE PAGO']).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        const observacion = `"${(cheque['OBSERVACION'] || '').replace(/"/g, '""')}"`;

        const row = [
            fechaFormateada,
            diasParaVto,
            cheque['BANCO'] || '',
            cheque['N° CHEQUE'] || '',
            observacion,
            importe.toFixed(2),
            pagado.toFixed(2),
            saldo.toFixed(2),
            fechaPagoFormateada,
            condicion
        ].join(',');
        csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'reporte_cheques.csv');
    a.click();
}

export function setupActionButtons() {
    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
}
