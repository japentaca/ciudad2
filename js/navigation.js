// Módulo de construcción de red de navegación
import * as THREE from 'three';
import { CONFIG, DERIVED, ROAD_TYPES } from './config.js';

export class NavigationBuilder {
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

  build(cityGrid, layoutGenerator) {
    const navigationData = this.createEmptyNavigationData();
    const { pedestrianNetwork } = navigationData;
    const cornerOffset = DERIVED.plotStep / 2 - CONFIG.pavementWidth / 2;
    const intersectionsByRow = new Map();
    const intersectionsByColumn = new Map();

    for (let i = 0; i < DERIVED.gridSize; i++) {
      for (let j = 0; j < DERIVED.gridSize; j++) {
        const plot = cityGrid[i][j];
        if (!plot.isIntersection) continue;

        const intersectionId = `${i}:${j}`;
        const intersection = {
          id: intersectionId,
          gridX: i,
          gridZ: j,
          x: plot.x,
          z: plot.z,
          roadType: plot.roadType,
          signalized: plot.roadType === ROAD_TYPES.AVENUE || Math.random() < 0.45,
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
          this.addNode(pedestrianNetwork, nodeId, position, {
            kind: 'corner',
            intersectionId,
            district: plot.district
          });
        });

        this.addIntersectionCrosswalks(navigationData, intersection, plot, layoutGenerator);

        const streetLightOffset = DERIVED.plotStep / 2 - CONFIG.pavementWidth * 0.8;
        navigationData.streetLightPositions.push(
          new THREE.Vector3(plot.x - streetLightOffset, 0, plot.z - streetLightOffset),
          new THREE.Vector3(plot.x + streetLightOffset, 0, plot.z - streetLightOffset),
          new THREE.Vector3(plot.x - streetLightOffset, 0, plot.z + streetLightOffset),
          new THREE.Vector3(plot.x + streetLightOffset, 0, plot.z + streetLightOffset)
        );

        navigationData.intersections.push(intersection);
        navigationData.intersectionMap.set(intersectionId, intersection);

        if (!intersectionsByRow.has(j)) intersectionsByRow.set(j, []);
        if (!intersectionsByColumn.has(i)) intersectionsByColumn.set(i, []);
        intersectionsByRow.get(j).push(intersection);
        intersectionsByColumn.get(i).push(intersection);
      }
    }

    intersectionsByRow.forEach(rowIntersections => {
      rowIntersections.sort((left, right) => left.gridX - right.gridX);
      for (let index = 0; index < rowIntersections.length - 1; index++) {
        const current = rowIntersections[index];
        const next = rowIntersections[index + 1];
        this.addEdge(pedestrianNetwork, current.nodeIds.ne, next.nodeIds.nw, { type: 'sidewalk' });
        this.addEdge(pedestrianNetwork, current.nodeIds.se, next.nodeIds.sw, { type: 'sidewalk' });
      }
    });

    intersectionsByColumn.forEach(columnIntersections => {
      columnIntersections.sort((left, right) => left.gridZ - right.gridZ);
      for (let index = 0; index < columnIntersections.length - 1; index++) {
        const current = columnIntersections[index];
        const next = columnIntersections[index + 1];
        this.addEdge(pedestrianNetwork, current.nodeIds.nw, next.nodeIds.sw, { type: 'sidewalk' });
        this.addEdge(pedestrianNetwork, current.nodeIds.ne, next.nodeIds.se, { type: 'sidewalk' });
      }
    });

    pedestrianNetwork.nodeIds = Array.from(pedestrianNetwork.nodes.keys());
    return navigationData;
  }

  addIntersectionCrosswalks(navigationData, intersection, plot, layoutGenerator) {
    const isCellAvenue = layoutGenerator.cellRoadTypes.get(`${intersection.gridX},${intersection.gridZ}`) === ROAD_TYPES.AVENUE;
    const hasMajorRow = layoutGenerator.roadRows.major.has(intersection.gridZ) || isCellAvenue;
    const hasMajorColumn = layoutGenerator.roadColumns.major.has(intersection.gridX) || isCellAvenue;
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

    const { pedestrianNetwork } = navigationData;

    axes.forEach(axis => {
      if (axis === 'x') {
        this.addEdge(pedestrianNetwork, intersection.nodeIds.nw, intersection.nodeIds.ne, {
          type: 'crosswalk', axis, intersectionId: intersection.id
        });
        this.addEdge(pedestrianNetwork, intersection.nodeIds.sw, intersection.nodeIds.se, {
          type: 'crosswalk', axis, intersectionId: intersection.id
        });
        navigationData.crosswalks.push(
          { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x, 0.03, plot.z + DERIVED.plotStep * 0.24) },
          { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x, 0.03, plot.z - DERIVED.plotStep * 0.24) }
        );
        return;
      }

      this.addEdge(pedestrianNetwork, intersection.nodeIds.nw, intersection.nodeIds.sw, {
        type: 'crosswalk', axis, intersectionId: intersection.id
      });
      this.addEdge(pedestrianNetwork, intersection.nodeIds.ne, intersection.nodeIds.se, {
        type: 'crosswalk', axis, intersectionId: intersection.id
      });
      navigationData.crosswalks.push(
        { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x - DERIVED.plotStep * 0.24, 0.03, plot.z) },
        { intersectionId: intersection.id, axis, position: new THREE.Vector3(plot.x + DERIVED.plotStep * 0.24, 0.03, plot.z) }
      );
    });
  }

  addNode(network, id, position, meta = {}) {
    network.nodes.set(id, { id, position, ...meta });
    network.adjacency.set(id, network.adjacency.get(id) || []);
  }

  addEdge(network, from, to, meta = {}) {
    const existingFrom = network.adjacency.get(from) || [];
    const existingTo = network.adjacency.get(to) || [];

    if (!existingFrom.some(edge => edge.to === to)) {
      existingFrom.push({ to, ...meta });
    }
    if (!existingTo.some(edge => edge.to === from)) {
      existingTo.push({ to: from, ...meta });
    }

    network.adjacency.set(from, existingFrom);
    network.adjacency.set(to, existingTo);
  }
}
