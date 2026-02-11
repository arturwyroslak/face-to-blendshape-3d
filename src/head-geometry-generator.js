/**
 * Head Geometry Generator
 * Generates back of head using face contour extrusion
 */

export class HeadGeometryGenerator {
    constructor() {}
    
    generateCompleteHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const colors = [];
        
        // Use corrected scale passed from main generator
        // scaleX already includes the 1.08 width correction
        
        // Face vertices (0-467) with POSITIVE Z
        faceLandmarks.forEach((landmark) => {
            const x = (landmark.x - centerX) / scaleX * 2;
            const y = -(landmark.y - centerY) / scaleY * 2;
            const z = ((landmark.z - centerZ) / scaleZ * 2);  // POSITIVE
            
            vertices.push(x, y, z);
            colors.push(1, 1, 1);  // White for texture
        });
        
        // Face contour indices for head outline
        const contourIndices = [
            10,   // Forehead top
            109,  // Left temple
            67,   // Left cheek
            103,  // Left jaw
            104,  // Left chin
            152,  // Chin center
            365,  // Right chin
            389,  // Right jaw
            297,  // Right cheek
            338,  // Right temple
            10    // Close loop
        ];
        
        const skinColor = { r: 0.92, g: 0.82, b: 0.72 };
        
        // Generate back vertices
        const backData = this.generateBackVertices(
            faceLandmarks, contourIndices, skinColor,
            centerX, centerY, centerZ, scaleX, scaleY, scaleZ
        );
        
        backData.vertices.forEach(v => {
            vertices.push(v.x, v.y, v.z);
            colors.push(v.r, v.g, v.b);
        });
        
        const backTriangulation = this.generateBackTriangulation(
            468, contourIndices.length - 1, backData.layers
        );
        
        return {
            vertices,
            colors,
            backTriangulation,
            vertexCount: vertices.length / 3
        };
    }
    
    generateBackVertices(faceLandmarks, contourIndices, skinColor, cx, cy, cz, sx, sy, sz) {
        const vertices = [];
        const numLayers = 8; // More layers for smoother head shape
        const pointsPerLayer = contourIndices.length - 1;  // Exclude duplicate
        
        // Create a full cranial shape (spherical extension)
        // Depth needs to be comparable to width (which is ~2.0 units: -1 to 1)
        // So we extend Z back to roughly -1.8
        
        const layerConfigs = [];
        for (let i = 0; i < numLayers; i++) {
            const t = (i + 1) / numLayers; // 0 to 1
            
            // Non-linear depth progression for rounded shape
            const zOffset = -0.2 - (t * 1.6); // Ends at -1.8
            
            // Spherical falloff for X/Y scale
            // cos(t * PI/2) gives a circular curve starting at 1.0 and ending at 0
            const curve = Math.cos(t * Math.PI * 0.4); // Don't go to 0 completely, stay open for apex
            
            layerConfigs.push({
                zOffset: zOffset,
                scale: curve,
                yShift: i * 0.05 // Slight lift for cranium
            });
        }
        
        // Generate layers from face backwards
        for (let layer = 0; layer < numLayers; layer++) {
            const config = layerConfigs[layer];
            
            for (let i = 0; i < pointsPerLayer; i++) {
                const contourIdx = contourIndices[i];
                const landmark = faceLandmarks[contourIdx];
                
                let x = (landmark.x - cx) / sx * 2;
                let y = -(landmark.y - cy) / sy * 2;
                
                // Scale towards center to form sphere
                x *= config.scale;
                
                // Adjust Y to form proper skull shape
                // Lift top, tuck chin
                const isTop = i === 0 || i === pointsPerLayer - 1; // Forehead
                const isBottom = i === 4 || i === 5 || i === 6;    // Chin area
                
                if (isTop) {
                    y += config.yShift; // Lift cranium
                } else if (isBottom) {
                     // Chin doesn't go back as much as cranium, tuck it in/up
                     y += layer * 0.1; 
                     // Pull chin Z less far back? No, simplify: keep Z ring uniform, adjust Y
                }
                
                // Z moves backwards
                const z = config.zOffset;
                
                vertices.push({
                    x, y, z,
                    r: skinColor.r,
                    g: skinColor.g,
                    b: skinColor.b
                });
            }
        }
        
        // Add apex (Occiput - back of head center)
        // Instead of high Y, place it centrally at the furthest back point
        vertices.push({
            x: 0,
            y: 0.3, // Slightly above center for correct skull center
            z: -2.0, // Furthest point
            r: skinColor.r,
            g: skinColor.g,
            b: skinColor.b
        });
        
        return { vertices, layers: numLayers };
    }
    
    generateBackTriangulation(startIdx, pointsPerLayer, numLayers) {
        const indices = [];
        
        // Connect face contour to first back layer
        // We need to map contour indices properly
        const faceContourIndices = [
            10, 109, 67, 103, 104, 152, 365, 389, 297, 338
        ];
        
        for (let i = 0; i < pointsPerLayer; i++) {
            const f1 = faceContourIndices[i];
            const f2 = faceContourIndices[(i + 1) % pointsPerLayer];
            const b1 = startIdx + i;
            const b2 = startIdx + ((i + 1) % pointsPerLayer);
            
            // Two triangles forming quad
            indices.push(f1, f2, b1);
            indices.push(f2, b2, b1);
        }
        
        // Connect back layers
        for (let layer = 0; layer < numLayers - 1; layer++) {
            const layer1Start = startIdx + layer * pointsPerLayer;
            const layer2Start = startIdx + (layer + 1) * pointsPerLayer;
            
            for (let i = 0; i < pointsPerLayer; i++) {
                const p1 = layer1Start + i;
                const p2 = layer1Start + ((i + 1) % pointsPerLayer);
                const p3 = layer2Start + i;
                const p4 = layer2Start + ((i + 1) % pointsPerLayer);
                
                indices.push(p1, p2, p3);
                indices.push(p2, p4, p3);
            }
        }
        
        // Connect last layer to apex
        const lastLayerStart = startIdx + (numLayers - 1) * pointsPerLayer;
        const apexIdx = startIdx + numLayers * pointsPerLayer;
        
        for (let i = 0; i < pointsPerLayer; i++) {
            const p1 = lastLayerStart + i;
            const p2 = lastLayerStart + ((i + 1) % pointsPerLayer);
            
            indices.push(p1, p2, apexIdx);
        }
        
        return indices;
    }
}