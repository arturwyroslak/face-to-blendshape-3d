/**
 * Head Geometry Generator
 * Extends face mesh with back and side vertices for complete head model
 * Uses spherical interpolation for natural head shape
 */

export class HeadGeometryGenerator {
    constructor() {
        this.backVertices = [];
        this.sideVertices = [];
    }
    
    /**
     * Generate complete head geometry from face landmarks
     * Uses face silhouette to create natural head back/sides
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
            colors.push(1, 1, 1); // White (will use texture)
        });
        
        // Define face outline/silhouette for head shape (full contour)
        const silhouetteIndices = [
            10,   // Top of forehead
            109,  // Left temple
            67,   // Left cheekbone
            103,  // Left jaw
            104,  // Left chin side
            105,  // Left lower chin
            152,  // Chin center
            106,  // Right lower chin
            182,  // Right chin side
            136,  // Right jaw
            150,  // Right cheekbone
            338,  // Right temple
            10    // Back to top (close loop)
        ];
        
        // Get skin color from texture or default
        const skinColor = { r: 0.92, g: 0.82, b: 0.72 };
        
        // Generate back of head using circular extrusion
        const backGeometry = this.generateSphericalBack(
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
        const backTriangulation = this.generateSmoothTriangulation(
            468, // Start index for back vertices
            silhouetteIndices,
            backGeometry.rings,
            backGeometry.verticesPerRing
        );
        
        return {
            vertices,
            colors,
            backTriangulation,
            vertexCount: vertices.length / 3
        };
    }
    
    /**
     * Generate spherical back of head
     */
    generateSphericalBack(faceLandmarks, silhouetteIndices, skinColor, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const rings = 8; // Number of circular rings around the head
        const verticesPerRing = silhouetteIndices.length - 1; // Exclude duplicate endpoint
        
        // Calculate head center and radius from face bounds
        const faceDepth = 0.0; // Face is at z=0 approximately
        const headRadius = 1.2; // Slightly larger than face
        
        // Generate vertices in rings around head
        for (let ring = 0; ring < rings; ring++) {
            const t = ring / (rings - 1); // 0 to 1
            
            // Angle from face (0°) to back (180°)
            const angle = t * Math.PI;
            
            // Radius gets smaller towards back (natural head shape)
            const radiusScale = 1.0 - (t * 0.2); // 100% at front, 80% at back
            
            // Vertical position shift (head narrows at top)
            const verticalScale = 1.0 - (t * 0.1);
            
            for (let i = 0; i < verticesPerRing; i++) {
                const silIdx = silhouetteIndices[i];
                const faceLandmark = faceLandmarks[silIdx];
                
                // Get position from face silhouette
                let x = (faceLandmark.x - centerX) / scaleX * 2;
                let y = -(faceLandmark.y - centerY) / scaleY * 2;
                
                // Calculate Z based on spherical projection
                const z = -Math.sin(angle) * headRadius * radiusScale;
                
                // Scale X,Y based on angle (shrink towards back)
                const xyScale = Math.cos(angle);
                x *= (xyScale * 0.3 + 0.7) * radiusScale; // Gradually narrow
                y *= verticalScale;
                
                // Additional adjustments for natural head shape
                if (i < verticesPerRing * 0.2 || i > verticesPerRing * 0.8) {
                    // Top of head - lift up and narrow
                    y += t * 0.3;
                    x *= 0.85;
                }
                
                if (i > verticesPerRing * 0.3 && i < verticesPerRing * 0.7) {
                    // Bottom of head - narrow more
                    x *= 0.9;
                }
                
                vertices.push({
                    x, y, z,
                    r: skinColor.r,
                    g: skinColor.g,
                    b: skinColor.b
                });
            }
        }
        
        // Add top cap vertex (apex of head)
        const topY = -(faceLandmarks[10].y - centerY) / scaleY * 2 + 0.4;
        vertices.push({
            x: 0,
            y: topY,
            z: -headRadius * 0.6,
            r: skinColor.r,
            g: skinColor.g,
            b: skinColor.b
        });
        
        return {
            vertices,
            rings,
            verticesPerRing
        };
    }
    
    /**
     * Generate smooth triangulation connecting face to back
     */
    generateSmoothTriangulation(startIdx, silhouetteIndices, rings, verticesPerRing) {
        const indices = [];
        
        // Connect face silhouette to first ring of back
        for (let i = 0; i < verticesPerRing; i++) {
            const faceIdx = silhouetteIndices[i];
            const nextFaceIdx = silhouetteIndices[i + 1];
            const backIdx = startIdx + i;
            const nextBackIdx = startIdx + ((i + 1) % verticesPerRing);
            
            // Two triangles forming quad
            indices.push(faceIdx, nextFaceIdx, backIdx);
            indices.push(nextFaceIdx, nextBackIdx, backIdx);
        }
        
        // Connect rings together
        for (let ring = 0; ring < rings - 1; ring++) {
            const currentRingStart = startIdx + ring * verticesPerRing;
            const nextRingStart = startIdx + (ring + 1) * verticesPerRing;
            
            for (let i = 0; i < verticesPerRing; i++) {
                const curr = currentRingStart + i;
                const next = currentRingStart + ((i + 1) % verticesPerRing);
                const currNext = nextRingStart + i;
                const nextNext = nextRingStart + ((i + 1) % verticesPerRing);
                
                // Two triangles per quad
                indices.push(curr, next, currNext);
                indices.push(next, nextNext, currNext);
            }
        }
        
        // Connect last ring to top cap
        const lastRingStart = startIdx + (rings - 1) * verticesPerRing;
        const topCapIdx = startIdx + rings * verticesPerRing;
        
        for (let i = 0; i < verticesPerRing; i++) {
            const curr = lastRingStart + i;
            const next = lastRingStart + ((i + 1) % verticesPerRing);
            
            indices.push(curr, next, topCapIdx);
        }
        
        return indices;
    }
}