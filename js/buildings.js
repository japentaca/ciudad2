// Módulo de generación de edificios
import * as THREE from 'three';
import { CONFIG, DERIVED, getBuildingProfile } from './config.js';
import { TextureManager } from './textures.js';

export class BuildingManager {
    constructor(scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.buildingMeshes = {};
        this.population = 0;
        this.baseGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.baseGeometry.translate(0, 0.5, 0);
        this.nightFactor = 0;
        this.buildingTypes = [
            { key: 'concrete', style: 'modern', color: 0xc0c0c0, nightBoost: 0.58 },
            { key: 'brick', style: 'traditional', color: 0xcc8855, nightBoost: 0.65 },
            { key: 'glass', style: 'office', color: 0xeeeeff, nightBoost: 0.95 },
            { key: 'brick_tan', style: 'residential', color: 0xe0cfaf, nightBoost: 0.72 },
            { key: 'glass_dark', style: 'skyscraper', color: 0xaaaeee, nightBoost: 1 },
            { key: 'stucco', style: 'commercial', color: 0xffffe0, nightBoost: 0.6 }
        ];
    }

    createBuildings(cityGrid) {
        this.clearBuildings();
        this.population = 0;

        const maxInstancesPerType = DERIVED.gridSize * DERIVED.gridSize;
        const instanceCounts = {};

        // Crear materiales y InstancedMesh para cada tipo de edificio
        this.buildingTypes.forEach(type => {
            const texture = this.textureManager.createBuildingTexture(type.key);
            const emissiveMap = this.textureManager.createBuildingLightMap(type.key);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap,
                emissive: new THREE.Color(0xffe2a8),
                emissiveIntensity: 0,
                color: type.color,
                roughness: 0.8,
                metalness: 0.1
            });

            const mesh = new THREE.InstancedMesh(this.baseGeometry, material, maxInstancesPerType);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;

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
                    const districtProfile = getBuildingProfile(plot.district);
                    const floors = THREE.MathUtils.randInt(
                        districtProfile.heightRange[0],
                        districtProfile.heightRange[1]
                    );
                    const height = floors * 3.6;
                    const footprintFactor = THREE.MathUtils.randFloat(
                        districtProfile.footprintRange[0],
                        districtProfile.footprintRange[1]
                    );
                    const width = CONFIG.buildingPlotSize * footprintFactor * THREE.MathUtils.randFloat(0.9, 1);
                    const depth = CONFIG.buildingPlotSize * footprintFactor * THREE.MathUtils.randFloat(0.88, 1);

                    if (plot.isLandmark) {
                        dummy.scale.set(width * 0.86, height * 1.28, depth * 0.86);
                    } else {
                        dummy.scale.set(width, height, depth);
                    }

                    dummy.position.set(plot.x, 0, plot.z);
                    dummy.updateMatrix();

                    const allowedTypes = districtProfile.materialTypes
                        .map(key => this.buildingTypes.find(type => type.key === key))
                        .filter(Boolean);
                    const selectedType = plot.isLandmark
                        ? this.buildingTypes.find(type => type.key === 'glass_dark') || allowedTypes[0]
                        : allowedTypes[THREE.MathUtils.randInt(0, allowedTypes.length - 1)];
                    const meshKey = selectedType.key;

                    if (this.buildingMeshes[meshKey] && instanceCounts[meshKey] < maxInstancesPerType) {
                        const currentCount = instanceCounts[meshKey];
                        this.buildingMeshes[meshKey].setMatrixAt(currentCount, dummy.matrix);
                        instanceCounts[meshKey]++;
                    }

                    this.population += Math.floor(
                        (height / 3.5) * (width * depth / 700) * districtProfile.populationDensity
                    );
                }
            }
        }

        // Actualizar conteos y matrices de instancia para todos los meshes
        for (const key in this.buildingMeshes) {
            this.buildingMeshes[key].count = instanceCounts[key];
            this.buildingMeshes[key].instanceMatrix.needsUpdate = true;
        }

        this.setNightFactor(this.nightFactor);
    }

    clearBuildings() {
        // Remover edificios existentes
        for (const key in this.buildingMeshes) {
            const mesh = this.buildingMeshes[key];
            if (mesh) {
                this.scene.remove(mesh);
                if (mesh.geometry !== this.baseGeometry) {
                    mesh.geometry.dispose();
                }
                mesh.material.dispose();
            }
        }
        this.buildingMeshes = {};
        this.population = 0;
    }

    getPopulation() {
        return this.population;
    }

    setNightFactor(nightFactor) {
        this.nightFactor = nightFactor;

        this.buildingTypes.forEach(type => {
            const mesh = this.buildingMeshes[type.key];
            if (!mesh) {
                return;
            }

            mesh.material.emissiveIntensity = nightFactor * type.nightBoost;
        });
    }

    dispose() {
        this.clearBuildings();
        if (this.baseGeometry) {
            this.baseGeometry.dispose();
            this.baseGeometry = null;
        }
        this.textureManager.dispose();
    }
}