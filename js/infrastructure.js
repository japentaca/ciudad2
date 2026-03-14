// Módulo de infraestructura urbana (aceras, parques, mobiliario)
import * as THREE from 'three';
import { CONFIG, DERIVED, PLOT_TYPES } from './config.js';

export class InfrastructureBuilder {
  constructor(scene) {
    this.scene = scene;
    this.sidewalkInstances = null;
    this.parks = [];
    this.streetFurniture = [];
  }

  build(cityGrid, navigationData) {
    this.createSidewalks(cityGrid);
    this.createParksAndPlazas(cityGrid);
    this.createCrosswalkMeshes(navigationData);
    this.createStreetFurniture(cityGrid);
  }

  isRoadAt(cityGrid, i, j) {
    if (i < 0 || j < 0 || i >= DERIVED.gridSize || j >= DERIVED.gridSize) return false;
    return cityGrid[i][j].type === PLOT_TYPES.ROAD;
  }

  isNearMajorRoadAt(cityGrid, i, j, layoutGenerator) {
    for (let offset = -1; offset <= 1; offset++) {
      if (layoutGenerator.roadColumns.major.has(i + offset) || layoutGenerator.roadRows.major.has(j + offset)) {
        return true;
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (layoutGenerator.cellRoadTypes.get(`${i + dx},${j + dz}`) === 'avenue') {
          return true;
        }
      }
    }
    return false;
  }

