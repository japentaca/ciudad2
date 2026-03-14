// Módulo de sistema de tráfico
import * as THREE from 'three';
import { CONFIG, runtimeState } from './config.js';

export class TrafficManager {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];
    this.carModel = null;
    this.truckModel = null;
    this.navigationData = null;
    this.intersectionLookup = new Map();
    this.intersectionLinks = new Map();
    this.signalVisuals = [];
    this.signalClock = 0;
  }

  setModels(carModel, truckModel) {
    this.carModel = carModel;
    this.truckModel = truckModel;
  }

  setVehicleCount(count) {
    runtimeState.numVehicles = count;
  }

  setNavigationData(navigationData) {
    this.navigationData = navigationData;
    this.signalClock = 0;
    this.buildIntersectionGraph();
    this.createTrafficSignals();
  }

  buildIntersectionGraph() {
    this.intersectionLookup = new Map();
    this.intersectionLinks = new Map();

    if (!this.navigationData) {
      return;
    }

    const rows = new Map();
    const columns = new Map();

    this.navigationData.intersections.forEach(intersection => {
      this.intersectionLookup.set(intersection.id, intersection);
      this.intersectionLinks.set(intersection.id, []);

      if (!rows.has(intersection.gridZ)) rows.set(intersection.gridZ, []);
      if (!columns.has(intersection.gridX)) columns.set(intersection.gridX, []);

      rows.get(intersection.gridZ).push(intersection);
      columns.get(intersection.gridX).push(intersection);
    });

    rows.forEach(intersections => {
      intersections.sort((left, right) => left.gridX - right.gridX);
      for (let index = 0; index < intersections.length - 1; index++) {
        this.linkIntersections(intersections[index], intersections[index + 1]);
      }
    });

    columns.forEach(intersections => {
      intersections.sort((left, right) => left.gridZ - right.gridZ);
      for (let index = 0; index < intersections.length - 1; index++) {
        this.linkIntersections(intersections[index], intersections[index + 1]);
      }
    });
  }

  linkIntersections(from, to) {
    const fromLinks = this.intersectionLinks.get(from.id) || [];
    const toLinks = this.intersectionLinks.get(to.id) || [];

    if (!fromLinks.includes(to.id)) fromLinks.push(to.id);
    if (!toLinks.includes(from.id)) toLinks.push(from.id);

    this.intersectionLinks.set(from.id, fromLinks);
    this.intersectionLinks.set(to.id, toLinks);
  }

  createTrafficSignals() {
    this.clearTrafficSignals();

    if (!this.navigationData) {
      return;
    }

    this.navigationData.intersections.forEach(intersection => {
      if (!intersection.signalized) {
        return;
      }

      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 4.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })
      );
      pole.position.set(-2.8, 2.4, -2.8);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.6, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.8 })
      );
      housing.position.set(-2.1, 4.1, -2.1);

      const xLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      xLamp.position.set(-2.1, 4.45, -1.9);

      const zLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      zLamp.position.set(-1.85, 3.85, -2.1);

      group.add(pole, housing, xLamp, zLamp);
      group.position.set(intersection.x, 0, intersection.z);
      group.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(group);
      this.signalVisuals.push({ group, xLamp, zLamp, intersectionId: intersection.id });
    });

    this.updateSignalVisuals();
  }

  createTraffic(cityGrid, navigationData = this.navigationData) {
    this.clearTraffic();
    if (navigationData && navigationData !== this.navigationData) {
      this.setNavigationData(navigationData);
    }
    if (!this.navigationData || this.navigationData.intersections.length < 2) {
      return;
    }

    const vehicleTypes = [
      { type: 'car', speedRange: [22, 34] },
      { type: 'truck', speedRange: [16, 24] }
    ];

    for (let index = 0; index < runtimeState.numVehicles; index++) {
      const vehicleType = vehicleTypes[THREE.MathUtils.randInt(0, vehicleTypes.length - 1)];
      const vehicleMesh = this.createVehicleMesh(vehicleType.type);
      const vehicle = {
        mesh: vehicleMesh,
        type: vehicleType.type,
        speed: THREE.MathUtils.randFloat(vehicleType.speedRange[0], vehicleType.speedRange[1]),
        currentSpeed: 0,
        previousIntersectionId: null,
        currentIntersectionId: null,
        nextIntersectionId: null,
        direction: new THREE.Vector3(1, 0, 0),
        segmentStart: new THREE.Vector3(),
        segmentEnd: new THREE.Vector3()
      };

      if (!this.placeVehicleOnNetwork(vehicle)) {
        this.disposeVehicleMesh(vehicle.mesh);
        continue;
      }

      this.scene.add(vehicle.mesh);
      this.vehicles.push(vehicle);
    }
  }

  createVehicleMesh(type) {
    let vehicleMesh;

    if (type === 'car') {
      if (this.carModel) {
        vehicleMesh = this.carModel.clone();
        vehicleMesh.userData.disposeGeometry = false;
        this.applyRandomMaterial(vehicleMesh);
        vehicleMesh.scale.setScalar(10);
        const carBox = new THREE.Box3().setFromObject(vehicleMesh);
        vehicleMesh.position.y = -carBox.min.y + 0.1;
      } else {
        vehicleMesh = this.createFallbackCar(this.createVehicleMaterial(type));
      }
    } else if (this.truckModel) {
      vehicleMesh = this.truckModel.clone();
      vehicleMesh.userData.disposeGeometry = false;
      this.applyRandomMaterial(vehicleMesh);
      vehicleMesh.scale.setScalar(12);
      const truckBox = new THREE.Box3().setFromObject(vehicleMesh);
      vehicleMesh.position.y = -truckBox.min.y + 0.1;
    } else {
      vehicleMesh = this.createFallbackTruck(this.createVehicleMaterial(type));
    }

    vehicleMesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    return vehicleMesh;
  }

  createVehicleMaterial(type) {
    if (type === 'truck') {
      return new THREE.MeshStandardMaterial({
        color: Math.random() * 0x888888 + 0x444444,
        roughness: 0.8,
        metalness: 0.1
      });
    }

    return new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
      roughness: 0.6,
      metalness: 0.2
    });
  }

  applyRandomMaterial(vehicleMesh) {
    vehicleMesh.traverse(child => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(material => {
            const clonedMaterial = material.clone();
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
      }
    });
  }

  createFallbackCar(material) {
    const geometry = new THREE.BoxGeometry(4.5, 1.5, 2.5);
    const vehicleMesh = new THREE.Mesh(geometry, material);
    vehicleMesh.userData.disposeGeometry = true;
    vehicleMesh.position.y = 0.85;
    vehicleMesh.castShadow = true;
    return vehicleMesh;
  }

  createFallbackTruck(material) {
    const geometry = new THREE.BoxGeometry(9, 2.8, 3);
    const vehicleMesh = new THREE.Mesh(geometry, material);
    vehicleMesh.userData.disposeGeometry = true;
    vehicleMesh.position.y = 1.5;
    vehicleMesh.castShadow = true;
    return vehicleMesh;
  }

  placeVehicleOnNetwork(vehicle) {
    const candidates = Array.from(this.intersectionLinks.entries()).filter(([, links]) => links.length > 0);
    if (!candidates.length) {
      return false;
    }

    const [fromId, links] = candidates[THREE.MathUtils.randInt(0, candidates.length - 1)];
    const toId = links[THREE.MathUtils.randInt(0, links.length - 1)];

    if (!this.configureVehicleSegment(vehicle, null, fromId, toId)) {
      return false;
    }

    const spawnRatio = THREE.MathUtils.randFloat(0.1, 0.8);
    vehicle.mesh.position.lerpVectors(vehicle.segmentStart, vehicle.segmentEnd, spawnRatio);
    vehicle.currentSpeed = vehicle.speed * THREE.MathUtils.randFloat(0.55, 0.95);
    return true;
  }

  configureVehicleSegment(vehicle, previousId, currentId, nextId) {
    const current = this.intersectionLookup.get(currentId);
    const next = this.intersectionLookup.get(nextId);
    if (!current || !next) {
      return false;
    }

    const laneOffsetVector = this.getLaneOffsetVector(current, next);
    vehicle.previousIntersectionId = previousId;
    vehicle.currentIntersectionId = currentId;
    vehicle.nextIntersectionId = nextId;
    vehicle.segmentStart.copy(new THREE.Vector3(current.x, vehicle.mesh.position.y, current.z).add(laneOffsetVector));
    vehicle.segmentEnd.copy(new THREE.Vector3(next.x, vehicle.mesh.position.y, next.z).add(laneOffsetVector));
    vehicle.direction.copy(new THREE.Vector3().subVectors(vehicle.segmentEnd, vehicle.segmentStart).normalize());
    vehicle.mesh.rotation.y = Math.atan2(vehicle.direction.x, vehicle.direction.z);
    return true;
  }

  getLaneOffsetVector(from, to) {
    const direction = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    if (Math.abs(direction.x) > 0.5) {
      return new THREE.Vector3(0, 0, direction.x > 0 ? -CONFIG.traffic.laneOffset : CONFIG.traffic.laneOffset);
    }

    return new THREE.Vector3(direction.z > 0 ? CONFIG.traffic.laneOffset : -CONFIG.traffic.laneOffset, 0, 0);
  }

  getSignalState(intersectionId) {
    const intersection = this.intersectionLookup.get(intersectionId);
    if (!intersection || !intersection.signalized) {
      return { greenAxis: 'x' };
    }

    const cycle = CONFIG.traffic.lightCycleDuration;
    const phase = (this.signalClock + intersection.phaseOffset) % cycle;
    return { greenAxis: phase < cycle / 2 ? 'x' : 'z' };
  }

  isPedestrianCrossingAllowed(intersectionId, axis) {
    return this.getSignalState(intersectionId).greenAxis !== axis;
  }

  shouldVehicleStop(vehicle, distanceToTarget) {
    if (distanceToTarget > CONFIG.traffic.stopDistance) {
      return false;
    }

    const nextIntersection = this.intersectionLookup.get(vehicle.nextIntersectionId);
    if (!nextIntersection || !nextIntersection.signalized) {
      return false;
    }

    const axis = Math.abs(vehicle.direction.x) > Math.abs(vehicle.direction.z) ? 'x' : 'z';
    return this.getSignalState(vehicle.nextIntersectionId).greenAxis !== axis;
  }

  pickNextIntersection(vehicle, atIntersectionId) {
    const neighbors = [...(this.intersectionLinks.get(atIntersectionId) || [])];
    if (!neighbors.length) {
      return null;
    }

    let candidates = neighbors.filter(id => id !== vehicle.previousIntersectionId);
    if (!candidates.length) {
      candidates = neighbors;
    }

    const current = this.intersectionLookup.get(atIntersectionId);
    const previous = vehicle.previousIntersectionId ? this.intersectionLookup.get(vehicle.previousIntersectionId) : null;

    if (previous && Math.random() > CONFIG.traffic.turnChance) {
      const incoming = new THREE.Vector3(current.x - previous.x, 0, current.z - previous.z).normalize();
      const straightCandidate = candidates.find(candidateId => {
        const candidate = this.intersectionLookup.get(candidateId);
        const outgoing = new THREE.Vector3(candidate.x - current.x, 0, candidate.z - current.z).normalize();
        return incoming.dot(outgoing) > 0.9;
      });

      if (straightCandidate) {
        return straightCandidate;
      }
    }

    return candidates[THREE.MathUtils.randInt(0, candidates.length - 1)];
  }

  updateTraffic(deltaTime) {
    this.signalClock += deltaTime;
    this.updateSignalVisuals();

    this.vehicles.forEach(vehicle => {
      const toTarget = new THREE.Vector3().subVectors(vehicle.segmentEnd, vehicle.mesh.position);
      const distanceToTarget = toTarget.length();
      const shouldStop = this.shouldVehicleStop(vehicle, distanceToTarget);
      const targetSpeed = shouldStop ? 0 : vehicle.speed * CONFIG.traffic.speedMultiplier;
      vehicle.currentSpeed = THREE.MathUtils.lerp(vehicle.currentSpeed, targetSpeed, deltaTime * 3.5);
      const travelDistance = vehicle.currentSpeed * deltaTime;

      if (!shouldStop && distanceToTarget > 0 && travelDistance >= distanceToTarget) {
        vehicle.mesh.position.copy(vehicle.segmentEnd);
        const currentIntersectionId = vehicle.nextIntersectionId;
        const nextIntersectionId = this.pickNextIntersection(vehicle, currentIntersectionId);
        if (!nextIntersectionId) {
          return;
        }

        this.configureVehicleSegment(
          vehicle,
          vehicle.currentIntersectionId,
          currentIntersectionId,
          nextIntersectionId
        );
        return;
      }

      if (!shouldStop && distanceToTarget <= CONFIG.traffic.intersectionArrivalThreshold) {
        vehicle.mesh.position.copy(vehicle.segmentEnd);
        const currentIntersectionId = vehicle.nextIntersectionId;
        const nextIntersectionId = this.pickNextIntersection(vehicle, currentIntersectionId);
        if (!nextIntersectionId) {
          return;
        }

        this.configureVehicleSegment(
          vehicle,
          vehicle.currentIntersectionId,
          currentIntersectionId,
          nextIntersectionId
        );
        return;
      }

      if (vehicle.currentSpeed > 0.01) {
        vehicle.mesh.position.addScaledVector(vehicle.direction, travelDistance);
      }
    });
  }

  updateSignalVisuals() {
    this.signalVisuals.forEach(signal => {
      const { greenAxis } = this.getSignalState(signal.intersectionId);
      signal.xLamp.material.color.set(greenAxis === 'x' ? 0x3cff7f : 0xff3c3c);
      signal.zLamp.material.color.set(greenAxis === 'z' ? 0x3cff7f : 0xff3c3c);
    });
  }

  clearTrafficSignals() {
    this.signalVisuals.forEach(signal => {
      signal.group.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      this.scene.remove(signal.group);
    });
    this.signalVisuals = [];
  }

  disposeVehicleMesh(mesh) {
    const disposeGeometry = mesh.userData.disposeGeometry === true;
    mesh.traverse(child => {
      if (child.isMesh) {
        if (disposeGeometry && child.geometry) {
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
  }

  clearTraffic() {
    this.vehicles.forEach(vehicle => {
      this.disposeVehicleMesh(vehicle.mesh);
      this.scene.remove(vehicle.mesh);
    });
    this.vehicles = [];
  }

  getVehicleCount() {
    return this.vehicles.length;
  }

  dispose() {
    this.clearTraffic();
    this.clearTrafficSignals();
  }
}