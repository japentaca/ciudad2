// Archivo principal del simulador de ciudad 3D
import { SceneManager } from './scene.js';
import { LightingManager } from './lighting.js';
import { CityManager } from './city.js';
import { BuildingManager } from './buildings.js';
import { TrafficManager } from './traffic.js';
import { ModelLoader } from './models.js';
import { PedestrianSystem } from './entities/pedestrian-system.js';
import { CONFIG } from './config.js';

export class CitySimulator {
  constructor() {
    this.sceneManager = null;
    this.lightingManager = null;
    this.cityManager = null;
    this.buildingManager = null;
    this.trafficManager = null;
    this.modelLoader = null;
    this.pedestrianSystem = null;

    this.population = 0;
    this.isInitialized = false;
    this.statsUpdateAccumulator = 0;
    this.ui = {
      toggleDayNightButton: null,
      generateCityButton: null,
      timeSpeed: null,
      timeSpeedValue: null,
      vehicleDensity: null,
      vehicleDensityValue: null,
      pedestrianDensity: null,
      pedestrianDensityValue: null,
      timeOfDay: null,
      population: null,
      vehicleCount: null,
      pedestrianCount: null
    };
  }

  async init() {
    try {
      this.modelLoader = new ModelLoader();
      const models = await this.modelLoader.loadModels();

      this.sceneManager = new SceneManager();
      this.sceneManager.init();
      this.cacheUIElements();

      this.lightingManager = new LightingManager(this.sceneManager.scene, this.sceneManager.renderer);
      this.lightingManager.init();

      this.cityManager = new CityManager(this.sceneManager.scene);
      this.buildingManager = new BuildingManager(this.sceneManager.scene);
      this.trafficManager = new TrafficManager(this.sceneManager.scene);
      this.pedestrianSystem = new PedestrianSystem(this.sceneManager.scene);

      this.trafficManager.setModels(models.carModel, models.truckModel);
      await this.pedestrianSystem.init();

      this.generateCity();
      this.setupEventListeners();
      this.animate();

      this.isInitialized = true;
      console.log('Simulador de ciudad inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando el simulador:', error);
    }
  }

  generateCity() {
    const cityGrid = this.cityManager.generateCityLayout();
    const navigationData = this.cityManager.getNavigationData();

    this.buildingManager.createBuildings(cityGrid);
    this.population = this.buildingManager.getPopulation();
    this.buildingManager.setNightFactor(this.lightingManager.getNightFactor());

    this.addStreetLights(navigationData.streetLightPositions);

    this.trafficManager.setNavigationData(navigationData);
    this.trafficManager.createTraffic(cityGrid, navigationData);

    this.pedestrianSystem.setNavigationNetwork(navigationData.pedestrianNetwork);
    this.pedestrianSystem.setSignalResolver((intersectionId, axis) => {
      return this.trafficManager.isPedestrianCrossingAllowed(intersectionId, axis);
    });

    this.pedestrianSystem.createPedestrians().then(() => {
      this.updateStatsDisplay();
    }).catch(error => {
      console.error('Error creando peatones:', error);
    });

    this.updateStatsDisplay();
  }

  cacheUIElements() {
    this.ui.toggleDayNightButton = document.getElementById('toggleDayNight');
    this.ui.generateCityButton = document.getElementById('generateCity');
    this.ui.timeSpeed = document.getElementById('timeSpeed');
    this.ui.timeSpeedValue = document.getElementById('timeSpeedValue');
    this.ui.vehicleDensity = document.getElementById('vehicleDensity');
    this.ui.vehicleDensityValue = document.getElementById('vehicleDensityValue');
    this.ui.pedestrianDensity = document.getElementById('pedestrianDensity');
    this.ui.pedestrianDensityValue = document.getElementById('pedestrianDensityValue');
    this.ui.timeOfDay = document.getElementById('timeOfDay');
    this.ui.population = document.getElementById('population');
    this.ui.vehicleCount = document.getElementById('vehicleCount');
    this.ui.pedestrianCount = document.getElementById('pedestrianCount');

    if (this.ui.timeSpeed) this.ui.timeSpeed.value = String(CONFIG.timeSpeedMultiplier);
    if (this.ui.timeSpeedValue) this.ui.timeSpeedValue.textContent = `${CONFIG.timeSpeedMultiplier.toFixed(2)}x`;
    if (this.ui.vehicleDensity) this.ui.vehicleDensity.value = String(CONFIG.numVehicles);
    if (this.ui.vehicleDensityValue) this.ui.vehicleDensityValue.textContent = String(CONFIG.numVehicles);
    if (this.ui.pedestrianDensity) this.ui.pedestrianDensity.value = String(CONFIG.numPedestrians);
    if (this.ui.pedestrianDensityValue) this.ui.pedestrianDensityValue.textContent = String(CONFIG.numPedestrians);
  }

