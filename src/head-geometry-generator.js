/**
 * Head Geometry Generator
 * Extends face mesh with back vertices using ellipsoid projection
 */

export class HeadGeometryGenerator {
    constructor() {}
    
    /**
     * Generate complete head geometry from face landmarks
     */
    generateCompleteHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const colors = [];
        
        // Copy original face vertices (0-467)
        faceLandmarks.forEach((landmark) => {
            const x = (landmark.x - centerX) / scaleX * 2;
            const y = -(landmark.y - centerY) / scaleY * 2;
            const z = -((landmark.z - centerZ) / scaleZ * 2);
            
            vertices.push(x, y, z);
            colors.push(1, 1, 1); // White for texture
        });
        
        // Face contour/silhouette points (simplified to key points)
        const silhouetteIndices = [
            10,   // Forehead center
            338,  // Right temple  
            297,  // Right cheek top
            332,  // Right cheek
            284,  // Right jaw
            397,  // Right chin
            152,  // Chin center
            176,  // Left chin
            58,   // Left jaw
            103,  // Left cheek
            67,   // Left cheek top
            109,  // Left temple
        ];
        
        const skinColor = { r: 0.92, g: 0.82, b: 0.72 };
        
        // Generate back vertices using simple depth extrusion
        const backGeometry = this.generateSimpleBack(
            faceLandmarks,
            silhouetteIndices,
            skinColor,
            centerX, centerY, centerZ,
            scaleX, scaleY, scaleZ
        );
        
        // Add back vertices
        backGeometry.vertices.forEach(v => {
            vertices.push(v.x, v.y, v.z);
            colors.push(v.r, v.g, v.b);
        });
        
        // Generate triangulation
        const backTriangulation = this.generateBackTriangulation(
            468,
            silhouetteIndices,
            backGeometry.layers
        );
        
        return {
            vertices,
            colors,
            backTriangulation,
            vertexCount: vertices.length / 3
        };
    }
    
    /**
     * Generate back using simple depth layers
     */
    generateSimpleBack(faceLandmarks, silhouetteIndices, skinColor, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const numLayers = 6;
        const pointsPerLayer = silhouetteIndices.length;
        
        // Define depth and scale for each layer
        const layerConfig = [
            { z: -0.4, scale: 1.0, yShift: 0.0 },    // Near face
            { z: -0.7, scale: 0.92, yShift: 0.02 },  // Mid-near
            { z: -1.0, scale: 0.82, yShift: 0.05 },  // Mid
            { z: -1.2, scale: 0.70, yShift: 0.08 },  // Mid-far
            { z: -1.35, scale: 0.58, yShift: 0.12 }, // Far
            { z: -1.4, scale: 0.45, yShift: 0.15 }   // Very far
        ];
        
        // Generate layers
        for (let layer = 0; layer < numLayers; layer++) {
            const config = layerConfig[layer];
            
            for (let i = 0; i < pointsPerLayer; i++) {
                const silIdx = silhouetteIndices[i];
                const landmark = faceLandmarks[silIdx];
                
                let x = (landmark.x - centerX) / scaleX * 2;
                let y = -(landmark.y - centerY) / scaleY * 2;
                
                // Scale towards center
                x *= config.scale;
                
                // Lift top of head
                const isTop = i < 3 || i > pointsPerLayer - 3;
                if (isTop) {
                    y += config.yShift + (layer * 0.04);
                    x *= 0.9; // Narrow top more
                }
                
                // Set Z depth
                const z = config.z;
                
                vertices.push({
                    x, y, z,
                    r: skinColor.r,
                    g: skinColor.g,
                    b: skinColor.b
                });
            }
        }
        
        // Add apex (top center of head)
        const topLandmark = faceLandmarks[10];
        const topY = -(topLandmark.y - centerY) / scaleY * 2 + 0.5;
        
        vertices.push({
            x: 0,
            y: topY,
            z: -1.2,
            r: skinColor.r,
            g: skinColor.g,
            b: skinColor.b
        });
        
        return {
            vertices,
            layers: numLayers
        };
    }
    
    /**
     * Generate triangulation
     */
    generateBackTriangulation(startIdx, silhouetteIndices, numLayers) {
        const indices = [];
        const pointsPerLayer = silhouetteIndices.length;
        
        // Connect face silhouette to first back layer
        for (let i = 0; i < pointsPerLayer; i++) {
            const faceIdx1 = silhouetteIndices[i];
            const faceIdx2 = silhouetteIndices[(i + 1) % pointsPerLayer];
            const backIdx1 = startIdx + i;
            const backIdx2 = startIdx + ((i + 1) % pointsPerLayer);
            
            // Quad as two triangles
            indices.push(faceIdx1, faceIdx2, backIdx1);
            indices.push(faceIdx2, backIdx2, backIdx1);
        }
        
        // Connect layers
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