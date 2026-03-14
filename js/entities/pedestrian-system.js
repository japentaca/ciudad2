// Sistema avanzado de peatones con modelos FBX animados
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CONFIG } from '../config.js';

export class PedestrianSystem {
  constructor(scene) {
    this.scene = scene;
    this.pedestrians = [];
    this.fbxLoader = new FBXLoader();
    this.walkingModel = null;
    this.walkingAnimations = [];
    this.isModelLoaded = false;
    this.navigationNetwork = null;
    this.signalResolver = null;
    this.config = {
      numPedestrians: CONFIG.numPedestrians,
      walkSpeed: { min: CONFIG.pedestrians.walkSpeedMin, max: CONFIG.pedestrians.walkSpeedMax },
      animationSpeed: { min: CONFIG.pedestrians.animationSpeedMin, max: CONFIG.pedestrians.animationSpeedMax },
      referenceWalkSpeed: CONFIG.pedestrians.referenceWalkSpeed,
      modelScale: CONFIG.pedestrians.modelScale,
      avoidanceRadius: CONFIG.pedestrians.avoidanceRadius,
      maxSteerForce: 0.25,
      waypointReachThreshold: CONFIG.pedestrians.waypointReachThreshold,
      crosswalkPause: CONFIG.pedestrians.crosswalkPause
    };
    this.pedestrianColors = [
      0x8b4513,
      0x000080,
      0x800080,
      0x008000,
      0x800000,
      0x000000,
      0x4b0082,
      0x2f4f4f
    ];
  }

  setNavigationNetwork(network) {
    this.navigationNetwork = network;
  }

  setSignalResolver(signalResolver) {
    this.signalResolver = signalResolver;
  }

  setPedestrianCount(count) {
    this.config.numPedestrians = count;
    CONFIG.numPedestrians = count;
  }

