// Módulo de iluminación y ciclo día/noche
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class LightingManager {
    constructor(scene) {
        this.scene = scene;
        this.ambientLight = null;
        this.directionalLight = null;
        this.hemisphereLight = null;
        this.streetLights = [];
        this.timeOfDay = 0.5; // 0 = medianoche, 0.5 = mediodía, 1 = medianoche
        this.isDay = true;
    }

    init() {
        // Luz ambiental
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(this.ambientLight);

        // Luz direccional (sol)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.directionalLight.position.set(150, 300, 200);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 50;
        this.directionalLight.shadow.camera.far = 1000;
        this.directionalLight.shadow.camera.left = -CONFIG.citySize / 1.5;
        this.directionalLight.shadow.camera.right = CONFIG.citySize / 1.5;
        this.directionalLight.shadow.camera.top = CONFIG.citySize / 1.5;
        this.directionalLight.shadow.camera.bottom = -CONFIG.citySize / 1.5;
        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);

        // Luz hemisférica
        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x080820, 0.1);
        this.scene.add(this.hemisphereLight);
    }

    addStreetLight(position) {
        const light = new THREE.PointLight(CONFIG.lightColor, 0, 50, 1);
        light.position.copy(position);
        light.position.y = CONFIG.lightHeight;
        light.castShadow = false; // Las sombras de luces puntuales son costosas
        this.scene.add(light);

        // Poste de la luz
        const poleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            roughness: 0.8, 
            metalness: 0.5 
        });
        const poleGeometry = new THREE.CylinderGeometry(0.5, 0.5, CONFIG.lightHeight, 8);
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.copy(light.position);
        pole.position.y = CONFIG.lightHeight / 2;
        pole.castShadow = true;
        this.scene.add(pole);

        // Bombilla visual
        const lightMaterial = new THREE.MeshBasicMaterial({ color: CONFIG.lightColor });
        const lightBulbGeometry = new THREE.SphereGeometry(1, 8, 8);
        const bulb = new THREE.Mesh(lightBulbGeometry, lightMaterial);
        bulb.position.copy(light.position);
        this.scene.add(bulb);

        this.streetLights.push({ 
            light: light, 
            pole: pole, 
            bulb: bulb, 
            onIntensity: 1.5 
        });

        // Limpiar geometrías
        poleGeometry.dispose();
        lightBulbGeometry.dispose();
    }

    updateDayNightCycle(deltaTime) {
        // Calcular posición del sol
        const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
        this.directionalLight.position.x = 150 * Math.cos(sunAngle);
        this.directionalLight.position.y = 300 * Math.sin(sunAngle + Math.PI / 2);
        this.directionalLight.target.position.set(0, 0, 0);

        // Ajustar intensidad y color de las luces según la hora
        const dayIntensity = Math.max(0, Math.sin(this.timeOfDay * Math.PI));
        const nightIntensity = 0.15 + Math.max(0, Math.sin((this.timeOfDay + 0.5) % 1 * Math.PI)) * 0.3;

        this.directionalLight.intensity = dayIntensity * 2.0;
        this.ambientLight.intensity = dayIntensity * 0.9 + nightIntensity * 0.4;
        this.hemisphereLight.intensity = dayIntensity * 0.7 + nightIntensity * 0.3;

        // Interpolación del color del cielo
        const daySkyColor = new THREE.Color(0x87ceeb);
        const nightSkyColor = new THREE.Color(0x000020);
        const horizonColor = new THREE.Color(0xffaa66);
        const sunsetFactor = Math.pow(Math.abs(Math.sin(this.timeOfDay * Math.PI)), 4);

        let currentSkyColor = daySkyColor.clone().lerp(nightSkyColor, 1 - dayIntensity);
        currentSkyColor.lerp(horizonColor, sunsetFactor * 0.5);

        this.scene.background = currentSkyColor;
        this.hemisphereLight.color.copy(currentSkyColor);
        this.hemisphereLight.groundColor.set(0x080820).lerp(new THREE.Color(0x404040), dayIntensity);

        // Actualizar niebla
        if (!this.scene.fog) {
            this.scene.fog = new THREE.Fog(currentSkyColor, 200, 4500);
        }
        this.scene.fog.color.copy(currentSkyColor);

        // Actualizar luces de la calle
        this.isDay = dayIntensity > 0.1;
        const targetStreetlightIntensity = this.isDay ? 0 : 1.0;
        
        this.streetLights.forEach(lightGroup => {
            lightGroup.light.intensity += (targetStreetlightIntensity * lightGroup.onIntensity - lightGroup.light.intensity) * 0.1;
            lightGroup.bulb.material.opacity = lightGroup.light.intensity / lightGroup.onIntensity;
        });
    }

    toggleDayNight() {
        if (this.isDay) {
            this.timeOfDay = 0.0; // Medianoche
        } else {
            this.timeOfDay = 0.5; // Mediodía
        }
        this.updateDayNightCycle(0);
    }

    clearStreetLights() {
        this.streetLights.forEach(lightGroup => {
            this.scene.remove(lightGroup.light);
            this.scene.remove(lightGroup.pole);
            this.scene.remove(lightGroup.bulb);
        });
        this.streetLights = [];
    }

    getTimeString() {
        let timeString = "Noche";
        if (this.timeOfDay > 0.25 && this.timeOfDay < 0.75) timeString = "Día";
        if (this.timeOfDay > 0.2 && this.timeOfDay < 0.3) timeString = "Amanecer";
        if (this.timeOfDay > 0.7 && this.timeOfDay < 0.8) timeString = "Atardecer";
        return `${timeString} (${this.timeOfDay.toFixed(2)})`;
    }
}