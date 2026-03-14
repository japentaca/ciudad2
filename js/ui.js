// Módulo de interfaz de usuario
import { CONFIG, runtimeState } from './config.js';

export class UIManager {
  constructor() {
    this.elements = {};
    this.callbacks = {};
  }

  init() {
    this.elements = {
      toggleDayNight: document.getElementById('toggleDayNight'),
      generateCity: document.getElementById('generateCity'),
      roadNetwork: document.getElementById('roadNetwork'),
      timeSpeed: document.getElementById('timeSpeed'),
      timeSpeedValue: document.getElementById('timeSpeedValue'),
      vehicleDensity: document.getElementById('vehicleDensity'),
      vehicleDensityValue: document.getElementById('vehicleDensityValue'),
      pedestrianDensity: document.getElementById('pedestrianDensity'),
      pedestrianDensityValue: document.getElementById('pedestrianDensityValue'),
      timeOfDay: document.getElementById('timeOfDay'),
      population: document.getElementById('population'),
      vehicleCount: document.getElementById('vehicleCount'),
      pedestrianCount: document.getElementById('pedestrianCount')
    };

    this.syncFromState();
  }

  syncFromState() {
    const el = this.elements;
    if (el.roadNetwork) el.roadNetwork.value = runtimeState.roadNetworkType;
    if (el.timeSpeed) el.timeSpeed.value = String(runtimeState.timeSpeedMultiplier);
    if (el.timeSpeedValue) el.timeSpeedValue.textContent = `${runtimeState.timeSpeedMultiplier.toFixed(2)}x`;
    if (el.vehicleDensity) el.vehicleDensity.value = String(runtimeState.numVehicles);
    if (el.vehicleDensityValue) el.vehicleDensityValue.textContent = String(runtimeState.numVehicles);
    if (el.pedestrianDensity) el.pedestrianDensity.value = String(runtimeState.numPedestrians);
    if (el.pedestrianDensityValue) el.pedestrianDensityValue.textContent = String(runtimeState.numPedestrians);
  }

  /**
   * @param {object} callbacks
   * @param {function} callbacks.onToggleDayNight
   * @param {function} callbacks.onGenerateCity
   * @param {function} callbacks.onRoadNetworkChange
   * @param {function} callbacks.onVehicleDensityChange
   * @param {function} callbacks.onPedestrianDensityChange
   */
  bind(callbacks) {
    this.callbacks = callbacks;
    const el = this.elements;

    el.toggleDayNight?.addEventListener('click', () => {
      callbacks.onToggleDayNight?.();
    });

    el.generateCity?.addEventListener('click', () => {
      callbacks.onGenerateCity?.();
    });

    el.roadNetwork?.addEventListener('change', event => {
      runtimeState.roadNetworkType = event.target.value;
      callbacks.onRoadNetworkChange?.();
    });

    el.timeSpeed?.addEventListener('input', event => {
      const value = Number(event.target.value);
      runtimeState.timeSpeedMultiplier = value;
      runtimeState.cycleSpeed = CONFIG.baseCycleSpeed * value;
      if (el.timeSpeedValue) {
        el.timeSpeedValue.textContent = `${value.toFixed(2)}x`;
      }
    });

    el.vehicleDensity?.addEventListener('input', event => {
      const value = Number(event.target.value);
      runtimeState.numVehicles = value;
      if (el.vehicleDensityValue) {
        el.vehicleDensityValue.textContent = String(value);
      }
      callbacks.onVehicleDensityChange?.(value);
    });

    el.pedestrianDensity?.addEventListener('input', event => {
      const value = Number(event.target.value);
      runtimeState.numPedestrians = value;
      if (el.pedestrianDensityValue) {
        el.pedestrianDensityValue.textContent = String(value);
      }
      callbacks.onPedestrianDensityChange?.(value);
    });
  }

  updateStats({ timeString, population, vehicleCount, pedestrianCount }) {
    const el = this.elements;
    if (el.timeOfDay) el.timeOfDay.textContent = timeString;
    if (el.population) el.population.textContent = population.toLocaleString();
    if (el.vehicleCount) el.vehicleCount.textContent = String(vehicleCount);
    if (el.pedestrianCount) el.pedestrianCount.textContent = String(pedestrianCount);
  }
}
