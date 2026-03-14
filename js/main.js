// Archivo principal del simulador de ciudad 3D
import { SceneManager } from './scene.js';
import { LightingManager } from './lighting.js';
import { CityManager } from './city.js';
import { BuildingManager } from './buildings.js';
import { TrafficManager } from './traffic.js';
import { ModelLoader } from './models.js';
import { PedestrianSystem } from './entities/pedestrian-system.js';
import { UIManager } from './ui.js';
import { CONFIG, runtimeState } from './config.js';

export class CitySimulator {
  constructor() {
    this.sceneManager = null;
    this.lightingManager = null;
    this.cityManager = null;
    this.buildingManager = null;
    this.trafficManager = null;
    this.modelLoader = null;
    this.pedestrianSystem = null;
    this.ui = new UIManager();

    this.population = 0;
    this.isInitialized = false;
    this.statsUpdateAccumulator = 0;
  }

  async init() {
    try {
      this.modelLoader = new ModelLoader();
      const models = await this.modelLoader.loadModels();

      this.sceneManager = new SceneManager();
      this.sceneManager.init();

      this.ui.init();

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
      this.isInitialized = true;
      this.animate();

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

    navigationData.streetLightPositions.forEach(position => {
      this.lightingManager.addStreetLight(position);
    });

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

  setupEventListeners() {
    this.ui.bind({
      onToggleDayNight: () => {
        this.lightingManager.toggleDayNight();
        this.updateStatsDisplay();
      },
      onGenerateCity: () => this.regenerateCity(),
      onRoadNetworkChange: () => this.regenerateCity(),
      onVehicleDensityChange: (value) => {
        this.trafficManager.setVehicleCount(value);
        this.refreshTraffic();
      },
      onPedestrianDensityChange: (value) => {
        this.pedestrianSystem.setPedestrianCount(value);
        this.refreshPedestrians();
      }
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
    this.ui.updateStats({
      timeString: this.lightingManager.getTimeString(),
      population: this.population,
      vehicleCount: this.trafficManager ? this.trafficManager.getVehicleCount() : 0,
      pedestrianCount: this.pedestrianSystem ? this.pedestrianSystem.getPedestrianCount() : 0
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.isInitialized) return;

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
