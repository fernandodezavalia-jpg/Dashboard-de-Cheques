// src/api/sheet.js
import { showToast } from '../utils/ui.js';

const API_URL = 'https://script.google.com/macros/s/AKfycbz4JTJqhqh_mugxBVHwB3lxb18hFd6QJeD4IdjM5aZ3ohUoZCeTnvic26QJ2mAAnUQSeQ/exec';

/**
 * Obtiene los datos de la hoja de cálculo de Google.
 * @returns {Promise<Array|null>} Una promesa que se resuelve con los datos o null si hay un error.
 */
export async function fetchData() {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('cache_bust', new Date().getTime());
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();

        data = data.filter(item => {
            const hasDate = item['FECHA'] && !isNaN(new Date(item['FECHA']).getTime());
            const hasAmount = item['IMPORTE'] !== undefined && item['IMPORTE'] !== null && item['IMPORTE'] !== '';
            return hasDate && hasAmount;
        });

        data.forEach((item, index) => item._id = index);
        return data;
    } catch (error) {
        console.error('Error al conectar con la API:', error);
        document.body.innerHTML = `<div style="text-align: center; padding: 50px;"><h1>Error de Conexión</h1><p>No se pudo cargar los datos. Verifica la URL de la API y tu conexión a internet.</p></div>`;
        return null;
    }
}

/**
 * Envía actualizaciones (añadir, editar, eliminar) a la hoja de cálculo de Google.
 * @param {object} payload - El objeto de datos a enviar.
 * @returns {Promise<object|null>} Una promesa que se resuelve con el resultado de la API o null si hay un error.
 */
export async function sendUpdateToAPI(payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        if (!response.ok) {
            throw new Error(`Error en la respuesta de la API: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'La API devolvió un error no especificado.');
        }
        return result;
    } catch (error) {
        console.error('Error al enviar actualización a la API:', error);
        showToast(`Error de comunicación: ${error.message}`, 'error');
        return null;
    }
}
