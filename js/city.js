// Módulo de generación de ciudad
import * as THREE from 'three';
import { CONFIG, DERIVED, getDistrictConfig } from './config.js';
import { TextureManager } from './textures.js';

export class CityManager {
    constructor(scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.cityGrid = [];
        this.groundPlane = null;
        this.sidewalkInstances = null;
        this.parks = [];
        this.streetFurniture = [];
        this.navigationData = this.createEmptyNavigationData();
        this.roadColumns = { major: new Set(), minor: new Set() };
        this.roadRows = { major: new Set(), minor: new Set() };
    }

    createEmptyNavigationData() {
        return {
            intersections: [],
            intersectionMap: new Map(),
            streetLightPositions: [],
            crosswalks: [],
            pedestrianNetwork: {
                nodes: new Map(),
                adjacency: new Map(),
                nodeIds: []
            }
        };
    }

    generateCityLayout() {
        this.clearCity();
        this.cityGrid = [];
        this.navigationData = this.createEmptyNavigationData();
        this.roadColumns = this.createRoadPattern(
            DERIVED.gridSize,
            CONFIG.urban.columnRhythm,
            CONFIG.urban.columnJitter
        );
        this.roadRows = this.createRoadPattern(
            DERIVED.gridSize,
            CONFIG.urban.rowRhythm,
            CONFIG.urban.rowJitter
        );

        for (let i = 0; i < DERIVED.gridSize; i++) {
            this.cityGrid[i] = [];
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const x = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + i * DERIVED.plotStep;
                const z = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + j * DERIVED.plotStep;
                const district = this.resolveDistrict(i, j);
                const districtConfig = getDistrictConfig(district);
                const isMajorColumn = this.roadColumns.major.has(i);
                const isMajorRow = this.roadRows.major.has(j);
                const isRoadColumn = isMajorColumn || this.roadColumns.minor.has(i);
                const isRoadRow = isMajorRow || this.roadRows.minor.has(j);

                const plot = {
                    x,
                    z,
                    gridX: i,
                    gridZ: j,
                    district,
                    type: 'building',
                    roadType: null,
                    roadAxis: null,
                    isIntersection: false,
                    isLandmark: false,
                    connectedDirections: null
                };

                if (isRoadColumn || isRoadRow) {
                    plot.type = 'road';
                    plot.roadType = (isMajorColumn || isMajorRow) ? 'avenue' : 'street';
                } else {
                    const nearAvenue = this.isNearMajorRoad(i, j);
                    const parkChance = districtConfig.parkProbability ?? CONFIG.urban.parkProbability;
                    const plazaChance = nearAvenue
                        ? districtConfig.plazaProbability ?? CONFIG.urban.plazaProbability
                        : 0;
                    const randomValue = Math.random();

                    if (randomValue < plazaChance) {
                        plot.type = 'plaza';
                    } else if (randomValue < plazaChance + parkChance) {
                        plot.type = 'park';
                    } else {
                        plot.type = 'building';
                        plot.isLandmark = nearAvenue && Math.random() < (districtConfig.landmarkProbability ?? CONFIG.urban.landmarkProbability);
                    }
                }

                this.cityGrid[i][j] = plot;
            }
        }

        this.annotateRoads();
        this.buildNavigationData();
        this.createGround();
        this.createInfrastructure();

