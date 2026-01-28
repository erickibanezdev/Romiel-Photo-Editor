import { analytics } from './analytics.js';

declare var fx: any;

const controlsConfig = {
    'LUZ': [
        { name: 'Exposición', uniform: 'brightness', min: -1, max: 1, value: 0 },
        { name: 'Contraste', uniform: 'contrast', min: -1, max: 1, value: 0 },
        { name: 'Resaltados', uniform: 'highlights', min: -1, max: 1, value: 0 },
        { name: 'Sombras', uniform: 'shadows', min: -1, max: 1, value: 0 },
    ],
    'COLOR': [
        { name: 'Temperatura', uniform: 'temperature', min: -1, max: 1, value: 0, custom: true },
        { name: 'Saturación', uniform: 'saturation', min: -1, max: 1, value: 0 },
    ],
    'EFECTOS': [
        { name: 'Viñeta', uniform: 'vignette', min: 0, max: 1, value: 0 },
        { name: 'Grano', uniform: 'noise', min: 0, max: 0.5, value: 0 },
    ],
    'DETALLES': [
        { name: 'Agudizado', uniform: 'unsharpMask', min: 0, max: 2, value: 0 },
    ]
};

let canvas: HTMLCanvasElement;
let glCanvas: any;
let texture: any;
let originalImage: HTMLImageElement;
const editorState: { [key: string]: number } = {};
let currentZoom = 1.0;

document.addEventListener('DOMContentLoaded', () => {
    const imageLoader = document.getElementById('image-loader') as HTMLInputElement;
    const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
    const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;
    const downloadButton = document.getElementById('download-button') as HTMLButtonElement;
    const zoomInButton = document.getElementById('zoom-in-button') as HTMLButtonElement;
    const zoomOutButton = document.getElementById('zoom-out-button') as HTMLButtonElement;
    const fitScreenButton = document.getElementById('fit-screen-button') as HTMLButtonElement;
    const canvasWrapper = document.getElementById('canvas-wrapper') as HTMLDivElement;
    
    imageLoader.addEventListener('change', handleImageUpload);
    resetButton.addEventListener('click', resetAll);
    themeToggle.addEventListener('change', handleThemeToggle);
    downloadButton.addEventListener('click', handleDownload);
    zoomInButton.addEventListener('click', () => updateZoom(1.25));
    zoomOutButton.addEventListener('click', () => updateZoom(0.8));
    fitScreenButton.addEventListener('click', () => {
        currentZoom = 1.0;
        applyZoom();
    });

    canvasWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        updateZoom(zoomFactor);
    }, { passive: false });
    
    themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'dark';
    generateControls();
    
    analytics.startSession();
});

function handleImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        originalImage = new Image();
        originalImage.onload = () => {
            document.getElementById('placeholder')?.setAttribute('hidden', 'true');
            document.getElementById('editor-canvas')?.removeAttribute('hidden');
            document.getElementById('zoom-controls')?.removeAttribute('hidden');
            
            initializeCanvas(originalImage);
            resetAll();
        };
        originalImage.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    analytics.trackEvent('Image', 'Upload');
}

function applyZoom(): void {
    if (!glCanvas) return;
    glCanvas.style.transform = `scale(${currentZoom})`;
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
        zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }
}

function updateZoom(factor: number): void {
    currentZoom *= factor;
    currentZoom = Math.max(0.1, Math.min(currentZoom, 10));
    applyZoom();
}

function fitImageToScreen(): void {
    if (!originalImage) return;
    const wrapper = document.getElementById('canvas-wrapper')!;
    
    const scaleX = wrapper.clientWidth / originalImage.width;
    const scaleY = wrapper.clientHeight / originalImage.height;
    currentZoom = Math.min(scaleX, scaleY);
    applyZoom();
}

function initializeCanvas(image: HTMLImageElement): void {
    try {
        if (glCanvas) {
            glCanvas.parentNode.removeChild(glCanvas);
        }
        canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
        
        const wrapper = document.getElementById('canvas-wrapper')!;
        const scaleX = wrapper.clientWidth / image.width;
        const scaleY = wrapper.clientHeight / image.height;
        const scale = Math.min(scaleX, scaleY);
        const fittedWidth = image.width * scale;
        const fittedHeight = image.height * scale;

        glCanvas = fx.canvas();
        texture = glCanvas.texture(image);
        glCanvas.draw(texture).update();

        glCanvas.style.width = `${fittedWidth}px`;
        glCanvas.style.height = `${fittedHeight}px`;

        canvas.parentNode?.replaceChild(glCanvas, canvas);
        canvas = glCanvas;
        glCanvas.id = 'editor-canvas';
        currentZoom = 1.0;
        applyZoom();

    } catch (e) {
        alert('Error: No se pudo inicializar WebGL.');
        console.error(e);
    }
}

