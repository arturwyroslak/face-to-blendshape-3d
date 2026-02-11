/**
 * Head Geometry Generator
 * Generates back of head using face contour extrusion
 */

export class HeadGeometryGenerator {
    constructor() {}
    
    generateCompleteHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const colors = [];
        
        // Apply subtle width correction (0.92 = 8% narrower)
        const correctedScaleX = scaleX * 1.08;  // Divide by this to make narrower
        
        // Face vertices (0-467) with POSITIVE Z
        faceLandmarks.forEach((landmark) => {
            const x = (landmark.x - centerX) / correctedScaleX * 2;
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
            centerX, centerY, centerZ, correctedScaleX, scaleY, scaleZ
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
        const numLayers = 6;
        const pointsPerLayer = contourIndices.length - 1;  // Exclude duplicate
        
        // Layer configurations - moving backwards (decreasing Z)
        const layerConfigs = [
            { zOffset: -0.3, xScale: 0.95, yShift: 0.0 },
            { zOffset: -0.5, xScale: 0.88, yShift: 0.05 },
            { zOffset: -0.7, xScale: 0.78, yShift: 0.1 },
            { zOffset: -0.85, xScale: 0.65, yShift: 0.15 },
            { zOffset: -0.95, xScale: 0.5, yShift: 0.2 },
            { zOffset: -1.0, xScale: 0.35, yShift: 0.25 }
        ];
        
        // Generate layers from face backwards
        for (let layer = 0; layer < numLayers; layer++) {
            const config = layerConfigs[layer];
            
            for (let i = 0; i < pointsPerLayer; i++) {
                const contourIdx = contourIndices[i];
                const landmark = faceLandmarks[contourIdx];
                
                let x = (landmark.x - cx) / sx * 2;
                let y = -(landmark.y - cy) / sy * 2;
                
                // Scale X towards center
                x *= config.xScale;
                
                // Lift and narrow top of head
                const isTop = i === 0 || i === pointsPerLayer - 1;
                if (isTop) {
                    y += config.yShift + (layer * 0.03);
                    x *= 0.85;
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
        
        // Add apex (top center)
        const topLandmark = faceLandmarks[10];
        const topY = -(topLandmark.y - cy) / sy * 2 + 0.5;
        
        vertices.push({
            x: 0,
            y: topY,
            z: -0.9,
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