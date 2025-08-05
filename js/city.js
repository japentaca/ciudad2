// Módulo de generación de ciudad
import * as THREE from 'three';
import { CONFIG, DERIVED } from './config.js';
import { TextureManager } from './textures.js';

export class CityManager {
    constructor(scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.cityGrid = [];
        this.groundPlane = null;
        this.sidewalkInstances = null;
        this.parks = [];
    }

    generateCityLayout() {
        this.clearCity();
        this.cityGrid = [];

        const blockWidth = 4; // Número de lotes de ancho para un bloque
        const blockHeight = 4; // Número de lotes de alto para un bloque

        // Layout de cuadrícula basado en bloques
        for (let i = 0; i < DERIVED.gridSize; i++) {
            this.cityGrid[i] = [];
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const x = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + i * DERIVED.plotStep;
                const z = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + j * DERIVED.plotStep;

                // Determinar si el lote está en un límite de bloque (carretera)
                const isRoad = (i % blockWidth === 0) || (j % blockHeight === 0);

                if (isRoad) {
                    this.cityGrid[i][j] = { type: 'road', x, z };
                } else {
                    // Dentro de un bloque - principalmente edificios, parque ocasional
                    const plotType = Math.random();
                    if (plotType < 0.1) { // 10% de probabilidad de parque dentro del bloque
                        this.cityGrid[i][j] = { type: 'park', x, z };
                    } else { // 90% de probabilidad de edificio dentro del bloque
                        this.cityGrid[i][j] = { type: 'building', x, z };
                    }
                }
            }
        }

        this.createGround();
        this.createInfrastructure();
        
