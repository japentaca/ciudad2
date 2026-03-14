// Módulo de iluminación y ciclo día/noche
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class LightingManager {
    constructor(scene, renderer = null) {
        this.scene = scene;
        this.renderer = renderer;
        this.ambientLight = null;
        this.directionalLight = null;
        this.hemisphereLight = null;
        this.streetLights = [];
        this.timeOfDay = 0.5; // 0 = medianoche, 0.5 = mediodía, 1 = medianoche
        this.isDay = true;
        this.nightFactor = 0;
        this.maxActiveStreetPointLights = 0;
    }

    init() {
        this.maxActiveStreetPointLights = this.resolveStreetLightBudget();

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

    resolveStreetLightBudget() {
        return Math.max(0, CONFIG.maxStreetPointLights);
    }

    addStreetLight(position) {
        // Limit active PointLights to avoid exceeding the GPU fragment shader
        // uniform limit (GL_MAX_FRAGMENT_UNIFORM_VECTORS). Visual poles and bulbs
        // are always created; only the first MAX_ACTIVE_POINT_LIGHTS get a real light.
        const activeCount = this.streetLights.filter(g => g.light !== null).length;

        let light = null;
        if (activeCount < this.maxActiveStreetPointLights) {
            light = new THREE.PointLight(CONFIG.lightColor, 0, 50, 1);
            light.position.copy(position);
            light.position.y = CONFIG.lightHeight;
            light.castShadow = false; // Las sombras de luces puntuales son costosas
            this.scene.add(light);
        }

        // Posición base para polo y bombilla
        const lightPos = new THREE.Vector3().copy(position);
        lightPos.y = CONFIG.lightHeight;

        // Poste de la luz
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.5
        });
        const poleGeometry = new THREE.CylinderGeometry(0.5, 0.5, CONFIG.lightHeight, 8);
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.copy(position);
        pole.position.y = CONFIG.lightHeight / 2;
        pole.castShadow = true;
        this.scene.add(pole);

        // Bombilla visual
        const lightMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.lightColor,
            transparent: true,
            opacity: 0
        });
        const lightBulbGeometry = new THREE.SphereGeometry(1, 8, 8);
        const bulb = new THREE.Mesh(lightBulbGeometry, lightMaterial);
        bulb.position.copy(lightPos);
        this.scene.add(bulb);

        this.streetLights.push({
            light,
            pole,
            bulb,
            onIntensity: 1.5
        });
    }

    updateDayNightCycle(deltaTime) {
        this.timeOfDay = (this.timeOfDay + deltaTime * CONFIG.cycleSpeed) % 1;

        // Posición del sol: arco correcto — máxima altura (Y=300) al mediodía (t=0.5)
        const sunElevation = this.timeOfDay * Math.PI; // 0=medianoche, π/2=mediodía
        this.directionalLight.position.x = 200 * Math.cos(sunElevation);
        this.directionalLight.position.y = 300 * Math.sin(sunElevation);
        this.directionalLight.target.position.set(0, 0, 0);

        // Intensidades
        const dayIntensity = Math.max(0, Math.sin(this.timeOfDay * Math.PI));
        const nightIntensity = 0.15 + Math.max(0, Math.sin((this.timeOfDay + 0.5) % 1 * Math.PI)) * 0.3;
        this.nightFactor = THREE.MathUtils.clamp(1 - dayIntensity, 0, 1);

        this.directionalLight.intensity = dayIntensity * 2.0;
        // Mínimo 0.4 de ambiente para que la geometría siempre sea visible
        this.ambientLight.intensity = Math.max(0.4, dayIntensity * 0.9 + nightIntensity * 0.4);
        this.hemisphereLight.intensity = dayIntensity * 0.7 + nightIntensity * 0.3;

        // Interpolación del color del cielo
        const daySkyColor = new THREE.Color(0x87ceeb);
        const nightSkyColor = new THREE.Color(0x000020);
        const horizonColor = new THREE.Color(0xffaa66);
        // Pico naranja en amanecer (t=0.25) y atardecer (t=0.75), cero al mediodía y medianoche
        const sunsetFactor = Math.pow(Math.abs(Math.sin(this.timeOfDay * Math.PI * 2)), 3);

        let currentSkyColor = daySkyColor.clone().lerp(nightSkyColor, 1 - dayIntensity);
        currentSkyColor.lerp(horizonColor, sunsetFactor * 0.5);

        this.scene.background = currentSkyColor;
        this.hemisphereLight.color.copy(currentSkyColor);
        this.hemisphereLight.groundColor.set(0x080820).lerp(new THREE.Color(0x404040), dayIntensity);

        // Actualizar luces de la calle
        this.isDay = dayIntensity > 0.1;
        const targetStreetlightIntensity = this.isDay ? 0 : 1.0;

        this.streetLights.forEach(lightGroup => {
            if (lightGroup.light) {
                lightGroup.light.intensity += (targetStreetlightIntensity * lightGroup.onIntensity - lightGroup.light.intensity) * 0.1;
            }
            const visualIntensity = lightGroup.light
                ? lightGroup.light.intensity / lightGroup.onIntensity
                : (this.isDay ? 0 : 1);
            lightGroup.bulb.material.opacity = THREE.MathUtils.clamp(visualIntensity, 0, 1);
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
            if (lightGroup.light) {
                this.scene.remove(lightGroup.light);
            }
            this.scene.remove(lightGroup.pole);
            this.scene.remove(lightGroup.bulb);

            lightGroup.pole.geometry.dispose();
            lightGroup.pole.material.dispose();
            lightGroup.bulb.geometry.dispose();
            lightGroup.bulb.material.dispose();
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

    getNightFactor() {
        return this.nightFactor;
    }

    dispose() {
        this.clearStreetLights();
        if (this.ambientLight) this.scene.remove(this.ambientLight);
        if (this.hemisphereLight) this.scene.remove(this.hemisphereLight);
        if (this.directionalLight) {
            this.scene.remove(this.directionalLight);
            this.scene.remove(this.directionalLight.target);
        }
    }
}