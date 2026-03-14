import * as THREE from 'three';
import { CONFIG } from './config.js';

export class WeatherManager {
  constructor(scene) {
    this.scene = scene;
    this.mode = CONFIG.weather.mode;
    this.enabled = CONFIG.weather.enabled;
    this.rain = null;
    this.rainGeometry = null;
    this.rainMaterial = null;
    this.defaultFog = {
      near: 200,
      far: 4500
    };
    this.hasCapturedDefaultFog = false;
  }

  init() {
    this.setMode(this.mode);
  }

  captureDefaultFog() {
    if (!this.scene.fog) {
      return;
    }

    this.defaultFog.near = this.scene.fog.near;
    this.defaultFog.far = this.scene.fog.far;
    this.hasCapturedDefaultFog = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clearRain();
    }
  }

  setMode(mode) {
    this.mode = mode;
    CONFIG.weather.mode = mode;

    if (!this.enabled || mode !== 'rain') {
      this.clearRain();
    }

    if (this.enabled && mode === 'rain') {
      this.createRain();
    }
  }

  createRain() {
    this.clearRain();

    const positions = new Float32Array(CONFIG.weather.rainCount * 3);
    const halfArea = CONFIG.weather.rainArea / 2;

    for (let index = 0; index < CONFIG.weather.rainCount; index++) {
      const offset = index * 3;
      positions[offset] = THREE.MathUtils.randFloat(-halfArea, halfArea);
      positions[offset + 1] = THREE.MathUtils.randFloat(20, CONFIG.weather.rainHeight);
      positions[offset + 2] = THREE.MathUtils.randFloat(-halfArea, halfArea);
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMaterial = new THREE.PointsMaterial({
      color: 0xbdd8ff,
      size: 0.9,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rain);

    this.captureDefaultFog();
  }

  clearRain() {
    if (!this.rain) {
      return;
    }

    this.scene.remove(this.rain);
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.rain = null;
    this.rainGeometry = null;
    this.rainMaterial = null;
  }

  update(deltaTime) {
    if (this.scene.fog) {
      if (!this.hasCapturedDefaultFog && this.mode === 'clear') {
        this.captureDefaultFog();
      }

      if (!this.enabled || this.mode === 'clear') {
        this.scene.fog.near = this.defaultFog.near;
        this.scene.fog.far = this.defaultFog.far;
      } else if (this.mode === 'fog') {
        this.scene.fog.near = CONFIG.weather.fogNear;
        this.scene.fog.far = CONFIG.weather.fogFar;
      } else if (this.mode === 'rain') {
        this.scene.fog.near = Math.min(this.defaultFog.near, 180);
        this.scene.fog.far = Math.min(this.defaultFog.far, 2600);
      }
    }

    if (!this.enabled || this.mode !== 'rain' || !this.rainGeometry) {
      return;
    }

    const positions = this.rainGeometry.attributes.position.array;
    const halfArea = CONFIG.weather.rainArea / 2;

    for (let index = 0; index < positions.length; index += 3) {
      positions[index] += 10 * deltaTime;
      positions[index + 1] -= CONFIG.weather.rainSpeed * deltaTime;

      if (positions[index + 1] < 5) {
        positions[index] = THREE.MathUtils.randFloat(-halfArea, halfArea);
        positions[index + 1] = CONFIG.weather.rainHeight;
        positions[index + 2] = THREE.MathUtils.randFloat(-halfArea, halfArea);
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.clearRain();
  }
}