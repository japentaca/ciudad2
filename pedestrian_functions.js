// pedestrian_functions.js
// Note: THREE needs to be passed or imported if used directly inside

export function createPedestrians(THREE, scene, pedestrians, cityGrid, gridSize, buildingPlotSize, pavementWidth) {
    const numPedestrians = 100; // Number of pedestrians
    const pedGeometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8); // Simple capsule shape
    pedGeometry.translate(0, 0.5 + 0.5, 0); // Position base at y=0
    const pedMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });
    const plotStep = buildingPlotSize + pavementWidth * 2;
    const pavementOffset = buildingPlotSize / 2 + pavementWidth / 2; // Middle of the pavement

    // Clear existing pedestrians before creating new ones
    pedestrians.forEach(ped => {
        // Also dispose mixer if it exists from previous attempts
        if (ped.mixer) {
            // Stop all actions and clear references? Three.js might handle this, but being explicit can help.
            // ped.mixer.stopAllAction(); // Optional cleanup
        }
        scene.remove(ped.mesh);
    });
    pedestrians.length = 0; // Clear the array

    pedestrians.length = 0; // Clear the array

    for (let i = 0; i < numPedestrians; i++) {
        const pedestrianMesh = new THREE.Mesh(pedGeometry, pedMaterial); // Use original geometry/material
        pedestrianMesh.castShadow = true;
        pedestrianMesh.position.y = 0; // Start at ground level

        // Try place on a pavement area
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 10) {
            const gridX = THREE.MathUtils.randInt(0, gridSize - 1);
            const gridZ = THREE.MathUtils.randInt(0, gridSize - 1);
            const plot = cityGrid[gridX][gridZ];

            // Place near building plots or parks, on the pavement strip
            if (plot.type === 'building' || plot.type === 'park') {
                const side = THREE.MathUtils.randInt(0, 3); // 0: +X, 1: -X, 2: +Z, 3: -Z
                const direction = new THREE.Vector3();
                const walkOffset = THREE.MathUtils.randFloat(-plotStep / 2.1, plotStep / 2.1); // Position along the pavement side

                switch (side) {
                    case 0: // +X side
                        pedestrianMesh.position.x = plot.x + pavementOffset;
                        pedestrianMesh.position.z = plot.z + walkOffset;
                        direction.set(0, 0, Math.random() > 0.5 ? 1 : -1); // Walk along Z
                        break;
                    case 1: // -X side
                        pedestrianMesh.position.x = plot.x - pavementOffset;
                        pedestrianMesh.position.z = plot.z + walkOffset;
                        direction.set(0, 0, Math.random() > 0.5 ? 1 : -1); // Walk along Z
                        break;
                    case 2: // +Z side
                        pedestrianMesh.position.x = plot.x + walkOffset;
                        pedestrianMesh.position.z = plot.z + pavementOffset;
                        direction.set(Math.random() > 0.5 ? 1 : -1, 0, 0); // Walk along X
                        break;
                    case 3: // -Z side
                        pedestrianMesh.position.x = plot.x + walkOffset;
                        pedestrianMesh.position.z = plot.z - pavementOffset;
                        direction.set(Math.random() > 0.5 ? 1 : -1, 0, 0); // Walk along X
                        break;
                }
                // Rotate pedestrian to face walking direction (optional)
                if (direction.x !== 0) pedestrianMesh.rotation.y = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
                else pedestrianMesh.rotation.y = direction.z > 0 ? Math.PI : 0;


                pedestrians.push({
                    mesh: pedestrianMesh,
                    speed: THREE.MathUtils.randFloat(1, 3), // Walking speed
                    direction: direction
                    // Remove mixer and walkAction
                });
                scene.add(pedestrianMesh);
                placed = true;
            }
            attempts++;
        }
    }
    pedGeometry.dispose(); // Dispose the capsule geometry again
    // pedMaterial.dispose(); // Keep material if potentially reused
}