  setModel(model) {
    if (!model) {
      console.error('Modelo de peatón es null o undefined');
      return;
    }

    if (model.parent) {
      model.parent.remove(model);
    }

    model.scale.setScalar(this.config.modelScale);
    model.position.set(0, 0, 0);
    model.rotation.y = 0;

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        if (child.material) {
          child.material.transparent = false;
          child.material.alphaTest = 0.1;
        }
      }
    });

    this.walkingModel = model;
    this.walkingAnimations = model.animations || [];
    this.isModelLoaded = true;
  }

  async loadPedestrianModel() {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        'models/walking.fbx',
        fbx => {
          this.setModel(fbx);
          resolve(this.walkingModel);
        },
        undefined,
        error => reject(error)
      );
    });
  }

  async init() {
    if (this.isModelLoaded) {
      return;
    }

    try {
      await this.loadPedestrianModel();
    } catch (error) {
      console.error('Error inicializando sistema de peatones:', error);
      throw error;
    }
  }

  createPedestrian(position, direction) {
    if (!this.isModelLoaded || !this.walkingModel) {
      return null;
    }

    const pedestrianMesh = this.cloneModelWithAnimations(this.walkingModel);
    pedestrianMesh.scale.setScalar(this.config.modelScale);
    pedestrianMesh.position.set(0, 0, 0);

    const randomColor = this.pedestrianColors[Math.floor(Math.random() * this.pedestrianColors.length)];
    pedestrianMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.setHex(randomColor);
      }
    });

    const movementSpeed = THREE.MathUtils.randFloat(this.config.walkSpeed.min, this.config.walkSpeed.max);
    const mixer = new THREE.AnimationMixer(pedestrianMesh);
    let walkAction = null;

    if (this.walkingAnimations.length > 0) {
      const namedClip = THREE.AnimationClip.findByName(this.walkingAnimations, 'mixamo.com');
      const walkClip = namedClip || this.walkingAnimations[0];
      walkAction = mixer.clipAction(this.createInPlaceClip(walkClip));
      walkAction.setEffectiveTimeScale(this.getAnimationTimeScale(movementSpeed));
      walkAction.play();
    }

    const pedestrianContainer = new THREE.Group();
    pedestrianContainer.position.copy(position);
    pedestrianContainer.add(pedestrianMesh);

    return {
      container: pedestrianContainer,
      mesh: pedestrianMesh,
      mixer,
      walkAction,
      speed: movementSpeed,
      direction: direction.clone().normalize(),
      avoidanceForce: new THREE.Vector3(),
      currentNodeId: null,
      route: [],
      routeIndex: 0,
      activeEdge: null,
      waitTimer: 0,
      id: Math.random().toString(36).slice(2, 11)
    };
  }

  createInPlaceClip(clip) {
    const inPlaceClip = clip.clone();

    inPlaceClip.tracks = inPlaceClip.tracks.map(track => {
      const isHipPositionTrack =
        track.name.toLowerCase().includes('hips') &&
        track.name.endsWith('.position') &&
        track.getValueSize &&
        track.getValueSize() === 3;

      if (!isHipPositionTrack) {
        return track;
      }

      const values = track.values.slice();
      const baseX = values[0];
      const baseZ = values[2];

      for (let index = 0; index < values.length; index += 3) {
        values[index] = baseX;
        values[index + 2] = baseZ;
      }

      return new THREE.VectorKeyframeTrack(track.name, track.times.slice(), values);
    });

    return inPlaceClip;
  }

  getAnimationTimeScale(movementSpeed) {
    const baseScale = movementSpeed / this.config.referenceWalkSpeed;
    return THREE.MathUtils.clamp(baseScale, this.config.animationSpeed.min, this.config.animationSpeed.max);
  }

  async createPedestrians() {
    if (!this.isModelLoaded) {
      let attempts = 0;
      while (!this.isModelLoaded && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (!this.isModelLoaded) {
        console.error('Timeout esperando el modelo de peatón');
        return;
      }
    }

    this.clearPedestrians();

    if (!this.navigationNetwork || this.navigationNetwork.nodeIds.length < 2) {
      console.warn('No hay red peatonal disponible para crear peatones');
      return;
    }

    for (let index = 0; index < this.config.numPedestrians; index++) {
      const startNodeId = this.navigationNetwork.nodeIds[
        THREE.MathUtils.randInt(0, this.navigationNetwork.nodeIds.length - 1)
      ];
      const startNode = this.navigationNetwork.nodes.get(startNodeId);
      const pedestrian = this.createPedestrian(startNode.position, new THREE.Vector3(1, 0, 0));

      if (!pedestrian) {
        continue;
      }

      pedestrian.currentNodeId = startNodeId;
      pedestrian.container.position.copy(startNode.position);

      if (!this.assignRoute(pedestrian, startNodeId)) {
        pedestrian.mesh.traverse(child => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        continue;
      }

      this.pedestrians.push(pedestrian);
      this.scene.add(pedestrian.container);
    }
  }

  assignRoute(pedestrian, startNodeId) {
    let destinationNodeId = startNodeId;
    let attempts = 0;

    while (destinationNodeId === startNodeId && attempts < CONFIG.pedestrians.routeRetryLimit) {
      destinationNodeId = this.navigationNetwork.nodeIds[
        THREE.MathUtils.randInt(0, this.navigationNetwork.nodeIds.length - 1)
      ];
      attempts++;
    }

    if (destinationNodeId === startNodeId) {
      return false;
    }

    const route = this.findRoute(startNodeId, destinationNodeId);
    if (route.length < 2) {
      return false;
    }

    pedestrian.route = route;
    pedestrian.routeIndex = 1;
    pedestrian.activeEdge = this.getEdge(route[0], route[1]);
    return true;
  }

  findRoute(startNodeId, endNodeId) {
    if (startNodeId === endNodeId) {
      return [startNodeId];
    }

    const queue = [startNodeId];
    const visited = new Set([startNodeId]);
    const previous = new Map();

    while (queue.length) {
      const current = queue.shift();
      const edges = this.navigationNetwork.adjacency.get(current) || [];

      for (const edge of edges) {
        if (visited.has(edge.to)) {
          continue;
        }

        visited.add(edge.to);
        previous.set(edge.to, current);

        if (edge.to === endNodeId) {
          const route = [endNodeId];
          let cursor = endNodeId;
          while (previous.has(cursor)) {
            cursor = previous.get(cursor);
            route.unshift(cursor);
          }
          return route;
        }

        queue.push(edge.to);
      }
    }

    return [];
  }

  getEdge(fromNodeId, toNodeId) {
    return (this.navigationNetwork?.adjacency.get(fromNodeId) || []).find(edge => edge.to === toNodeId) || null;
  }

  updatePedestrians(deltaTime) {
    this.pedestrians.forEach(pedestrian => {
      if (pedestrian.mixer) {
        if (pedestrian.walkAction) {
          pedestrian.walkAction.setEffectiveTimeScale(this.getAnimationTimeScale(pedestrian.speed));
        }
        pedestrian.mixer.update(deltaTime);
      }

      if (!pedestrian.route.length || pedestrian.routeIndex >= pedestrian.route.length) {
        this.assignRoute(pedestrian, pedestrian.currentNodeId);
        return;
      }

      if (pedestrian.waitTimer > 0) {
        pedestrian.waitTimer -= deltaTime;
        return;
      }

      const targetNodeId = pedestrian.route[pedestrian.routeIndex];
      const targetNode = this.navigationNetwork.nodes.get(targetNodeId);
      if (!targetNode) {
        this.assignRoute(pedestrian, pedestrian.currentNodeId);
        return;
      }

      const activeEdge = pedestrian.activeEdge || this.getEdge(pedestrian.route[pedestrian.routeIndex - 1], targetNodeId);
      if (
        activeEdge?.type === 'crosswalk' &&
        this.signalResolver &&
        !this.signalResolver(activeEdge.intersectionId, activeEdge.axis)
      ) {
        pedestrian.waitTimer = this.config.crosswalkPause;
        return;
      }

      this.calculateAvoidanceForce(pedestrian);

      const moveVector = new THREE.Vector3().subVectors(targetNode.position, pedestrian.container.position);
      const distanceToTarget = moveVector.length();

      if (distanceToTarget <= this.config.waypointReachThreshold) {
        pedestrian.container.position.copy(targetNode.position);
        pedestrian.currentNodeId = targetNodeId;
        pedestrian.routeIndex += 1;
        pedestrian.activeEdge = pedestrian.routeIndex < pedestrian.route.length
          ? this.getEdge(pedestrian.route[pedestrian.routeIndex - 1], pedestrian.route[pedestrian.routeIndex])
          : null;

        if (pedestrian.routeIndex >= pedestrian.route.length) {
          this.assignRoute(pedestrian, pedestrian.currentNodeId);
        }

        return;
      }

      const desiredDirection = moveVector.normalize().add(pedestrian.avoidanceForce.multiplyScalar(0.35)).normalize();
      if (desiredDirection.lengthSq() > 0) {
        pedestrian.direction.lerp(desiredDirection, 0.12).normalize();
      }

      pedestrian.container.position.addScaledVector(pedestrian.direction, pedestrian.speed * deltaTime);
      pedestrian.container.rotation.y = Math.atan2(pedestrian.direction.x, pedestrian.direction.z);
      pedestrian.avoidanceForce.set(0, 0, 0);
    });
  }

  calculateAvoidanceForce(currentPedestrian) {
    const avoidanceForce = new THREE.Vector3();

    this.pedestrians.forEach(otherPedestrian => {
      if (currentPedestrian === otherPedestrian) {
        return;
      }

      const distance = currentPedestrian.container.position.distanceTo(otherPedestrian.container.position);
      if (distance < this.config.avoidanceRadius && distance > 0) {
        const separationVector = new THREE.Vector3()
          .subVectors(currentPedestrian.container.position, otherPedestrian.container.position)
          .normalize()
          .multiplyScalar(this.config.maxSteerForce / distance);

        avoidanceForce.add(separationVector);
      }
    });

    currentPedestrian.avoidanceForce.copy(avoidanceForce);
  }

  clearPedestrians() {
    this.pedestrians.forEach(pedestrian => {
      if (pedestrian.mixer) {
        pedestrian.mixer.stopAllAction();
      }

      pedestrian.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      this.scene.remove(pedestrian.container);
    });

    this.pedestrians.length = 0;
  }

  cloneModelWithAnimations(model) {
    const clone = model.clone(true);
    const sourceSkinnedMeshes = {};
    const cloneBones = {};
    const cloneSkinnedMeshes = {};

    model.traverse(node => {
      if (node.isSkinnedMesh) {
        sourceSkinnedMeshes[node.name] = node;
      }
    });

    clone.traverse(node => {
      if (node.isBone) {
        cloneBones[node.name] = node;
      }
      if (node.isSkinnedMesh) {
        cloneSkinnedMeshes[node.name] = node;
      }
    });

    for (const name in sourceSkinnedMeshes) {
      const sourceMesh = sourceSkinnedMeshes[name];
      const cloneMesh = cloneSkinnedMeshes[name];
      const orderedCloneBones = sourceMesh.skeleton.bones.map(bone => cloneBones[bone.name]);
      cloneMesh.bind(new THREE.Skeleton(orderedCloneBones, sourceMesh.skeleton.boneInverses), cloneMesh.matrixWorld);
    }

    return clone;
  }

  getPedestrianCount() {
    return this.pedestrians.length;
  }

  dispose() {
    this.clearPedestrians();

    if (this.walkingModel) {
      this.walkingModel.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}