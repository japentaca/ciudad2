// Módulo de sistema de tráfico
import * as THREE from 'three';
import { CONFIG, DERIVED } from './config.js';

export class TrafficManager {
    constructor(scene) {
        this.scene = scene;
        this.vehicles = [];
        this.carModel = null;
        this.truckModel = null;
    }

    setModels(carModel, truckModel) {
        this.carModel = carModel;
        this.truckModel = truckModel;
    }

    createTraffic(cityGrid) {
        this.clearTraffic();

        const vehicleTypes = [
            { 
                type: 'car', 
                material: new THREE.MeshStandardMaterial({ 
                    color: Math.random() * 0xffffff, 
                    roughness: 0.6, 
                    metalness: 0.2 
                }), 
                speedRange: [20, 40] 
            },
            { 
                type: 'truck', 
                material: new THREE.MeshStandardMaterial({ 
                    color: Math.random() * 0x888888 + 0x444444, 
                    roughness: 0.8, 
                    metalness: 0.1 
                }), 
                speedRange: [18, 30] 
            }
        ];

        for (let i = 0; i < CONFIG.numVehicles; i++) {
            const typeIndex = THREE.MathUtils.randInt(0, vehicleTypes.length - 1);
            const vehicleType = vehicleTypes[typeIndex];
            let vehicleMesh;

            // Crear geometría según el tipo
            switch (vehicleType.type) {
                case 'car':
                    if (this.carModel) {
                        vehicleMesh = this.carModel.clone();
                        this.applyRandomMaterial(vehicleMesh);
                        const carScaleFactor = 10;
                        vehicleMesh.scale.set(carScaleFactor, carScaleFactor, carScaleFactor);
                        const carBox = new THREE.Box3().setFromObject(vehicleMesh);
                        vehicleMesh.position.y = -carBox.min.y + 0.1;
                    } else {
                        vehicleMesh = this.createFallbackCar(vehicleType.material);
                    }
                    break;
                    
                case 'truck':
                    if (this.truckModel) {
                        vehicleMesh = this.truckModel.clone();
                        this.applyRandomMaterial(vehicleMesh);
                        const truckScaleFactor = 12;
                        vehicleMesh.scale.set(truckScaleFactor, truckScaleFactor, truckScaleFactor);
                        const truckBox = new THREE.Box3().setFromObject(vehicleMesh);
                        vehicleMesh.position.y = -truckBox.min.y + 0.1;
                    } else {
                        vehicleMesh = this.createFallbackTruck(vehicleType.material);
                    }
                    break;
                    
                default:
                    vehicleMesh = this.createFallbackCar(vehicleType.material);
                    break;
            }

            // Configurar sombras
            vehicleMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });

