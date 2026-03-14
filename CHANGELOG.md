# CHANGELOG

## 2026-03-14

- Corregida la logica de cruce peatonal en `js/traffic.js`: ahora los peatones solo reciben paso cuando el semaforo favorece al eje vehicular perpendicular, evitando cruces en conflicto con el flujo de coches.
- Limpiada la representacion visual de pasos de cebra en `js/textures.js` y `js/city.js`, eliminando el marcado duplicado dentro de la interseccion y dejando un zebra crossing mas compacto y legible.
- Reducida la densidad de cruces en `js/city.js`: ya no se generan en las cuatro aproximaciones de casi todas las intersecciones, sino de forma selectiva segun jerarquia viaria y un patron local mas espaciado.

## 2026-03-12 (sesión 2)

- Reducido en `js/lighting.js` el presupuesto de `PointLight` de farolas a un máximo configurable de 4 mediante `CONFIG.maxStreetPointLights`, evitando el error WebGL `too many uniforms` en GPUs con límite bajo de uniforms de fragmento.
- Ajustado el presupuesto de farolas para que dependa además de `renderer.capabilities`, con degradación automática hasta 0 `PointLight` reales en WebGL1 y hasta 0-3 en GPUs más limitadas, manteniendo solo la bombilla visual cuando hace falta.
- Corregida fuga de textura GPU en `js/city.js`: `clearCity()` ahora llama a `material.map.dispose()` antes de `material.dispose()`, evitando que la textura del suelo quede huérfana en la GPU en cada regeneración de ciudad.
- Corregido comportamiento de snap de vehículos en `js/traffic.js` `updateTraffic()`: la comprobación del umbral de llegada a intersección (Block B) se evalúa ahora antes del paso de movimiento, eliminando el micro-salto de posición que ocurría cuando un vehículo ya estaba dentro de la zona de snap.
- Evitada la reconstrucción innecesaria de señales de tráfico en `js/traffic.js` `createTraffic()`: `setNavigationData()` solo se ejecuta cuando la referencia de datos de navegación es nueva, por lo que ajustar la densidad de vehículos con el slider ya no destruye y recrea todos los semáforos.

## 2026-03-12

- Parametrizada la base urbana en `js/config.js` con ritmos de bloque, avenidas, probabilidades de parque y plaza, perfiles distritales, tráfico, peatones y clima.
- Rehecha la generación de ciudad en `js/city.js` para producir distritos, avenidas, calles secundarias, plazas, cruces, mobiliario urbano y red peatonal de waypoints.
- Actualizados `js/textures.js` y `js/buildings.js` para reflejar distritos, diferenciar vías principales y aplicar tipologías de edificio con iluminación emisiva nocturna.
- Sustituido el tráfico aleatorio por un sistema simple de segmentos entre intersecciones con carriles, semáforos visibles y reglas de parada en cruces en `js/traffic.js`.
- Sustituido el movimiento peatonal local por navegación por waypoints y cruces con espera semafórica en `js/entities/pedestrian-system.js`.
- Añadido clima opcional con lluvia y niebla mediante `js/weather.js` y conectado el control de atmósfera en `js/main.js` e `index.html`.
- Ampliada la UI para controlar velocidad temporal, densidad de tráfico, densidad peatonal y clima sin editar código.
- Ajustada la estabilidad de tráfico y clima para evitar saltos de tramo en FPS bajos y restaurar la niebla base al salir de modos atmosféricos.
- Verificada sintaxis con `node --check` por bloques y sobre todo el workspace; `get_errors` no reportó problemas.