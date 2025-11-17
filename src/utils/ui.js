// src/utils/ui.js

/**
 * Muestra una notificación "Toast" en la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - El tipo de notificación ('success' o 'error').
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✔' : '✖';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/**
 * Genera una paleta de colores armoniosa (monocromática) para los gráficos.
 * @param {number} count - El número de colores a generar.
 * @param {number} baseHue - El tono base (0-360) para la paleta de colores.
 * @returns {string[]} Un array de colores en formato HSL.
 */
export function generateHarmoniousColors(count, baseHue) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const lightness = 85 - (i * (50 / (count || 1)));
        colors.push(`hsl(${baseHue}, 70%, ${lightness}%)`);
    }
    return colors;
}