            // Intentar colocar en una carretera
            if (this.placeVehicleOnRoad(vehicleMesh, vehicleType, cityGrid)) {
                this.scene.add(vehicleMesh);
            }
        }
    }

    applyRandomMaterial(vehicleMesh) {
        vehicleMesh.traverse(child => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => {
                        const clonedMaterial = m.clone();
                        clonedMaterial.color.set(Math.random() * 0xffffff);
                        clonedMaterial.roughness = 0.3;
                        clonedMaterial.metalness = 0.6;
                        return clonedMaterial;
                    });
                } else {
                    child.material = child.material.clone();
                    child.material.color.set(Math.random() * 0xffffff);
                    child.material.roughness = 0.3;
                    child.material.metalness = 0.6;
                }
                child.castShadow = true;
            }
        });
    }

    createFallbackCar(material) {
        const fallbackGeo = new THREE.BoxGeometry(4.5, 1.5, 2.5);
        const vehicleMesh = new THREE.Mesh(fallbackGeo, material);
        vehicleMesh.position.y = 0.75 + 0.1;
        vehicleMesh.castShadow = true;
        return vehicleMesh;
    }

    createFallbackTruck(material) {
        const fallbackGeo = new THREE.BoxGeometry(9, 2.8, 3.0);
        const vehicleMesh = new THREE.Mesh(fallbackGeo, material);
        vehicleMesh.position.y = 1.4 + 0.1;
        vehicleMesh.castShadow = true;
        return vehicleMesh;
    }

    placeVehicleOnRoad(vehicleMesh, vehicleType, cityGrid) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
            const gridX = THREE.MathUtils.randInt(0, DERIVED.gridSize - 1);
            const gridZ = THREE.MathUtils.randInt(0, DERIVED.gridSize - 1);
            const plot = cityGrid[gridX][gridZ];

            if (plot.type !== 'building') {
                const direction = Math.random() > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
                if (Math.random() > 0.5) direction.multiplyScalar(-1);

                const laneOffset = DERIVED.halfRoadWidth / 2 * (Math.random() > 0.5 ? 1 : -1);
                
                if (direction.x !== 0) {
                    vehicleMesh.position.x = plot.x + THREE.MathUtils.randFloat(-DERIVED.plotStep / 3, DERIVED.plotStep / 3);
                    vehicleMesh.position.z = plot.z + laneOffset;
                } else {
                    vehicleMesh.position.x = plot.x + laneOffset;
                    vehicleMesh.position.z = plot.z + THREE.MathUtils.randFloat(-DERIVED.plotStep / 3, DERIVED.plotStep / 3);
                }

                const angle = Math.atan2(direction.x, direction.z);
                vehicleMesh.rotation.y = angle;

                this.vehicles.push({
                    mesh: vehicleMesh,
                    speed: THREE.MathUtils.randFloat(vehicleType.speedRange[0], vehicleType.speedRange[1]),
                    direction: direction
                });
                
                placed = true;
            }
            attempts++;
        }
        
        return placed;
    }

    updateTraffic(deltaTime, cityGrid) {
        const turnThreshold = CONFIG.buildingPlotSize / 2;

        this.vehicles.forEach(vehicle => {
            // Verificación de evitación de obstáculos
            const potentialPosition = vehicle.mesh.position.clone()
                .addScaledVector(vehicle.direction, vehicle.speed * deltaTime * 1.5);
            const gridX = Math.floor((potentialPosition.x + DERIVED.halfCitySize) / DERIVED.plotStep);
            const gridZ = Math.floor((potentialPosition.z + DERIVED.halfCitySize) / DERIVED.plotStep);

            let forcedTurn = false;
            if (gridX >= 0 && gridX < DERIVED.gridSize && gridZ >= 0 && gridZ < DERIVED.gridSize) {
                const nextPlotType = cityGrid[gridX][gridZ].type;
                if (nextPlotType === 'building' || nextPlotType === 'park') {
                    // ¡Obstáculo adelante! Forzar giro
                    const turnAngle = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
                    vehicle.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), turnAngle);
                    const angle = Math.atan2(vehicle.direction.x, vehicle.direction.z);
                    vehicle.mesh.rotation.y = angle;
                    forcedTurn = true;
                }
            }

            // Mover el vehículo
            vehicle.mesh.position.addScaledVector(vehicle.direction, vehicle.speed * deltaTime);

            let turnedByBoundary = false;
            // Verificación de límites y lógica de giro
            if (Math.abs(vehicle.mesh.position.x) > DERIVED.halfCitySize - turnThreshold || 
                Math.abs(vehicle.mesh.position.z) > DERIVED.halfCitySize - turnThreshold) {
                
                if (Math.random() < 0.5) {
                    const currentAxis = Math.abs(vehicle.direction.x) > 0.1 ? 'x' : 'z';
                    const newDir = new THREE.Vector3();
                    
                    if (currentAxis === 'x') {
                        newDir.z = Math.sign(vehicle.mesh.position.z) || (Math.random() > 0.5 ? 1 : -1);
                    } else {
                        newDir.x = Math.sign(vehicle.mesh.position.x) || (Math.random() > 0.5 ? 1 : -1);
                    }
                    
                    newDir.normalize();
                    vehicle.direction.copy(newDir);
                    
                    const angle = Math.atan2(vehicle.direction.x, vehicle.direction.z);
                    vehicle.mesh.rotation.y = angle;
                    
                    turnedByBoundary = true;
                }
            }

            // Si no giró cerca del borde, envolver alrededor
            if (!forcedTurn && !turnedByBoundary) {
                if (Math.abs(vehicle.mesh.position.x) > DERIVED.halfCitySize) {
                    vehicle.mesh.position.x = Math.sign(vehicle.mesh.position.x) * -DERIVED.halfCitySize * 0.98;
                }
                if (Math.abs(vehicle.mesh.position.z) > DERIVED.halfCitySize) {
                    vehicle.mesh.position.z = Math.sign(vehicle.mesh.position.z) * -DERIVED.halfCitySize * 0.98;
                }
            }
        });
    }

    clearTraffic() {
        this.vehicles.forEach(vehicle => {
            vehicle.mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.scene.remove(vehicle.mesh);
        });
        this.vehicles = [];
    }

    dispose() {
        this.clearTraffic();
    }
}