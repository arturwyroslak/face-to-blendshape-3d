/**
 * Head Geometry Generator
 * Creates smooth ellipsoid back for head
 */

export class HeadGeometryGenerator {
    constructor() {}
    
    generateCompleteHead(faceLandmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const colors = [];
        
        // Face vertices (0-467)
        faceLandmarks.forEach((landmark) => {
            const x = (landmark.x - centerX) / scaleX * 2;
            const y = -(landmark.y - centerY) / scaleY * 2;
            const z = -((landmark.z - centerZ) / scaleZ * 2);
            
            vertices.push(x, y, z);
            colors.push(1, 1, 1);
        });
        
        // Key silhouette points
        const silhouette = [10, 109, 67, 103, 54, 234, 454, 356, 389, 264, 356, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 127];
        
        const skinColor = { r: 0.92, g: 0.82, b: 0.72 };
        const backData = this.createEllipsoidBack(faceLandmarks, silhouette, skinColor, centerX, centerY, centerZ, scaleX, scaleY, scaleZ);
        
        backData.vertices.forEach(v => {
            vertices.push(v.x, v.y, v.z);
            colors.push(v.r, v.g, v.b);
        });
        
        const backTriangulation = this.triangulateBack(468, silhouette, backData.segments, backData.rings);
        
        return {
            vertices,
            colors,
            backTriangulation,
            backSegments: backData.segments,
            backRings: backData.rings,
            vertexCount: vertices.length / 3
        };
    }
    
    createEllipsoidBack(faceLandmarks, silhouette, skinColor, cx, cy, cz, sx, sy, sz) {
        const vertices = [];
        const segments = 30;
        const rings = 5;
        
        // Calculate head dimensions
        const headWidth = 1.0;
        const headHeight = 1.3;
        const headDepth = 1.1;
        
        // Generate back as ellipsoid surface
        for (let ring = 0; ring <= rings; ring++) {
            const v = ring / rings; // 0 to 1
            const phi = v * Math.PI; // 0 to PI (top to bottom)
            
            for (let seg = 0; seg < segments; seg++) {
                const u = seg / segments; // 0 to 1
                const theta = Math.PI + u * Math.PI; // PI to 2PI (back hemisphere)
                
                // Ellipsoid parametric equations
                const x = headWidth * Math.sin(phi) * Math.cos(theta) * 0.5;
                const y = headHeight * Math.cos(phi) * 0.5;
                const z = -headDepth * Math.sin(phi) * Math.sin(theta) * 0.5 - 0.3;
                
                vertices.push({ x, y, z, r: skinColor.r, g: skinColor.g, b: skinColor.b });
            }
        }
        
        return { vertices, segments, rings };
    }
    
    triangulateBack(startIdx, silhouette, segments, rings) {
        const indices = [];
        
        // Connect face to back (first ring)
        for (let i = 0; i < silhouette.length; i++) {
            const faceIdx = silhouette[i];
            const nextFaceIdx = silhouette[(i + 1) % silhouette.length];
            const backIdx = startIdx + i % segments;
            const nextBackIdx = startIdx + ((i + 1) % segments);
            
            indices.push(faceIdx, nextFaceIdx, backIdx);
            indices.push(nextFaceIdx, nextBackIdx, backIdx);
        }
        
        // Connect rings
        for (let ring = 0; ring < rings; ring++) {
            for (let seg = 0; seg < segments; seg++) {
                const current = startIdx + ring * segments + seg;
                const next = startIdx + ring * segments + ((seg + 1) % segments);
                const below = startIdx + (ring + 1) * segments + seg;
                const belowNext = startIdx + (ring + 1) * segments + ((seg + 1) % segments);
                
                indices.push(current, next, below);
                indices.push(next, belowNext, below);
            }
        }
        
        return indices;
    }
}