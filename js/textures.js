// Módulo de generación de texturas procedurales
import * as THREE from 'three';
import { CONFIG, DERIVED, getDistrictConfig } from './config.js';

export class TextureManager {
    constructor() {
        this.textureCache = new Map();
    }

    // Crear textura de edificio según el tipo
    createBuildingTexture(type, options = {}) {
        const cacheKey = `${type}_${JSON.stringify(options)}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const size = CONFIG.textureSize;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        let baseColor = options.color || '#888';

        // Texturas de ladrillo
        if (type === 'brick' || type === 'brick_tan') {
            baseColor = options.color || (type === 'brick_tan' ? '#D2B48C' : '#b22222');
            context.fillStyle = baseColor;
            context.fillRect(0, 0, size, size);
            context.strokeStyle = options.mortarColor || '#888';
            context.lineWidth = 2;

            // Líneas horizontales
            for (let y = 0; y < size; y += 16) {
                context.beginPath();
                context.moveTo(0, y);
                context.lineTo(size, y);
                context.stroke();
            }

            // Líneas verticales (escalonadas)
            for (let x = 0; x < size; x += 32) {
                for (let y = 0; y < size; y += 16) {
                    context.beginPath();
                    context.moveTo(x + (y % 32 === 0 ? 0 : 16), y);
                    context.lineTo(x + (y % 32 === 0 ? 0 : 16), y + 16);
                    context.stroke();
                }
            }
        }
        // Texturas de vidrio
        else if (type === 'glass' || type === 'glass_dark') {
            baseColor = options.color || (type === 'glass_dark' ? '#556677' : '#add8e6');
            context.fillStyle = baseColor;
            context.fillRect(0, 0, size, size);
            context.strokeStyle = options.frameColor || '#444';
            context.lineWidth = 4;

            const divisions = 4;
            for (let i = 0; i <= divisions; i++) {
                context.beginPath();
                // Líneas verticales
                context.moveTo(i * size / divisions, 0);
                context.lineTo(i * size / divisions, size);
                // Líneas horizontales
                context.moveTo(0, i * size / divisions);
                context.lineTo(size, i * size / divisions);
                context.stroke();
            }

            // Agregar reflejo sutil para vidrio oscuro
            if (type === 'glass_dark') {
                const gradient = context.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
                context.fillStyle = gradient;
                context.fillRect(0, 0, size, size);
            }
        }
        // Textura de estuco
        else if (type === 'stucco') {
            baseColor = options.color || '#F5F5DC';
            context.fillStyle = baseColor;
            context.fillRect(0, 0, size, size);

            // Agregar ruido para efecto de estuco
            context.fillStyle = 'rgba(0, 0, 0, 0.1)';
            for (let i = 0; i < 3000; i++) {
                context.fillRect(
                    Math.random() * size,
                    Math.random() * size,
                    Math.random() * 2,
                    Math.random() * 2
                );
            }
        }
        // Textura de concreto (por defecto)
        else {
            baseColor = options.color || '#888';
            context.fillStyle = baseColor;
            context.fillRect(0, 0, size, size);

            // Agregar ruido
            context.fillStyle = 'rgba(0, 0, 0, 0.05)';
            for (let i = 0; i < 1000; i++) {
                context.fillRect(Math.random() * size, Math.random() * size, 1, 1);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        const repeatFactor = (type.includes('glass')) ? 2 : 4;
        texture.repeat.set(repeatFactor, repeatFactor * 2);

        this.textureCache.set(cacheKey, texture);
        return texture;
    }

    createBuildingLightMap(type, options = {}) {
        const cacheKey = `light_${type}_${JSON.stringify(options)}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const size = CONFIG.textureSize;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        context.fillStyle = '#000000';
        context.fillRect(0, 0, size, size);

        const columns = type.includes('glass') ? 6 : 5;
        const rows = type.includes('glass') ? 10 : 8;
        const litChance = options.litChance ?? (type.includes('glass') ? 0.45 : 0.28);
        const glowColor = options.glowColor || '#f9d28b';
        const margin = 6;
        const cellWidth = (size - margin * 2) / columns;
        const cellHeight = (size - margin * 2) / rows;

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                if (Math.random() > litChance) {
                    continue;
                }

                const x = margin + column * cellWidth + cellWidth * 0.18;
                const y = margin + row * cellHeight + cellHeight * 0.15;
                const width = cellWidth * 0.64;
                const height = cellHeight * 0.54;

                context.fillStyle = glowColor;
                context.fillRect(x, y, width, height);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(type.includes('glass') ? 2 : 4, type.includes('glass') ? 4 : 6);

        this.textureCache.set(cacheKey, texture);
        return texture;
    }

    // Crear textura del terreno basada en la cuadrícula de la ciudad
    createGroundTexture(cityGrid) {
        const canvas = document.createElement('canvas');
        const texSize = 1024;
        canvas.width = texSize;
        canvas.height = texSize;
        const context = canvas.getContext('2d');

        const scaleFactor = texSize / CONFIG.citySize;
        const plotStepTex = DERIVED.plotStep * scaleFactor;
        const buildingPlotTex = CONFIG.buildingPlotSize * scaleFactor;
        const pavementTex = CONFIG.pavementWidth * scaleFactor;

        // Color base de las carreteras
        context.fillStyle = '#383838';
        context.fillRect(0, 0, texSize, texSize);

        // Dibujar celdas de la cuadrícula
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const cellX = i * plotStepTex;
                const cellY = j * plotStepTex;

                const plot = cityGrid[i][j];

                if (plot.type === 'building' || plot.type === 'park' || plot.type === 'plaza') {
                    // Dibujar acera alrededor del lote
                    context.fillStyle = '#a0a0a0';
                    context.fillRect(cellX, cellY, plotStepTex, plotStepTex);

                    // Dibujar área base del edificio/parque
                    const districtColor = getDistrictConfig(plot.district).groundColor;
                    let baseColor = districtColor;

                    if (plot.type === 'park') {
                        baseColor = '#5f8a57';
                    } else if (plot.type === 'plaza') {
                        baseColor = '#9d9584';
                    }

                    context.fillStyle = baseColor;
                    context.fillRect(
                        cellX + pavementTex,
                        cellY + pavementTex,
                        buildingPlotTex,
                        buildingPlotTex
                    );
                } else {
                    context.fillStyle = plot.roadType === 'avenue' ? '#323232' : '#3e3e3e';
                    context.fillRect(cellX, cellY, plotStepTex, plotStepTex);

                    context.strokeStyle = plot.roadType === 'avenue' ? '#d8c88c' : '#c0c0c0';
                    context.lineWidth = Math.max(1, pavementTex / 10);
                    context.setLineDash([pavementTex / 2, pavementTex / 2]);

                    const isRoadRight = (i < DERIVED.gridSize - 1) && cityGrid[i + 1][j].type === 'road';
                    const isRoadDown = (j < DERIVED.gridSize - 1) && cityGrid[i][j + 1].type === 'road';

                    if (isRoadRight) {
                        context.beginPath();
                        context.moveTo(cellX + plotStepTex / 2, cellY + plotStepTex / 2);
                        context.lineTo(cellX + plotStepTex, cellY + plotStepTex / 2);
                        context.stroke();
                    }
                    if (isRoadDown) {
                        context.beginPath();
                        context.moveTo(cellX + plotStepTex / 2, cellY + plotStepTex / 2);
                        context.lineTo(cellX + plotStepTex / 2, cellY + plotStepTex);
                        context.stroke();
                    }
                    context.setLineDash([]);

                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Limpiar caché de texturas
    dispose() {
        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
    }
}