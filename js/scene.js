// Módulo de inicialización de la escena Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { CONFIG } from './config.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.stats = null;
        this.clock = new THREE.Clock();
        this.resizeHandler = null;
    }

    init() {
        // Crear escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Azul cielo inicial

        // Crear cámara
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            5000
        );
        this.camera.position.set(150, 200, 250);

        // Crear renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('container').appendChild(this.renderer.domElement);

        // Crear controles
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 1500;
        this.controls.maxPolarAngle = Math.PI / 2.1; // Evitar mirar directamente hacia abajo

        // Crear monitor de rendimiento
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        // Configurar redimensionamiento de ventana
        this.resizeHandler = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.resizeHandler);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    update() {
        this.controls.update();
        this.stats.update();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getDeltaTime() {
        return this.clock.getDelta();
    }

    dispose() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        if (this.renderer) {
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.stats?.dom?.parentNode) {
            this.stats.dom.parentNode.removeChild(this.stats.dom);
        }
        this.stats = null;
    }
}