        return this.cityGrid;
    }

    createRoadPattern(length, rhythm, jitterPattern) {
        const major = new Set([Math.floor(length / 2)]);
        const minor = new Set([0, length - 1]);

        for (let index = 0; index < length; index += CONFIG.urban.avenueSpacing) {
            major.add(index);
        }

        let cursor = 0;
        let stepIndex = 0;
        while (cursor < length) {
            const jitter = jitterPattern[stepIndex % jitterPattern.length];
            minor.add(THREE.MathUtils.clamp(cursor + jitter, 0, length - 1));
            cursor += rhythm[stepIndex % rhythm.length];
            stepIndex++;
        }

        return { major, minor };
    }

    resolveDistrict(i, j) {
        const xNorm = (i / (DERIVED.gridSize - 1)) * 2 - 1;
        const zNorm = (j / (DERIVED.gridSize - 1)) * 2 - 1;
        const radial = Math.hypot(xNorm, zNorm);

        if (radial < 0.26) {
            return 'center';
        }

        if (Math.abs(zNorm) < 0.22 && radial < 0.72) {
            return 'commercial';
        }

        if (radial > 0.78 || (xNorm < -0.25 && zNorm > 0.2)) {
            return 'green';
        }

        return 'residential';
    }

    isNearMajorRoad(i, j) {
        for (let offset = -1; offset <= 1; offset++) {
            if (this.roadColumns.major.has(i + offset) || this.roadRows.major.has(j + offset)) {
                return true;
            }
        }

        return false;
    }

    annotateRoads() {
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                if (plot.type !== 'road') {
                    continue;
                }

                const connectedDirections = {
                    north: this.isRoad(i, j + 1),
                    south: this.isRoad(i, j - 1),
                    east: this.isRoad(i + 1, j),
                    west: this.isRoad(i - 1, j)
                };

                const horizontal = connectedDirections.east || connectedDirections.west;
                const vertical = connectedDirections.north || connectedDirections.south;

                plot.connectedDirections = connectedDirections;
                plot.isIntersection = horizontal && vertical;
                plot.roadAxis = plot.isIntersection ? 'intersection' : (horizontal ? 'x' : 'z');
            }
        }
    }

    isRoad(i, j) {
        if (i < 0 || j < 0 || i >= DERIVED.gridSize || j >= DERIVED.gridSize) {
            return false;
        }

        return this.cityGrid[i][j].type === 'road';
    }

    buildNavigationData() {
        const { pedestrianNetwork } = this.navigationData;
        const cornerOffset = DERIVED.plotStep / 2 - CONFIG.pavementWidth / 2;
        const intersectionsByRow = new Map();
        const intersectionsByColumn = new Map();

        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                if (!plot.isIntersection) {
                    continue;
                }

                const intersectionId = `${i}:${j}`;
                const intersection = {
                    id: intersectionId,
                    gridX: i,
                    gridZ: j,
                    x: plot.x,
                    z: plot.z,
                    roadType: plot.roadType,
                    signalized: plot.roadType === 'avenue' || Math.random() < 0.45,
                    phaseOffset: ((i + j) % 3) * (CONFIG.traffic.lightCycleDuration / 3),
                    nodeIds: {}
                };

                const corners = {
                    nw: new THREE.Vector3(plot.x - cornerOffset, 0.15, plot.z + cornerOffset),
                    ne: new THREE.Vector3(plot.x + cornerOffset, 0.15, plot.z + cornerOffset),
                    sw: new THREE.Vector3(plot.x - cornerOffset, 0.15, plot.z - cornerOffset),
                    se: new THREE.Vector3(plot.x + cornerOffset, 0.15, plot.z - cornerOffset)
                };

                Object.entries(corners).forEach(([corner, position]) => {
                    const nodeId = `${intersectionId}:${corner}`;
                    intersection.nodeIds[corner] = nodeId;
                    this.addPedestrianNode(nodeId, position, {
                        kind: 'corner',
                        intersectionId,
                        district: plot.district
                    });
                });

                this.addIntersectionCrosswalks(intersection, plot);

                const streetLightOffset = DERIVED.plotStep / 2 - CONFIG.pavementWidth * 0.8;
                this.navigationData.streetLightPositions.push(
                    new THREE.Vector3(plot.x - streetLightOffset, 0, plot.z - streetLightOffset),
                    new THREE.Vector3(plot.x + streetLightOffset, 0, plot.z - streetLightOffset),
                    new THREE.Vector3(plot.x - streetLightOffset, 0, plot.z + streetLightOffset),
                    new THREE.Vector3(plot.x + streetLightOffset, 0, plot.z + streetLightOffset)
                );

                this.navigationData.intersections.push(intersection);
                this.navigationData.intersectionMap.set(intersectionId, intersection);

                if (!intersectionsByRow.has(j)) {
                    intersectionsByRow.set(j, []);
                }
                if (!intersectionsByColumn.has(i)) {
                    intersectionsByColumn.set(i, []);
                }
                intersectionsByRow.get(j).push(intersection);
                intersectionsByColumn.get(i).push(intersection);
            }
        }

        intersectionsByRow.forEach(rowIntersections => {
            rowIntersections.sort((left, right) => left.gridX - right.gridX);
            for (let index = 0; index < rowIntersections.length - 1; index++) {
                const current = rowIntersections[index];
                const next = rowIntersections[index + 1];
                this.addPedestrianEdge(current.nodeIds.ne, next.nodeIds.nw, { type: 'sidewalk' });
                this.addPedestrianEdge(current.nodeIds.se, next.nodeIds.sw, { type: 'sidewalk' });
            }
        });

        intersectionsByColumn.forEach(columnIntersections => {
            columnIntersections.sort((left, right) => left.gridZ - right.gridZ);
            for (let index = 0; index < columnIntersections.length - 1; index++) {
                const current = columnIntersections[index];
                const next = columnIntersections[index + 1];
                this.addPedestrianEdge(current.nodeIds.nw, next.nodeIds.sw, { type: 'sidewalk' });
                this.addPedestrianEdge(current.nodeIds.ne, next.nodeIds.se, { type: 'sidewalk' });
            }
        });

        pedestrianNetwork.nodeIds = Array.from(pedestrianNetwork.nodes.keys());
    }

    addIntersectionCrosswalks(intersection, plot) {
        const hasMajorRow = this.roadRows.major.has(intersection.gridZ);
        const hasMajorColumn = this.roadColumns.major.has(intersection.gridX);
        const localPatternSelector = (intersection.gridX + intersection.gridZ) % 4;
        const axes = [];

        if (hasMajorRow && hasMajorColumn) {
            axes.push('x', 'z');
        } else if (hasMajorRow) {
            axes.push('x');
        } else if (hasMajorColumn) {
            axes.push('z');
        } else if (intersection.signalized && localPatternSelector === 0) {
            axes.push('x');
        } else if (intersection.signalized && localPatternSelector === 2) {
            axes.push('z');
        } else if (!intersection.signalized && localPatternSelector === 0) {
            axes.push(intersection.gridX % 2 === 0 ? 'x' : 'z');
        }

        axes.forEach(axis => {
            if (axis === 'x') {
                this.addPedestrianEdge(intersection.nodeIds.nw, intersection.nodeIds.ne, {
                    type: 'crosswalk',
                    axis,
                    intersectionId: intersection.id
                });
                this.addPedestrianEdge(intersection.nodeIds.sw, intersection.nodeIds.se, {
                    type: 'crosswalk',
                    axis,
                    intersectionId: intersection.id
                });

                this.navigationData.crosswalks.push(
                    { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x, 0.03, plot.z + DERIVED.plotStep * 0.24) },
                    { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x, 0.03, plot.z - DERIVED.plotStep * 0.24) }
                );
                return;
            }

            this.addPedestrianEdge(intersection.nodeIds.nw, intersection.nodeIds.sw, {
                type: 'crosswalk',
                axis,
                intersectionId: intersection.id
            });
            this.addPedestrianEdge(intersection.nodeIds.ne, intersection.nodeIds.se, {
                type: 'crosswalk',
                axis,
                intersectionId: intersection.id
            });

            this.navigationData.crosswalks.push(
                { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x - DERIVED.plotStep * 0.24, 0.03, plot.z) },
                { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x + DERIVED.plotStep * 0.24, 0.03, plot.z) }
            );
        });
    }

    addPedestrianNode(id, position, meta = {}) {
        const { pedestrianNetwork } = this.navigationData;
        pedestrianNetwork.nodes.set(id, { id, position, ...meta });
        pedestrianNetwork.adjacency.set(id, pedestrianNetwork.adjacency.get(id) || []);
    }

    addPedestrianEdge(from, to, meta = {}) {
        const { adjacency } = this.navigationData.pedestrianNetwork;
        const existingFrom = adjacency.get(from) || [];
        const existingTo = adjacency.get(to) || [];

        if (!existingFrom.some(edge => edge.to === to)) {
            existingFrom.push({ to, ...meta });
        }
        if (!existingTo.some(edge => edge.to === from)) {
            existingTo.push({ to: from, ...meta });
        }

        adjacency.set(from, existingFrom);
        adjacency.set(to, existingTo);
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

    createInfrastructure() {
        this.createSidewalks();
        this.createParksAndPlazas();
        this.createCrosswalkMeshes();
        this.createStreetFurniture();
    }

    createSidewalks() {
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
                const plot = this.cityGrid[i][j];
                if (plot.type !== 'building' && plot.type !== 'park' && plot.type !== 'plaza') {
                    continue;
                }

                const sidewalkTargets = [
                    { visible: this.isRoad(i, j + 1), position: [plot.x, CONFIG.sidewalkHeight / 2, plot.z + halfPlotStep - halfPavementWidth], scale: [DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth] },
                    { visible: this.isRoad(i, j - 1), position: [plot.x, CONFIG.sidewalkHeight / 2, plot.z - halfPlotStep + halfPavementWidth], scale: [DERIVED.plotStep, CONFIG.sidewalkHeight, CONFIG.pavementWidth] },
                    { visible: this.isRoad(i + 1, j), position: [plot.x + halfPlotStep - halfPavementWidth, CONFIG.sidewalkHeight / 2, plot.z], scale: [CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep] },
                    { visible: this.isRoad(i - 1, j), position: [plot.x - halfPlotStep + halfPavementWidth, CONFIG.sidewalkHeight / 2, plot.z], scale: [CONFIG.pavementWidth, CONFIG.sidewalkHeight, DERIVED.plotStep] }
                ];

                sidewalkTargets.forEach(target => {
                    if (!target.visible || sidewalkCount >= maxSidewalks) {
                        return;
                    }

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

    createParksAndPlazas() {
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                if (plot.type !== 'park' && plot.type !== 'plaza') {
                    continue;
                }

                const isPark = plot.type === 'park';
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

    createCrosswalkMeshes() {
        this.navigationData.crosswalks.forEach(crosswalk => {
            const group = new THREE.Group();
            const crosswalkSpan = crosswalk.axis === 'x'
                ? CONFIG.roadWidth * 0.72
                : CONFIG.roadWidth * 0.72;
            const stripeThickness = 1.35;
            const stripeLength = 2.4;
            const stripeSpacing = 2.4;
            const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.82 });

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

    createStreetFurniture() {
        for (let i = 0; i < DERIVED.gridSize; i++) {
            for (let j = 0; j < DERIVED.gridSize; j++) {
                const plot = this.cityGrid[i][j];
                if (plot.type === 'park' || plot.type === 'plaza') {
                    this.addBench(plot.x - 8, plot.z + 8, Math.PI * 0.35);
                    this.addBench(plot.x + 8, plot.z - 8, -Math.PI * 0.35);
                    this.addBin(plot.x + 10, plot.z + 10);
                    continue;
                }

                if (plot.type !== 'building' || !this.isNearMajorRoad(i, j)) {
                    continue;
                }

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
                if (!child.isMesh) {
                    return;
                }

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
            });
        });
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

        this.cityGrid = [];
        this.navigationData = this.createEmptyNavigationData();
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