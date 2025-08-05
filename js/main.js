// Archivo principal del simulador de ciudad 3D
import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { LightingManager } from './lighting.js';
import { CityManager } from './city.js';
import { BuildingManager } from './buildings.js';
import { TrafficManager } from './traffic.js';
import { ModelLoader } from './models.js';
import { createPedestrians, updatePedestrians } from '../pedestrian_functions.js';
import { CONFIG, DERIVED } from './config.js';

export class CitySimulator {
    constructor() {
        this.sceneManager = null;
        this.lightingManager = null;
        this.cityManager = null;
        this.buildingManager = null;
        this.trafficManager = null;
        this.modelLoader = null;
        
        this.pedestrians = [];
        this.population = 0;
        this.isInitialized = false;
    }

    async init() {
        try {
            // Cargar modelos primero
            this.modelLoader = new ModelLoader();
            const models = await this.modelLoader.loadModels();
            
            // Inicializar managers
            this.sceneManager = new SceneManager();
            this.sceneManager.init();
            
            this.lightingManager = new LightingManager(this.sceneManager.scene);
            this.lightingManager.init();
            
            this.cityManager = new CityManager(this.sceneManager.scene);
            this.buildingManager = new BuildingManager(this.sceneManager.scene);
            this.trafficManager = new TrafficManager(this.sceneManager.scene);
            
            // Configurar modelos en el manager de tráfico
            this.trafficManager.setModels(models.carModel, models.truckModel);
            
            // Generar ciudad inicial
            this.generateCity();
            
            // Configurar eventos de UI
            this.setupEventListeners();
            
            // Iniciar bucle de animación
            this.animate();
            
            this.isInitialized = true;
            console.log("Simulador de ciudad inicializado correctamente");
            
        } catch (error) {
            console.error("Error inicializando el simulador:", error);
        }
    }

    generateCity() {
        // Generar layout de la ciudad
        const cityGrid = this.cityManager.generateCityLayout();
        
        // Crear edificios
        this.buildingManager.createBuildings(cityGrid);
        this.population = this.buildingManager.getPopulation();
        
        // Agregar luces de calle en intersecciones
        this.addStreetLights(cityGrid);
        
        // Crear tráfico
        this.trafficManager.createTraffic(cityGrid);
        
        // Crear peatones
        createPedestrians(
            THREE, 
            this.sceneManager.scene, 
            this.pedestrians, 
            cityGrid, 
            DERIVED.gridSize, 
            CONFIG.buildingPlotSize, 
            CONFIG.pavementWidth
        );
        
        // Actualizar display de estadísticas
        this.updateStatsDisplay();
    }

    addStreetLights(cityGrid) {
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = cityGrid[i][j];
                
                // Verificar si es una intersección
                const isRoadIntersection = 
                    (i > 0 && cityGrid[i - 1][j].type !== 'building') &&
                    (j > 0 && cityGrid[i][j - 1].type !== 'building') &&
                    (i < DERIVED.gridSize - 1 && cityGrid[i + 1][j].type !== 'building') &&
                    (j < DERIVED.gridSize - 1 && cityGrid[i][j + 1].type !== 'building');

                // Agregar luces de calle en intersecciones
                if (isRoadIntersection && Math.random() < 0.5) {
                    const lightPosition = new THREE.Vector3(
                        plot.x + DERIVED.plotStep / 2, 
                        0, 
                        plot.z + DERIVED.plotStep / 2
                    );
                    this.lightingManager.addStreetLight(lightPosition);
                }
            }
        }
    }

    setupEventListeners() {
        // Botón de alternar día/noche
        document.getElementById('toggleDayNight').addEventListener('click', () => {
            this.lightingManager.toggleDayNight();
            this.updateStatsDisplay();
        });

        // Botón de generar nueva ciudad
        document.getElementById('generateCity').addEventListener('click', () => {
            this.regenerateCity();
        });
    }

    regenerateCity() {
        // Limpiar elementos existentes
        this.cityManager.clearCity();
        this.buildingManager.clearBuildings();
        this.trafficManager.clearTraffic();
        this.lightingManager.clearStreetLights();
        
        // Limpiar peatones
        this.pedestrians.forEach(ped => this.sceneManager.scene.remove(ped.mesh));
        this.pedestrians = [];
        
        // Generar nueva ciudad
        this.generateCity();
    }

    updateStatsDisplay() {
        const timeString = this.lightingManager.getTimeString();
        document.getElementById('timeOfDay').textContent = timeString;
        document.getElementById('population').textContent = this.population.toLocaleString();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isInitialized) return;

        const deltaTime = this.sceneManager.getDeltaTime();
        const cityGrid = this.cityManager.getCityGrid();

        // Actualizar sistemas
        this.sceneManager.update();
        this.lightingManager.updateDayNightCycle(deltaTime);
        this.trafficManager.updateTraffic(deltaTime, cityGrid);
        
        // Actualizar peatones
        updatePedestrians(
            deltaTime, 
            THREE, 
            this.pedestrians, 
            cityGrid, 
            DERIVED.gridSize, 
            CONFIG.citySize, 
            CONFIG.buildingPlotSize, 
            CONFIG.pavementWidth
        );

        // Renderizar
        this.sceneManager.render();
        
        // Actualizar display de estadísticas
        this.updateStatsDisplay();
    }

    dispose() {
        if (this.cityManager) this.cityManager.dispose();
        if (this.buildingManager) this.buildingManager.dispose();
        if (this.trafficManager) this.trafficManager.dispose();
    }
}

// Inicializar la aplicación cuando se cargue la página
window.addEventListener('DOMContentLoaded', async () => {
    const simulator = new CitySimulator();
    await simulator.init();
});