        return this.cityGrid;
    }

    createGround() {
        // Crear material del terreno
        const groundTexture = this.textureManager.createGroundTexture(this.cityGrid);
        const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(CONFIG.citySize, CONFIG.citySize);
        
        this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    createInfrastructure() {
        this.createSidewalks();
        this.createParks();
    }

    createSidewalks() {
        const sidewalkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x999999, 
            roughness: 0.9 
        });
        const sidewalkGeometry = new THREE.BoxGeometry(1, 1, 1);
        sidewalkGeometry.translate(0, 0.5, 0); // Origen en el centro inferior
        
        const maxSidewalks = DERIVED.gridSize * DERIVED.gridSize * 4;
        this.sidewalkInstances = new THREE.InstancedMesh(sidewalkGeometry, sidewalkMaterial, maxSidewalks);
        this.sidewalkInstances.castShadow = false;
        this.sidewalkInstances.receiveShadow = true;
        this.scene.add(this.sidewalkInstances);
        
        let sidewalkCount = 0;
        const dummySidewalk = new THREE.Object3D();
        const halfPlotStep = DERIVED.plotStep / 2;
        const halfPavementWidth = CONFIG.pavementWidth / 2;

        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                
                if (plot.type === 'building' || plot.type === 'park') {
                    // Verificar vecino arriba (+Z)
                    if (j < DERIVED.gridSize - 1 && this.cityGrid[i][j + 1].type === 'road') {
                        dummySidewalk.position.set(
                            plot.x, 
                            CONFIG.sidewalkHeight / 2, 
                            plot.z + halfPlotStep - halfPavementWidth
                        );
                        dummySidewalk.scale.set(DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth);
                        dummySidewalk.updateMatrix();
                        if (sidewalkCount < maxSidewalks) {
                            this.sidewalkInstances.setMatrixAt(sidewalkCount++, dummySidewalk.matrix);
                        }
                    }
                    
                    // Verificar vecino abajo (-Z)
                    if (j > 0 && this.cityGrid[i][j - 1].type === 'road') {
                        dummySidewalk.position.set(
                            plot.x, 
                            CONFIG.sidewalkHeight / 2, 
                            plot.z - halfPlotStep + halfPavementWidth
                        );
                        dummySidewalk.scale.set(DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth);
                        dummySidewalk.updateMatrix();
                        if (sidewalkCount < maxSidewalks) {
                            this.sidewalkInstances.setMatrixAt(sidewalkCount++, dummySidewalk.matrix);
                        }
                    }
                    
                    // Verificar vecino derecha (+X)
                    if (i < DERIVED.gridSize - 1 && this.cityGrid[i + 1][j].type === 'road') {
                        dummySidewalk.position.set(
                            plot.x + halfPlotStep - halfPavementWidth, 
                            CONFIG.sidewalkHeight / 2, 
                            plot.z
                        );
                        dummySidewalk.scale.set(CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep);
                        dummySidewalk.updateMatrix();
                        if (sidewalkCount < maxSidewalks) {
                            this.sidewalkInstances.setMatrixAt(sidewalkCount++, dummySidewalk.matrix);
                        }
                    }
                    
                    // Verificar vecino izquierda (-X)
                    if (i > 0 && this.cityGrid[i - 1][j].type === 'road') {
                        dummySidewalk.position.set(
                            plot.x - halfPlotStep + halfPavementWidth, 
                            CONFIG.sidewalkHeight / 2, 
                            plot.z
                        );
                        dummySidewalk.scale.set(CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep);
                        dummySidewalk.updateMatrix();
                        if (sidewalkCount < maxSidewalks) {
                            this.sidewalkInstances.setMatrixAt(sidewalkCount++, dummySidewalk.matrix);
                        }
                    }
                }
            }
        }

        // Actualizar conteo de instancias después del bucle
        if (this.sidewalkInstances) {
            this.sidewalkInstances.count = sidewalkCount;
            this.sidewalkInstances.instanceMatrix.needsUpdate = true;
        }
    }

    createParks() {
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                
                if (plot.type === 'park') {
                    // Crear plano del parque
                    const parkGeometry = new THREE.PlaneGeometry(CONFIG.buildingPlotSize, CONFIG.buildingPlotSize);
                    const parkMaterial = new THREE.MeshStandardMaterial({ color: 0x55aa55 });
                    const parkPlane = new THREE.Mesh(parkGeometry, parkMaterial);
                    parkPlane.rotation.x = -Math.PI / 2;
                    parkPlane.position.set(plot.x, 0.1, plot.z);
                    parkPlane.receiveShadow = true;
                    this.scene.add(parkPlane);
                    this.parks.push(parkPlane);

                    // Agregar árboles simples
                    const treeCount = THREE.MathUtils.randInt(3, 8);
                    for (let t = 0; t < treeCount; t++) {
                        const tree = this.createSimpleTree();
                        const treeX = plot.x + THREE.MathUtils.randFloat(-CONFIG.buildingPlotSize / 2.5, CONFIG.buildingPlotSize / 2.5);
                        const treeZ = plot.z + THREE.MathUtils.randFloat(-CONFIG.buildingPlotSize / 2.5, CONFIG.buildingPlotSize / 2.5);
                        tree.position.set(treeX, 0, treeZ);
                        this.scene.add(tree);
                        this.parks.push(tree);
                    }
                }
            }
        }
    }

    createSimpleTree() {
        const trunkHeight = THREE.MathUtils.randFloat(4, 8);
        const leavesHeight = THREE.MathUtils.randFloat(5, 10);
        
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, trunkHeight, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Marrón
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;

        const leavesGeo = new THREE.ConeGeometry(leavesHeight / 2, leavesHeight, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Verde bosque
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = trunkHeight + leavesHeight / 2;
        leaves.castShadow = true;

        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(leaves);
        
        return tree;
    }

    clearCity() {
        // Remover terreno
        if (this.groundPlane) {
            this.scene.remove(this.groundPlane);
            this.groundPlane.geometry.dispose();
            this.groundPlane.material.dispose();
            this.groundPlane = null;
        }

        // Remover aceras
        if (this.sidewalkInstances) {
            this.scene.remove(this.sidewalkInstances);
            this.sidewalkInstances.material.dispose();
            this.sidewalkInstances = null;
        }

        // Remover parques
        this.parks.forEach(parkElement => {
            this.scene.remove(parkElement);
            if (parkElement.geometry) parkElement.geometry.dispose();
            if (parkElement.material) parkElement.material.dispose();
        });
        this.parks = [];

        this.cityGrid = [];
    }

    getCityGrid() {
        return this.cityGrid;
    }

    dispose() {
        this.clearCity();
        this.textureManager.dispose();
    }
}