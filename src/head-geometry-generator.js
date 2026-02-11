/**
 * Head Geometry Generator
 * Extends face mesh with back and side vertices for complete head model
 */

export class HeadGeometryGenerator {
    constructor() {
        this.backVertices = [];
        this.sideVertices = [];
    }
    
    /**
     * Generate complete head geometry from face landmarks
     * @param {Array} faceLandmarks - MediaPipe face landmarks (468 points)
     * @returns {Object} Extended vertices and triangulation
     */
    generateCompleteHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const colors = [];
        
        // Copy original face vertices (0-467)
        faceLandmarks.forEach((landmark, index) => {
            const x = (landmark.x - centerX) / scaleX * 2;
            const y = -(landmark.y - centerY) / scaleY * 2;
            const z = -((landmark.z - centerZ) / scaleZ * 2);
            
            vertices.push(x, y, z);
            // Face vertices will use texture UVs, no vertex colors needed
            colors.push(1, 1, 1); // White (will be textured)
        });
        
        // Generate back of head vertices
        const backOfHeadVertices = this.generateBackOfHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ);
        
        // Add back vertices (468+)
        backOfHeadVertices.vertices.forEach(v => {
            vertices.push(v.x, v.y, v.z);
            colors.push(v.r, v.g, v.b); // Skin color
        });
        
        // Generate triangulation for back
        const backTriangulation = this.generateBackTriangulation(468);
        
        return {
            vertices,
            colors,
            backTriangulation,
            vertexCount: vertices.length / 3
        };
    }
    
    /**
     * Generate back of head vertices based on face contour
     */
    generateBackOfHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        
        // Key face contour indices for head shape
        const contourIndices = [
            10,   // Forehead top
            338,  // Right temple
            297,  // Right cheek
            332,  // Right jaw
            284,  // Right chin side
            152,  // Chin center
            104,  // Left chin side
            103,  // Left jaw
            67,   // Left cheek
            109,  // Left temple
            10    // Back to top (close loop)
        ];
        
        // Average skin color from face center area
        const skinColor = this.estimateSkinColor(faceLandmarks);
        
        // Create back vertices at different depths
        const depthLayers = [
            { depth: -0.8, scale: 1.0 },   // Near back
            { depth: -1.2, scale: 0.95 },  // Mid back
            { depth: -1.5, scale: 0.85 },  // Far back (narrower)
            { depth: -1.6, scale: 0.75 }   // Very far back (top of head)
        ];
        
        depthLayers.forEach((layer, layerIndex) => {
            contourIndices.forEach((faceIdx, i) => {
                const landmark = faceLandmarks[faceIdx];
                
                let x = (landmark.x - centerX) / scaleX * 2;
                let y = -(landmark.y - centerY) / scaleY * 2;
                let z = layer.depth;
                
                // Scale laterally for rounded head shape
                x *= layer.scale;
                
                // Curve the top of head upward
                if (i <= 2 || i >= contourIndices.length - 2) {
                    y += 0.2 * (1 - layer.scale); // Lift top vertices
                }
                
                // Round the sides
                if (i >= 3 && i <= 7) {
                    x *= 0.9; // Narrow the back
                }
                
                vertices.push({
                    x, y, z,
                    r: skinColor.r,
                    g: skinColor.g,
                    b: skinColor.b
                });
            });
        });
        
        return { vertices };
    }
    
    /**
     * Estimate average skin color from face
     */
    estimateSkinColor(faceLandmarks) {
        // Use cheek area for skin color
        // This is a placeholder - actual color comes from texture sampling
        return {
            r: 0.95,
            g: 0.85,
            b: 0.75
        };
    }
    
    /**
     * Generate triangulation connecting face to back of head
     */
    generateBackTriangulation(startIdx) {
        const indices = [];
        
        const contourCount = 11; // Number of contour points
        const layerCount = 4;     // Number of depth layers
        
        // Connect face contour to first back layer
        const faceContourIndices = [10, 338, 297, 332, 284, 152, 104, 103, 67, 109, 10];
        
        for (let i = 0; i < faceContourIndices.length - 1; i++) {
            const f1 = faceContourIndices[i];
            const f2 = faceContourIndices[i + 1];
            const b1 = startIdx + i;
            const b2 = startIdx + i + 1;
            
            // Two triangles connecting face to back
            indices.push(f1, b1, f2);
            indices.push(f2, b1, b2);
        }
        
        // Connect back layers together
        for (let layer = 0; layer < layerCount - 1; layer++) {
            const currentLayerStart = startIdx + layer * contourCount;
            const nextLayerStart = startIdx + (layer + 1) * contourCount;
            
            for (let i = 0; i < contourCount - 1; i++) {
                const c1 = currentLayerStart + i;
                const c2 = currentLayerStart + i + 1;
                const n1 = nextLayerStart + i;
                const n2 = nextLayerStart + i + 1;
                
                // Two triangles per quad
                indices.push(c1, n1, c2);
                indices.push(c2, n1, n2);
            }
        }
        
        // Close the top of head (cap)
        const lastLayerStart = startIdx + (layerCount - 1) * contourCount;
        const topCenter = lastLayerStart + contourCount; // Add one more vertex for center
        
        for (let i = 0; i < contourCount - 1; i++) {
            indices.push(lastLayerStart + i, topCenter, lastLayerStart + i + 1);
        }
        
        return indices;
    }
    
    /**
     * Add top center vertex for closing the head
     */
    addTopCenterVertex(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, skinColor) {
        // Top center of head
        const topLandmark = faceLandmarks[10]; // Forehead
        const x = 0; // Center
        const y = -(topLandmark.y - centerY) / scaleY * 2 + 0.4; // Above forehead
        const z = -1.7; // Far back
        
        return {
            x, y, z,
            r: skinColor.r,
            g: skinColor.g,
            b: skinColor.b
        };
    }
}