  createSidewalks(cityGrid) {
    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a,
      roughness: 0.92
    });
    const sidewalkGeometry = new THREE.BoxGeometry(1, 1, 1);
    sidewalkGeometry.translate(0, 0.5, 0);

    const maxSidewalks = DERIVED.gridSize * DERIVED.gridSize * 4;
    this.sidewalkInstances = new THREE.InstancedMesh(sidewalkGeometry, sidewalkMaterial, maxSidewalks);
    this.sidewalkInstances.castShadow = false;
    this.sidewalkInstances.receiveShadow = true;
    this.scene.add(this.sidewalkInstances);

    let sidewalkCount = 0;
    const dummySidewalk = new THREE.Object3D();
    const halfPlotStep = DERIVED.plotStep / 2;
    const halfPavementWidth = CONFIG.pavementWidth / 2;

    for (let i = 0; i < DERIVED.gridSize; i++) {
      for (let j = 0; j < DERIVED.gridSize; j++) {
        const plot = cityGrid[i][j];
        if (plot.type !== PLOT_TYPES.BUILDING && plot.type !== PLOT_TYPES.PARK && plot.type !== PLOT_TYPES.PLAZA) {
          continue;
        }

        const sidewalkTargets = [
          { visible: this.isRoadAt(cityGrid, i, j + 1), position: [plot.x, CONFIG.sidewalkHeight / 2, plot.z + halfPlotStep - halfPavementWidth], scale: [DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth] },
          { visible: this.isRoadAt(cityGrid, i, j - 1), position: [plot.x, CONFIG.sidewalkHeight / 2, plot.z - halfPlotStep + halfPavementWidth], scale: [DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth] },
          { visible: this.isRoadAt(cityGrid, i + 1, j), position: [plot.x + halfPlotStep - halfPavementWidth, CONFIG.sidewalkHeight / 2, plot.z], scale: [CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep] },
          { visible: this.isRoadAt(cityGrid, i - 1, j), position: [plot.x - halfPlotStep + halfPavementWidth, CONFIG.sidewalkHeight / 2, plot.z], scale: [CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep] }
        ];

        sidewalkTargets.forEach(target => {
          if (!target.visible || sidewalkCount >= maxSidewalks) return;
          dummySidewalk.position.set(...target.position);
          dummySidewalk.scale.set(...target.scale);
          dummySidewalk.updateMatrix();
          this.sidewalkInstances.setMatrixAt(sidewalkCount++, dummySidewalk.matrix);
        });
      }
    }

    this.sidewalkInstances.count = sidewalkCount;
    this.sidewalkInstances.instanceMatrix.needsUpdate = true;
  }

  createParksAndPlazas(cityGrid) {
    for (let i = 0; i < DERIVED.gridSize; i++) {
      for (let j = 0; j < DERIVED.gridSize; j++) {
        const plot = cityGrid[i][j];
        if (plot.type !== PLOT_TYPES.PARK && plot.type !== PLOT_TYPES.PLAZA) continue;

        const isPark = plot.type === PLOT_TYPES.PARK;
        const baseGeometry = new THREE.PlaneGeometry(CONFIG.buildingPlotSize, CONFIG.buildingPlotSize);
        const baseMaterial = new THREE.MeshStandardMaterial({
          color: isPark ? 0x5e8b4d : 0x9f9787,
          roughness: isPark ? 0.95 : 0.82
        });
        const basePlane = new THREE.Mesh(baseGeometry, baseMaterial);
        basePlane.rotation.x = -Math.PI / 2;
        basePlane.position.set(plot.x, 0.11, plot.z);
        basePlane.receiveShadow = true;
        this.scene.add(basePlane);
        this.parks.push(basePlane);

        if (isPark) {
          const treeCount = THREE.MathUtils.randInt(3, 7);
          for (let count = 0; count < treeCount; count++) {
            const tree = this.createSimpleTree();
            tree.position.set(
              plot.x + THREE.MathUtils.randFloat(-CONFIG.buildingPlotSize / 2.8, CONFIG.buildingPlotSize / 2.8),
              0,
              plot.z + THREE.MathUtils.randFloat(-CONFIG.buildingPlotSize / 2.8, CONFIG.buildingPlotSize / 2.8)
            );
            this.scene.add(tree);
            this.parks.push(tree);
          }
        } else {
          const monument = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8, 2.6, 10, 10),
            new THREE.MeshStandardMaterial({ color: 0xc6b79a, metalness: 0.2, roughness: 0.7 })
          );
          monument.position.set(plot.x, 5, plot.z);
          monument.castShadow = true;
          monument.receiveShadow = true;
          this.scene.add(monument);
          this.parks.push(monument);
        }
      }
    }
  }

  createSimpleTree() {
    const trunkHeight = THREE.MathUtils.randFloat(4, 8);
    const leavesHeight = THREE.MathUtils.randFloat(5, 10);

    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, trunkHeight, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;

    const leavesGeo = new THREE.ConeGeometry(leavesHeight / 2, leavesHeight, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = trunkHeight + leavesHeight / 2;
    leaves.castShadow = true;

    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(leaves);
    return tree;
  }

  createCrosswalkMeshes(navigationData) {
    const crosswalkSpan = CONFIG.roadWidth * 0.72;
    const stripeThickness = 1.35;
    const stripeSpacing = 2.4;
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.82 });

    navigationData.crosswalks.forEach(crosswalk => {
      const group = new THREE.Group();

      for (let index = -2; index <= 2; index++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(
            crosswalk.axis === 'x' ? stripeThickness : crosswalkSpan,
            0.04,
            crosswalk.axis === 'x' ? crosswalkSpan : stripeThickness
          ),
          stripeMaterial
        );

        if (crosswalk.axis === 'x') {
          stripe.position.set(crosswalk.position.x + index * stripeSpacing, crosswalk.position.y, crosswalk.position.z);
        } else {
          stripe.position.set(crosswalk.position.x, crosswalk.position.y, crosswalk.position.z + index * stripeSpacing);
        }

        stripe.receiveShadow = true;
        group.add(stripe);
      }

      this.scene.add(group);
      this.streetFurniture.push(group);
    });
  }

  createStreetFurniture(cityGrid, layoutGenerator) {
    for (let i = 0; i < DERIVED.gridSize; i++) {
      for (let j = 0; j < DERIVED.gridSize; j++) {
        const plot = cityGrid[i][j];
        if (plot.type === PLOT_TYPES.PARK || plot.type === PLOT_TYPES.PLAZA) {
          this.addBench(plot.x - 8, plot.z + 8, Math.PI * 0.35);
          this.addBench(plot.x + 8, plot.z - 8, -Math.PI * 0.35);
          this.addBin(plot.x + 10, plot.z + 10);
          continue;
        }

        if (plot.type !== PLOT_TYPES.BUILDING) continue;

        if (Math.random() < 0.18) {
          this.addSignPost(plot.x + CONFIG.buildingPlotSize * 0.45, plot.z - CONFIG.buildingPlotSize * 0.25);
        }

        if (plot.district === 'commercial' && Math.random() < 0.12) {
          this.addBusStop(plot.x - CONFIG.buildingPlotSize * 0.4, plot.z + CONFIG.buildingPlotSize * 0.22);
        }
      }
    }
  }

  addBench(x, z, rotation = 0) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
    );
    seat.position.y = 2.1;
    const legs = [-1.8, 1.8].map(offset => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 2, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.2, roughness: 0.7 })
      );
      leg.position.set(offset, 1, 0);
      return leg;
    });
    bench.add(seat, ...legs);
    bench.position.set(x, 0, z);
    bench.rotation.y = rotation;
    bench.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(bench);
    this.streetFurniture.push(bench);
  }

  addBin(x, z) {
    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4b5964, metalness: 0.35, roughness: 0.6 })
    );
    bin.position.set(x, 1.2, z);
    bin.castShadow = true;
    bin.receiveShadow = true;
    this.scene.add(bin);
    this.streetFurniture.push(bin);
  }

  addSignPost(x, z) {
    const post = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x656565, metalness: 0.3, roughness: 0.65 })
    );
    pole.position.y = 2.1;
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x4e79a7, roughness: 0.8 })
    );
    sign.position.set(0.8, 3.1, 0);
    post.add(pole, sign);
    post.position.set(x, 0, z);
    post.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(post);
    this.streetFurniture.push(post);
  }

  addBusStop(x, z) {
    const stop = new THREE.Group();
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.3, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x7a8b99, metalness: 0.2, roughness: 0.7 })
    );
    roof.position.set(0, 3.4, 0);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 2.8, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xa9d3f5, transparent: true, opacity: 0.45 })
    );
    glass.position.set(-2.7, 1.5, 0);
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.25, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x805b33, roughness: 0.85 })
    );
    bench.position.set(0.4, 1.1, 0);
    stop.add(roof, glass, bench);
    stop.position.set(x, 0, z);
    stop.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(stop);
    this.streetFurniture.push(stop);
  }

  clearDisposableObjects(objects) {
    objects.forEach(object => {
      this.scene.remove(object);
      object.traverse(child => {
        if (!child.isMesh) return;
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
  }

  clear() {
    if (this.sidewalkInstances) {
      this.scene.remove(this.sidewalkInstances);
      this.sidewalkInstances.geometry.dispose();
      this.sidewalkInstances.material.dispose();
      this.sidewalkInstances = null;
    }

    this.clearDisposableObjects(this.parks);
    this.parks = [];

    this.clearDisposableObjects(this.streetFurniture);
    this.streetFurniture = [];
  }
}