function applyFilterChain(canvasInstance: any, textureInstance: any, state: { [key: string]: number }): void {
    let currentCanvas = canvasInstance.draw(textureInstance);
    currentCanvas.brightnessContrast(state['Exposición'] ?? 0, state['Contraste'] ?? 0)
                 .hueSaturation(0, state['Saturación'] ?? 0)
                 .unsharpMask(state['Agudizado'] ?? 0, 1)
                 .vignette(0.5, state['Viñeta'] ?? 0)
                 .noise(state['Grano'] ?? 0);
    const highlights = state['Resaltados'] ?? 0;
    const shadows = state['Sombras'] ?? 0;
    if (highlights !== 0 || shadows !== 0) {
        currentCanvas.curves([[0, shadows], [1, 1 + highlights]], [[0, shadows], [1, 1 + highlights]], [[0, shadows], [1, 1 + highlights]]);
    }
    const temp = state['Temperatura'] ?? 0;
    if (temp !== 0) {
        currentCanvas.curves([[0, 0], [1, 1 + (temp > 0 ? temp : 0)]], [[0, 0], [1, 1]], [[0, 0], [1, 1 + (temp < 0 ? -temp : 0)]]);
    }
    currentCanvas.update();
}

function renderRealtimePreview(): void {
    if (!glCanvas || !texture) return;
    applyFilterChain(glCanvas, texture, editorState);
}

function generateControls(): void {
    const panel = document.getElementById('controls-panel')!;
    panel.innerHTML = '';
    
    for (const groupName in controlsConfig) {
        const details = document.createElement('details');
        details.open = groupName === 'LUZ';

        const summary = document.createElement('summary');
        const title = document.createElement('strong');
        title.textContent = groupName;
        
        const resetGroupBtn = document.createElement('button');
        resetGroupBtn.textContent = 'Reset';
        resetGroupBtn.className = 'reset-group outline contrast';
        resetGroupBtn.onclick = (e) => {
            e.preventDefault();
            resetSection(groupName);
        };

        summary.appendChild(title);
        summary.appendChild(resetGroupBtn);
        details.appendChild(summary);

        const groupConfig = controlsConfig[groupName as keyof typeof controlsConfig];
        groupConfig.forEach(control => {
            editorState[control.name] = control.value;
            
            const controlDiv = document.createElement('div');
            controlDiv.className = 'slider-control';
            
            const label = document.createElement('label');
            label.setAttribute('for', `slider-${control.name}`);
            label.innerHTML = `${control.name} <span id="value-${control.name}">${control.value.toFixed(2)}</span>`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = `slider-${control.name}`;
            slider.min = String(control.min);
            slider.max = String(control.max);
            slider.value = String(control.value);
            slider.step = '0.01';

            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                editorState[control.name] = value;
                document.getElementById(`value-${control.name}`)!.textContent = value.toFixed(2);
                requestAnimationFrame(renderRealtimePreview);
            });

            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                editorState[control.name] = value;
                document.getElementById(`value-${control.name}`)!.textContent = value.toFixed(2);
                requestAnimationFrame(renderRealtimePreview);
            });
            
            // Debounce analytics tracking
            let timer: any;
            slider.addEventListener('change', () => {
                analytics.trackEvent('Control', 'Adjust', control.name);
            });

            controlDiv.appendChild(label);
            controlDiv.appendChild(slider);
            details.appendChild(controlDiv);
        });

        panel.appendChild(details);
    }
}

function handleThemeToggle(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    document.documentElement.setAttribute('data-theme', isChecked ? 'dark' : 'light');
    analytics.trackEvent('UI', 'ThemeToggle', isChecked ? 'dark' : 'light');
}

function resetSection(groupName: string): void {
    if (!originalImage) return;
    const groupConfig = controlsConfig[groupName as keyof typeof controlsConfig];
    groupConfig.forEach(control => {
        editorState[control.name] = control.value;
        const slider = document.getElementById(`slider-${control.name}`) as HTMLInputElement;
        const valueLabel = document.getElementById(`value-${control.name}`);
        if(slider) slider.value = String(control.value);
        if(valueLabel) valueLabel.textContent = control.value.toFixed(2);
    });
    renderRealtimePreview();
}

function resetAll(): void {
    analytics.trackEvent('UI', 'ResetAll');
    if (!originalImage) return;
    generateControls();
    renderRealtimePreview();
}

function handleDownload(): void {
    if (!originalImage) {
        alert("Por favor, carga una imagen primero.");
        return;
    }
    const downloadCanvas = fx.canvas();
    downloadCanvas.width = originalImage.width;
    downloadCanvas.height = originalImage.height;
    const downloadTexture = downloadCanvas.texture(originalImage);
    applyFilterChain(downloadCanvas, downloadTexture, editorState);
    const link = document.createElement('a');
    link.download = 'romiel-edit.jpg';
    link.href = downloadCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
    analytics.trackEvent('Image', 'Download');
}