  addStreetLights(streetLightPositions) {
    streetLightPositions.forEach(position => {
      this.lightingManager.addStreetLight(position);
    });
  }

  setupEventListeners() {
    this.ui.toggleDayNightButton?.addEventListener('click', () => {
      this.lightingManager.toggleDayNight();
      this.updateStatsDisplay();
    });

    this.ui.generateCityButton?.addEventListener('click', () => {
      this.regenerateCity();
    });

    this.ui.timeSpeed?.addEventListener('input', event => {
      const value = Number(event.target.value);
      CONFIG.timeSpeedMultiplier = value;
      CONFIG.cycleSpeed = CONFIG.baseCycleSpeed * value;
      if (this.ui.timeSpeedValue) {
        this.ui.timeSpeedValue.textContent = `${value.toFixed(2)}x`;
      }
    });

    this.ui.vehicleDensity?.addEventListener('input', event => {
      const value = Number(event.target.value);
      this.trafficManager.setVehicleCount(value);
      if (this.ui.vehicleDensityValue) {
        this.ui.vehicleDensityValue.textContent = String(value);
      }
      this.refreshTraffic();
    });

    this.ui.pedestrianDensity?.addEventListener('input', event => {
      const value = Number(event.target.value);
      this.pedestrianSystem.setPedestrianCount(value);
      if (this.ui.pedestrianDensityValue) {
        this.ui.pedestrianDensityValue.textContent = String(value);
      }
      this.refreshPedestrians();
    });

  }

  regenerateCity() {
    this.cityManager.clearCity();
    this.buildingManager.clearBuildings();
    this.trafficManager.clearTraffic();
    this.lightingManager.clearStreetLights();
    this.pedestrianSystem.clearPedestrians();
    this.generateCity();
  }

  refreshTraffic() {
    this.trafficManager.createTraffic(this.cityManager.getCityGrid(), this.cityManager.getNavigationData());
    this.updateStatsDisplay();
  }

  refreshPedestrians() {
    this.pedestrianSystem.createPedestrians().then(() => {
      this.updateStatsDisplay();
    });
  }

  updateStatsDisplay() {
    const timeString = this.lightingManager.getTimeString();

    if (this.ui.timeOfDay) {
      this.ui.timeOfDay.textContent = timeString;
    }

    if (this.ui.population) {
      this.ui.population.textContent = this.population.toLocaleString();
    }

    if (this.ui.vehicleCount) {
      this.ui.vehicleCount.textContent = String(this.trafficManager ? this.trafficManager.getVehicleCount() : 0);
    }

    if (this.ui.pedestrianCount) {
      this.ui.pedestrianCount.textContent = String(this.pedestrianSystem ? this.pedestrianSystem.getPedestrianCount() : 0);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.isInitialized) {
      return;
    }

    const deltaTime = this.sceneManager.getDeltaTime();

    this.sceneManager.update();
    this.lightingManager.updateDayNightCycle(deltaTime);
    this.buildingManager.setNightFactor(this.lightingManager.getNightFactor());
    this.trafficManager.updateTraffic(deltaTime);
    this.pedestrianSystem.updatePedestrians(deltaTime);
    this.sceneManager.render();

    this.statsUpdateAccumulator += deltaTime;
    if (this.statsUpdateAccumulator >= CONFIG.uiRefreshInterval) {
      this.statsUpdateAccumulator = 0;
      this.updateStatsDisplay();
    }
  }

  dispose() {
    if (this.cityManager) this.cityManager.dispose();
    if (this.buildingManager) this.buildingManager.dispose();
    if (this.trafficManager) this.trafficManager.dispose();
    if (this.lightingManager) this.lightingManager.dispose();
    if (this.pedestrianSystem) this.pedestrianSystem.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const simulator = new CitySimulator();
  await simulator.init();
});