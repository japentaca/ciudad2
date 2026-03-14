// Módulo de generación de ciudad (coordinador)
import * as THREE from 'three';
import { CONFIG, DERIVED, runtimeState } from './config.js';
import { TextureManager } from './textures.js';
import { LayoutGenerator } from './layout-generator.js';
import { NavigationBuilder } from './navigation.js';
import { InfrastructureBuilder } from './infrastructure.js';

export class CityManager {
    constructor(scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.layoutGenerator = new LayoutGenerator();
        this.navigationBuilder = new NavigationBuilder();
        this.infrastructureBuilder = new InfrastructureBuilder(scene);
        this.cityGrid = [];
        this.groundPlane = null;
        this.navigationData = this.navigationBuilder.createEmptyNavigationData();
    }

    generateCityLayout() {
        this.clearCity();
        this.cityGrid = this.layoutGenerator.generate(runtimeState.roadNetworkType);
        this.navigationData = this.navigationBuilder.build(this.cityGrid, this.layoutGenerator);
        this.createGround();
        this.infrastructureBuilder.build(this.cityGrid, this.navigationData);
        return this.cityGrid;
    }

    createGround() {
        const groundTexture = this.textureManager.createGroundTexture(this.cityGrid);
        const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(CONFIG.citySize, CONFIG.citySize);

        this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    clearCity() {
        if (this.groundPlane) {
            this.scene.remove(this.groundPlane);
            this.groundPlane.geometry.dispose();
            if (this.groundPlane.material.map) {
                this.groundPlane.material.map.dispose();
            }
            this.groundPlane.material.dispose();
            this.groundPlane = null;
        }

        this.infrastructureBuilder.clear();
        this.cityGrid = [];
        this.navigationData = this.navigationBuilder.createEmptyNavigationData();
    }

    getCityGrid() {
        return this.cityGrid;
    }

    getNavigationData() {
        return this.navigationData;
    }

    dispose() {
        this.clearCity();
        this.textureManager.dispose();
    }
}
