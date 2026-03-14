// Módulo de generación de trazados urbanos
import * as THREE from 'three';
import { CONFIG, DERIVED, PLOT_TYPES, ROAD_TYPES, DISTRICTS, NETWORK_TYPES, runtimeState, getDistrictConfig } from './config.js';

export class LayoutGenerator {
  constructor() {
    this.roadColumns = { major: new Set(), minor: new Set() };
    this.roadRows = { major: new Set(), minor: new Set() };
    this.cellRoadTypes = new Map();
  }

  generate(networkType) {
    this.cellRoadTypes = new Map();
    this.roadColumns = { major: new Set(), minor: new Set() };
    this.roadRows = { major: new Set(), minor: new Set() };

    switch (networkType) {
      case NETWORK_TYPES.RADIAL:
        this.generateRadialNetwork();
        break;
      case NETWORK_TYPES.ORGANIC:
        this.generateOrganicNetwork();
        break;
      case NETWORK_TYPES.HYBRID:
        this.generateHybridNetwork();
        break;
      default:
        this.generateGridNetwork();
        break;
    }

    const cityGrid = this.buildCityGrid();
    this.annotateRoads(cityGrid);
    return cityGrid;
  }

  generateGridNetwork() {
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
  }

  generateRadialNetwork() {
    const size = DERIVED.gridSize;
    const center = Math.floor(size / 2);
    const rings = CONFIG.urban.radialRings;
    const spokes = CONFIG.urban.radialSpokes;
    const maxRadius = (size / 2) * 0.88;

    for (let r = 1; r <= rings; r++) {
      const ringR = (r / rings) * maxRadius;
      const isAvenue = r === 1 || r === rings;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const dist = Math.hypot(i - center, j - center);
          if (Math.abs(dist - ringR) < 0.6) {
            const key = `${i},${j}`;
            const existing = this.cellRoadTypes.get(key);
            if (!existing || (existing === ROAD_TYPES.STREET && isAvenue)) {
              this.cellRoadTypes.set(key, isAvenue ? ROAD_TYPES.AVENUE : ROAD_TYPES.STREET);
            }
          }
        }
      }
    }

    for (let s = 0; s < spokes; s++) {
      const angle = (s / spokes) * Math.PI * 2;
      const isAvenue = s % 2 === 0;
      for (let t = 0; t <= maxRadius; t += 0.35) {
        const i = Math.round(center + Math.cos(angle) * t);
        const j = Math.round(center + Math.sin(angle) * t);
        if (i >= 0 && i < size && j >= 0 && j < size) {
          const key = `${i},${j}`;
          const existing = this.cellRoadTypes.get(key);
          if (!existing || (existing === ROAD_TYPES.STREET && isAvenue)) {
            this.cellRoadTypes.set(key, isAvenue ? ROAD_TYPES.AVENUE : ROAD_TYPES.STREET);
          }
        }
      }
    }
  }

  generateOrganicNetwork() {
    const size = DERIVED.gridSize;

    const markCell = (i, j, type) => {
      if (i < 0 || i >= size || j < 0 || j >= size) return;
      const key = `${i},${j}`;
      const cur = this.cellRoadTypes.get(key);
      if (!cur || (cur === ROAD_TYPES.STREET && type === ROAD_TYPES.AVENUE)) {
        this.cellRoadTypes.set(key, type);
      }
    };

    const traceHorizontal = (jFn, type) => {
      for (let i = 0; i < size; i++) {
        const j = THREE.MathUtils.clamp(Math.round(jFn(i)), 1, size - 2);
        const jNext = i < size - 1
          ? THREE.MathUtils.clamp(Math.round(jFn(i + 1)), 1, size - 2)
          : j;
        markCell(i, j, type);
        if (jNext > j) for (let k = j + 1; k <= jNext; k++) markCell(i, k, type);
        else if (jNext < j) for (let k = jNext; k < j; k++) markCell(i, k, type);
      }
    };

    const traceVertical = (iFn, type) => {
      for (let j = 0; j < size; j++) {
        const iVal = THREE.MathUtils.clamp(Math.round(iFn(j)), 1, size - 2);
        const iNext = j < size - 1
          ? THREE.MathUtils.clamp(Math.round(iFn(j + 1)), 1, size - 2)
          : iVal;
        markCell(iVal, j, type);
        if (iNext > iVal) for (let k = iVal + 1; k <= iNext; k++) markCell(k, j, type);
        else if (iNext < iVal) for (let k = iNext; k < iVal; k++) markCell(k, j, type);
      }
    };

    const amplitude = size * 0.09;
    const baseFreq = 2 * Math.PI / size;

    const avenueCount = 3;
    for (let a = 0; a < avenueCount; a++) {
      const baseJ = Math.round((a + 1) * size / (avenueCount + 1));
      const freq = baseFreq * (0.6 + Math.random() * 0.5);
      const phase = Math.random() * Math.PI * 2;
      traceHorizontal(i => baseJ + amplitude * Math.sin(freq * i + phase), ROAD_TYPES.AVENUE);
    }

    const streetCount = 3;
    for (let s = 0; s < streetCount; s++) {
      const baseI = Math.round((s + 1) * size / (streetCount + 1));
      const freq = baseFreq * (0.6 + Math.random() * 0.5);
      const phase = Math.random() * Math.PI * 2;
      traceVertical(j => baseI + amplitude * Math.sin(freq * j + phase), ROAD_TYPES.STREET);
    }
  }

  generateHybridNetwork() {
    this.generateGridNetwork();

    const center = Math.floor(DERIVED.gridSize / 2);
    const size = DERIVED.gridSize;

    const diagonalCount = 3;
    for (let d = 0; d < diagonalCount; d++) {
      const startOffset = Math.floor(THREE.MathUtils.randFloat(size * 0.15, size * 0.35));
      for (let step = 0; step < Math.floor(size * 0.6); step++) {
        const i = Math.min(center - startOffset + step, size - 2);
        const j = Math.min(center + startOffset - step + Math.floor(d * 2), size - 2);
        if (i > 0 && i < size - 1 && j > 0 && j < size - 1) {
          if (Math.random() < 0.55) this.roadColumns.minor.add(i);
          if (Math.random() < 0.55) this.roadRows.minor.add(j);
        }
      }
    }

    const ringRadius = Math.floor(size * 0.22);
    if (ringRadius > 2) {
      this.roadColumns.major.add(center + ringRadius);
      this.roadColumns.major.add(center - ringRadius);
      this.roadRows.major.add(center + ringRadius);
      this.roadRows.major.add(center - ringRadius);
    }
  }

  buildCityGrid() {
    const cityGrid = [];
    for (let i = 0; i < DERIVED.gridSize; i++) {
      cityGrid[i] = [];
      for (let j = 0; j < DERIVED.gridSize; j++) {
        cityGrid[i][j] = this.createPlotAt(i, j);
      }
    }
    return cityGrid;
  }

  createPlotAt(i, j) {
    const x = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + i * DERIVED.plotStep;
    const z = -DERIVED.halfCitySize + DERIVED.plotStep / 2 + j * DERIVED.plotStep;
    const district = this.resolveDistrict(i, j);
    const districtConfig = getDistrictConfig(district);
    const cellRoadType = this.cellRoadTypes.get(`${i},${j}`);
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
      type: PLOT_TYPES.BUILDING,
      roadType: null,
      roadAxis: null,
      isIntersection: false,
      isLandmark: false,
      connectedDirections: null
    };

    if (cellRoadType || isRoadColumn || isRoadRow) {
      plot.type = PLOT_TYPES.ROAD;
      plot.roadType = cellRoadType ?? ((isMajorColumn || isMajorRow) ? ROAD_TYPES.AVENUE : ROAD_TYPES.STREET);
    } else {
      const nearAvenue = this.isNearMajorRoad(i, j);
      const parkChance = districtConfig.parkProbability ?? CONFIG.urban.parkProbability;
      const plazaChance = nearAvenue
        ? districtConfig.plazaProbability ?? CONFIG.urban.plazaProbability
        : 0;
      const randomValue = Math.random();

      if (randomValue < plazaChance) {
        plot.type = PLOT_TYPES.PLAZA;
      } else if (randomValue < plazaChance + parkChance) {
        plot.type = PLOT_TYPES.PARK;
      } else {
        plot.type = PLOT_TYPES.BUILDING;
        plot.isLandmark = nearAvenue && Math.random() < (districtConfig.landmarkProbability ?? CONFIG.urban.landmarkProbability);
      }
    }

    return plot;
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
    const networkType = runtimeState.roadNetworkType;
    const size = DERIVED.gridSize;

    if (networkType === NETWORK_TYPES.RADIAL || networkType === NETWORK_TYPES.HYBRID) {
      const center = Math.floor(size / 2);
      const distFromCenter = Math.hypot(i - center, j - center);
      const normalizedDist = distFromCenter / (size / 2);

      if (normalizedDist < 0.15) return DISTRICTS.CENTER;
      if (normalizedDist < 0.35) return DISTRICTS.COMMERCIAL;
      if (normalizedDist > 0.75) return DISTRICTS.GREEN;
      return DISTRICTS.RESIDENTIAL;
    }

    const xNorm = (i / (DERIVED.gridSize - 1)) * 2 - 1;
    const zNorm = (j / (DERIVED.gridSize - 1)) * 2 - 1;
    const radial = Math.hypot(xNorm, zNorm);

    if (radial < 0.26) return DISTRICTS.CENTER;
    if (Math.abs(zNorm) < 0.22 && radial < 0.72) return DISTRICTS.COMMERCIAL;
    if (radial > 0.78 || (xNorm < -0.25 && zNorm > 0.2)) return DISTRICTS.GREEN;
    return DISTRICTS.RESIDENTIAL;
  }

  isNearMajorRoad(i, j) {
    for (let offset = -1; offset <= 1; offset++) {
      if (this.roadColumns.major.has(i + offset) || this.roadRows.major.has(j + offset)) {
        return true;
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (this.cellRoadTypes.get(`${i + dx},${j + dz}`) === ROAD_TYPES.AVENUE) {
          return true;
        }
      }
    }
    return false;
  }

  annotateRoads(cityGrid) {
    for (let i = 0; i < DERIVED.gridSize; i++) {
      for (let j = 0; j < DERIVED.gridSize; j++) {
        const plot = cityGrid[i][j];
        if (plot.type !== PLOT_TYPES.ROAD) continue;

        const connectedDirections = {
          north: this.isRoadAt(cityGrid, i, j + 1),
          south: this.isRoadAt(cityGrid, i, j - 1),
          east: this.isRoadAt(cityGrid, i + 1, j),
          west: this.isRoadAt(cityGrid, i - 1, j)
        };

        const horizontal = connectedDirections.east || connectedDirections.west;
        const vertical = connectedDirections.north || connectedDirections.south;
        const connectedCount = [connectedDirections.north, connectedDirections.south,
        connectedDirections.east, connectedDirections.west].filter(Boolean).length;

        plot.connectedDirections = connectedDirections;
        plot.isIntersection = horizontal && vertical && connectedCount >= 3;
        plot.roadAxis = plot.isIntersection ? 'intersection' : (horizontal ? 'x' : 'z');
      }
    }
  }

  isRoadAt(cityGrid, i, j) {
    if (i < 0 || j < 0 || i >= DERIVED.gridSize || j >= DERIVED.gridSize) return false;
    return cityGrid[i][j].type === PLOT_TYPES.ROAD;
  }
}
