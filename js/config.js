// Configuración global del simulador de ciudad
export const CONFIG = {
    // Dimensiones base
    citySize: 1300,
    roadWidth: 20,
    avenueWidth: 28,
    buildingPlotSize: 50,
    pavementWidth: 5,
    sidewalkHeight: 0.2,

    // Parámetros de simulación
    baseCycleSpeed: 0.02,
    cycleSpeed: 0.02,
    timeSpeedMultiplier: 1,
    uiRefreshInterval: 0.25,
    debugLogging: false,

    // Densidades activas
    numVehicles: 50,
    numPedestrians: 25,

    // Configuración de iluminación
    lightHeight: 15,
    lightColor: 0xffffee,
    maxStreetPointLights: 0,

    // Configuración de texturas
    textureSize: 128,

    // Reglas urbanas parametrizadas
    urban: {
        baseBlockWidth: 4,
        baseBlockHeight: 4,
        avenueSpacing: 7,
        columnRhythm: [4, 5, 4, 6],
        rowRhythm: [4, 4, 5, 6],
        columnJitter: [0, 1, 0, -1],
        rowJitter: [0, 0, 1, -1],
        parkProbability: 0.1,
        plazaProbability: 0.06,
        landmarkProbability: 0.08
    },

    districts: {
        center: {
            name: 'Centro',
            parkProbability: 0.03,
            plazaProbability: 0.16,
            landmarkProbability: 0.18,
            groundColor: '#696969'
        },
        commercial: {
            name: 'Comercial',
            parkProbability: 0.06,
            plazaProbability: 0.09,
            landmarkProbability: 0.1,
            groundColor: '#737373'
        },
        residential: {
            name: 'Residencial',
            parkProbability: 0.12,
            plazaProbability: 0.03,
            landmarkProbability: 0.03,
            groundColor: '#66615a'
        },
        green: {
            name: 'Verde',
            parkProbability: 0.32,
            plazaProbability: 0.02,
            landmarkProbability: 0.01,
            groundColor: '#5f745d'
        }
    },

    buildingProfiles: {
        center: {
            heightRange: [20, 40],
            footprintRange: [0.72, 0.94],
            materialTypes: ['glass_dark', 'glass', 'concrete'],
            populationDensity: 1.4,
            emissiveBoost: 1
        },
        commercial: {
            heightRange: [12, 26],
            footprintRange: [0.7, 0.92],
            materialTypes: ['glass', 'stucco', 'concrete'],
            populationDensity: 1,
            emissiveBoost: 0.9
        },
        residential: {
            heightRange: [5, 14],
            footprintRange: [0.78, 0.96],
            materialTypes: ['brick_tan', 'brick', 'stucco'],
            populationDensity: 0.75,
            emissiveBoost: 0.72
        },
        green: {
            heightRange: [4, 10],
            footprintRange: [0.65, 0.84],
            materialTypes: ['stucco', 'brick_tan', 'concrete'],
            populationDensity: 0.45,
            emissiveBoost: 0.55
        }
    },

    traffic: {
        laneOffset: 5,
        lightCycleDuration: 12,
        stopDistance: 16,
        intersectionArrivalThreshold: 4,
        turnChance: 0.38,
        speedMultiplier: 1
    },

    pedestrians: {
        walkSpeedMin: 1.2,
        walkSpeedMax: 2.8,
        animationSpeedMin: 0.7,
        animationSpeedMax: 1.3,
        referenceWalkSpeed: 2,
        modelScale: 0.05,
        avoidanceRadius: 1.8,
        waypointReachThreshold: 1.8,
        crosswalkPause: 0.45,
        routeRetryLimit: 12
    },

    weather: {
        enabled: true,
        mode: 'clear',
        rainCount: 1200,
        rainArea: 1600,
        rainHeight: 260,
        rainSpeed: 180,
        fogNear: 140,
        fogFar: 1900
    }
};

export const DERIVED = {
    get gridSize() {
        return Math.floor(CONFIG.citySize / (CONFIG.buildingPlotSize + CONFIG.pavementWidth * 2));
    },

    get plotStep() {
        return CONFIG.buildingPlotSize + CONFIG.pavementWidth * 2;
    },

    get halfCitySize() {
        return CONFIG.citySize / 2;
    },

    get halfRoadWidth() {
        return CONFIG.roadWidth / 2;
    },

    get halfAvenueWidth() {
        return CONFIG.avenueWidth / 2;
    }
};

export function getDistrictConfig(district) {
    return CONFIG.districts[district] || CONFIG.districts.residential;
}

export function getBuildingProfile(district) {
    return CONFIG.buildingProfiles[district] || CONFIG.buildingProfiles.residential;
}