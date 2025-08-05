// Módulo de carga de modelos 3D
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

export class ModelLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.carModel = null;
        this.truckModel = null;
        this.loadedModels = 0;
        this.totalModels = 2;
    }

    async loadModels() {
        return new Promise((resolve, reject) => {
            const checkAllModelsLoaded = () => {
                this.loadedModels++;
                if (this.loadedModels === this.totalModels) {
                    console.log("Todos los modelos cargados, inicializando escena...");
                    resolve({
                        carModel: this.carModel,
                        truckModel: this.truckModel
                    });
                }
            };

            // Cargar modelo de coche
            this.loader.load(
                'models/car.glb',
                (gltf) => {
                    this.carModel = gltf.scene;
                    const box = new THREE.Box3().setFromObject(this.carModel);
                    const size = box.getSize(new THREE.Vector3());
                    console.log('Modelo de Coche Cargado. Tamaño:', 
                        size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));
                    
                    // Configurar propiedades de sombra en el modelo original cargado
                    this.carModel.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    checkAllModelsLoaded();
                },
                undefined, // Callback de progreso (opcional)
                (error) => {
                    console.error('Error cargando modelo de coche:', error);
                    checkAllModelsLoaded(); // Continuar incluso si falla
                }
            );

            // Cargar modelo de camión
            this.loader.load(
                'models/truck.glb',
                (gltf) => {
                    this.truckModel = gltf.scene;
                    const box = new THREE.Box3().setFromObject(this.truckModel);
                    const size = box.getSize(new THREE.Vector3());
                    console.log('Modelo de Camión Cargado. Tamaño:', 
                        size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));
                    
                    // Configurar propiedades de sombra en el modelo original cargado
                    this.truckModel.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    checkAllModelsLoaded();
                },
                undefined, // Callback de progreso (opcional)
                (error) => {
                    console.error('Error cargando modelo de camión:', error);
                    checkAllModelsLoaded(); // Continuar incluso si falla
                }
            );
        });
    }

    getCarModel() {
        return this.carModel;
    }

    getTruckModel() {
        return this.truckModel;
    }
}