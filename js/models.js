// Módulo de carga de modelos 3D
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as THREE from 'three';

export class ModelLoader {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.carModel = null;
        this.truckModel = null;
    }

    async loadModels() {
        const results = await Promise.allSettled([
            this.loadGLTF('models/car.glb', 'Coche'),
            this.loadGLTF('models/truck.glb', 'Camión')
        ]);

        if (results[0].status === 'fulfilled') {
            this.carModel = results[0].value;
        } else {
            console.warn('Modelo de coche no disponible, se usará geometría de respaldo');
        }

        if (results[1].status === 'fulfilled') {
            this.truckModel = results[1].value;
        } else {
            console.warn('Modelo de camión no disponible, se usará geometría de respaldo');
        }

        console.log('Carga de modelos completada, inicializando escena...');
        return {
            carModel: this.carModel,
            truckModel: this.truckModel
        };
    }

    loadGLTF(path, label) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    console.log(`Modelo de ${label} Cargado. Tamaño:`,
                        size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));

                    model.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    resolve(model);
                },
                undefined,
                (error) => {
                    console.error(`Error cargando modelo de ${label}:`, error);
                    reject(error);
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