export function updatePedestrians(deltaTime, THREE, pedestrians, cityGrid, gridSize, citySize, buildingPlotSize, pavementWidth) {
    const halfCity = citySize / 2;
    const plotStep = buildingPlotSize + pavementWidth * 2;
    // const pavementCenterOffset = buildingPlotSize / 2 + pavementWidth / 2; // Center line of pavement strip - Not used?
    // const pavementEdgeOffset = buildingPlotSize / 2; // Inner edge of pavement (building side) - Not used?
    // const roadEdgeOffset = buildingPlotSize / 2 + pavementWidth; // Outer edge of pavement (road side) - Not used?
    const turnThreshold = 1.0; // How close to corner before turning
    const tempVector = new THREE.Vector3(); // Define temporary vector outside loop
    const steerVector = new THREE.Vector3(); // Define steering vector outside loop

    pedestrians.forEach(ped => {
        const potentialPosition = ped.mesh.position.clone().addScaledVector(ped.direction, ped.speed * deltaTime * 1.1); // Look ahead slightly

        // Calculate current grid cell for steering
        const currentGridX = Math.floor((ped.mesh.position.x + halfCity) / plotStep);
        const currentGridZ = Math.floor((ped.mesh.position.z + halfCity) / plotStep);

        // --- Sidewalk Confinement Steering ---
        const currentPlot = (currentGridX >= 0 && currentGridX < gridSize && currentGridZ >= 0 && currentGridZ < gridSize)
            ? cityGrid[currentGridX][currentGridZ] : null;

        // Apply steering only if near a building/park (where sidewalks are defined)
        if (currentPlot && (currentPlot.type === 'building' || currentPlot.type === 'park')) {
            const plotCenterX = (currentGridX * plotStep) - halfCity + plotStep / 2;
            const plotCenterZ = (currentGridZ * plotStep) - halfCity + plotStep / 2;
            const pavementCenterOffset = buildingPlotSize / 2 + pavementWidth / 2;

            let targetX = potentialPosition.x;
            let targetZ = potentialPosition.z;
            const movingAlongX = Math.abs(ped.direction.x) > Math.abs(ped.direction.z);

            if (movingAlongX) { // Moving horizontally, constrain Z
                const topSidewalkZ = plotCenterZ + pavementCenterOffset;
                const bottomSidewalkZ = plotCenterZ - pavementCenterOffset;
                // Find the closer of the two parallel sidewalks
                targetZ = (Math.abs(potentialPosition.z - topSidewalkZ) < Math.abs(potentialPosition.z - bottomSidewalkZ))
                    ? topSidewalkZ : bottomSidewalkZ;
            } else { // Moving vertically, constrain X
                const rightSidewalkX = plotCenterX + pavementCenterOffset;
                const leftSidewalkX = plotCenterX - pavementCenterOffset;
                // Find the closer of the two parallel sidewalks
                targetX = (Math.abs(potentialPosition.x - rightSidewalkX) < Math.abs(potentialPosition.x - leftSidewalkX))
                    ? rightSidewalkX : leftSidewalkX;
            }

            // Calculate steering vector (from potential pos towards target sidewalk line)
            steerVector.set(targetX - potentialPosition.x, 0, targetZ - potentialPosition.z);
            const distToTarget = steerVector.length();

            // Apply steering force proportional to distance, but capped
            if (distToTarget > 0.1) { // Only steer if significantly off path
                const maxCorrectionForce = 0.15; // How strongly to steer back
                steerVector.normalize().multiplyScalar(ped.speed * maxCorrectionForce); // Scale correction by speed and factor

                // Apply steering to direction (gradual turn)
                ped.direction.add(steerVector).normalize();
            }
        }
        // --- End Sidewalk Confinement ---

        // Calculate next grid cell for turning logic
        const nextGridX = Math.floor((potentialPosition.x + halfCity) / plotStep);
        const nextGridZ = Math.floor((potentialPosition.z + halfCity) / plotStep);

        let needsTurn = false;
        let turnAngle = 0;

        // Check if moving off the current pavement segment or hitting city boundary
        if (Math.abs(potentialPosition.x) > halfCity || Math.abs(potentialPosition.z) > halfCity) {
            needsTurn = true; // Hit city edge, force turn
            turnAngle = Math.PI; // Turn around
        } else {
            // Calculate relative position within the current plot step
            const relX = (ped.mesh.position.x + halfCity) % plotStep;
            const relZ = (ped.mesh.position.z + halfCity) % plotStep;

            // Are we near a corner within the plot step?
            const nearCornerX = relX < turnThreshold || relX > plotStep - turnThreshold;
            const nearCornerZ = relZ < turnThreshold || relZ > plotStep - turnThreshold;

            if (nearCornerX && nearCornerZ) { // If near a corner
                // Check if the next plot is NOT a building/park (i.e., it's a road intersection)
                if (nextGridX >= 0 && nextGridX < gridSize && nextGridZ >= 0 && nextGridZ < gridSize) {
                    // Check if cityGrid exists and has the cell
                    if (cityGrid && cityGrid[nextGridX] && cityGrid[nextGridX][nextGridZ]) {
                        const nextPlotType = cityGrid[nextGridX][nextGridZ].type;
                        if (nextPlotType === 'road') {
                            needsTurn = true;
                            // Simple random turn (left/right) at road intersection corners
                            turnAngle = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
                        }
                        // If next plot is building/park, might need more complex logic to follow pavement around corner
                        // For now, just turn randomly if blocked by building/park corner
                        else if (nextPlotType === 'building' || nextPlotType === 'park') {
                            needsTurn = true;
                            turnAngle = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
                        }
                    } else { // Cell doesn't exist? Turn around.
                        needsTurn = true;
                        turnAngle = Math.PI;
                    }
                } else { // Near corner but outside grid bounds? Turn around.
                    needsTurn = true;
                    turnAngle = Math.PI;
                }
            }
        }


        if (needsTurn) {
            ped.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), turnAngle);
            // Snap position slightly back to prevent going off edge before turning
            // Correct way to subtract a scaled vector:
            ped.mesh.position.sub(tempVector.copy(ped.direction).multiplyScalar(ped.speed * deltaTime * 0.1)); // Keep snap back
        }
        // Always move using the potentially corrected direction
        ped.mesh.position.addScaledVector(ped.direction, ped.speed * deltaTime);

        // Adjust mesh rotation to face direction (always update)
        const angle = Math.atan2(ped.direction.x, ped.direction.z);
        ped.mesh.rotation.y = angle;

        // Mixer update removed
    });
}