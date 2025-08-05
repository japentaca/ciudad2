// Módulo de generación de edificios
import * as THREE from 'three';
import { CONFIG, DERIVED } from './config.js';
import { TextureManager } from './textures.js';

export class BuildingManager {
    constructor(scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.buildingMeshes = {};
        this.population = 0;
        this.buildingTypes = [
            { key: 'concrete', style: 'modern', color: 0xc0c0c0 },
            { key: 'brick', style: 'traditional', color: 0xcc8855 },
            { key: 'glass', style: 'office', color: 0xeeeeff },
            { key: 'brick_tan', style: 'residential', color: 0xE0CFAF },
            { key: 'glass_dark', style: 'skyscraper', color: 0xAAAAEE },
            { key: 'stucco', style: 'commercial', color: 0xFFFFE0 }
        ];
    }

    createBuildings(cityGrid) {
        this.clearBuildings();
        this.population = 0;

        const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
        baseGeometry.translate(0, 0.5, 0); // Mover origen a la base

        const maxInstancesPerType = DERIVED.gridSize * DERIVED.gridSize;
        const instanceCounts = {};

        // Crear materiales y InstancedMesh para cada tipo de edificio
        this.buildingTypes.forEach(type => {
            const texture = this.textureManager.createBuildingTexture(type.key);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                color: type.color,
                roughness: 0.8,
                metalness: 0.1
            });
            
            const mesh = new THREE.InstancedMesh(baseGeometry, material, maxInstancesPerType);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.buildingMeshes[type.key] = mesh;
            instanceCounts[type.key] = 0;
            this.scene.add(mesh);
        });

        const dummy = new THREE.Object3D();

        // Recorrer la cuadrícula para asignar edificios
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                if (cityGrid[i][j].type === 'building') {
                    const plot = cityGrid[i][j];
                    const height = THREE.MathUtils.randInt(5, 30) * 5;
                    const width = CONFIG.buildingPlotSize * THREE.MathUtils.randFloat(0.8, 1.0);
                    const depth = CONFIG.buildingPlotSize * THREE.MathUtils.randFloat(0.8, 1.0);

                    dummy.position.set(plot.x, 0, plot.z);
                    dummy.scale.set(width, height, depth);
                    dummy.updateMatrix();

                    // Seleccionar tipo de edificio aleatoriamente
                    const typeIndex = THREE.MathUtils.randInt(0, this.buildingTypes.length - 1);
                    const selectedType = this.buildingTypes[typeIndex];
                    const meshKey = selectedType.key;

                    // Agregar instancia al InstancedMesh correspondiente
                    if (this.buildingMeshes[meshKey] && instanceCounts[meshKey] < maxInstancesPerType) {
                        const currentCount = instanceCounts[meshKey];
                        this.buildingMeshes[meshKey].setMatrixAt(currentCount, dummy.matrix);
                        instanceCounts[meshKey]++;
                    }

                    // Agregar a la estimación de población
                    this.population += Math.floor(height * width * depth / 500);
                }
            }
        }

        // Actualizar conteos y matrices de instancia para todos los meshes
        for (const key in this.buildingMeshes) {
            this.buildingMeshes[key].count = instanceCounts[key];
            this.buildingMeshes[key].instanceMatrix.needsUpdate = true;
        }
    }

    clearBuildings() {
        // Remover edificios existentes
        for (const key in this.buildingMeshes) {
            const mesh = this.buildingMeshes[key];
            if (mesh) {
                this.scene.remove(mesh);
                mesh.material.dispose();
            }
        }
        this.buildingMeshes = {};
        this.population = 0;
    }

    getPopulation() {
        return this.population;
    }

    dispose() {
        this.clearBuildings();
        this.textureManager.dispose();
    }
}