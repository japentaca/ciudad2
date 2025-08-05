// Configuración global del simulador de ciudad
export const CONFIG = {
    // Dimensiones de la ciudad
    citySize: 1300,
    roadWidth: 20,
    buildingPlotSize: 50,
    pavementWidth: 5,
    
    // Parámetros de simulación
    cycleSpeed: 0.02,
    
    // Configuración de vehículos
    numVehicles: 50,
    
    // Configuración de iluminación
    lightHeight: 15,
    lightColor: 0xffffee,
    
    // Configuración de texturas
    textureSize: 128,
    
    // Configuración de aceras
    sidewalkHeight: 0.2
};

// Calcular valores derivados
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
    }
};