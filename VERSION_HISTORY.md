# VERSION HISTORY

## v2.0.0 - 2026-03-12

- La ciudad pasa de una retícula procedural simple a una simulación urbana configurable con distritos, jerarquía viaria y plazas.
- Los edificios ahora responden a la zona urbana y cuentan con lectura nocturna emisiva.
- El tráfico sigue tramos entre intersecciones, respeta semáforos básicos y evita el movimiento arbitrario fuera de calle.
- Los peatones recorren una red explícita de waypoints con destinos variables y esperas en cruces.
- La interfaz permite iterar la simulación sin tocar código y el clima básico queda integrado como sistema opcional.

## Estado de verificación

- Sintaxis validada con `node --check` sobre módulos editados y sobre el conjunto de archivos JavaScript.
- Inspección de errores del workspace sin incidencias reportadas.
- Carga mínima servida en navegador mediante `python -m http.server 8000`.