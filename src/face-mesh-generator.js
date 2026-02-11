import * as THREE from 'three';

/**
 * Face Mesh Generator
 * Creates a 3D face mesh from MediaPipe landmarks with blendshape support
 */

// MediaPipe Face Mesh Triangulation
// Subset of key triangles for facial features
const FACE_TRIANGULATION = [
    // Face outline
    127, 34, 139, 11, 0, 37, 232, 231, 120, 72, 37, 39, 128, 121, 47, 232, 121, 128,
    104, 69, 67, 175, 171, 148, 157, 154, 155, 118, 50, 101, 73, 39, 40, 9, 151, 108,
    48, 115, 131, 194, 204, 211, 74, 40, 185, 80, 42, 183, 40, 92, 186, 230, 229, 118,
    202, 212, 214, 83, 18, 17, 76, 61, 146, 160, 29, 30, 56, 157, 173, 106, 204, 194,
    135, 214, 192, 203, 165, 98, 21, 71, 68, 51, 45, 4, 144, 24, 23, 77, 146, 91,
    205, 50, 187, 201, 200, 18, 91, 106, 182, 90, 91, 181, 85, 84, 17, 206, 203, 36,
    148, 171, 140, 92, 40, 39, 193, 189, 244, 159, 158, 28, 247, 246, 161, 236, 3, 196,
    54, 68, 104, 193, 168, 8, 117, 228, 31, 189, 193, 55, 98, 97, 99, 126, 47, 100,
    166, 79, 218, 155, 154, 26, 209, 49, 131, 135, 136, 150, 47, 126, 217, 223, 52, 53,
    45, 51, 134, 211, 170, 140, 67, 69, 108, 43, 106, 91, 230, 119, 120, 226, 130, 247,
    63, 53, 52, 238, 20, 242, 46, 70, 156, 78, 62, 96, 46, 53, 63, 143, 34, 227,
    123, 117, 111, 44, 125, 19, 236, 134, 51, 216, 206, 205, 154, 153, 22, 39, 37, 167,
    200, 201, 208, 36, 142, 100, 57, 212, 202, 20, 60, 99, 28, 158, 157, 35, 226, 113,
    160, 159, 27, 204, 202, 210, 113, 225, 46, 43, 202, 204, 62, 76, 77, 137, 123, 116,
    41, 38, 72, 203, 129, 142, 64, 98, 240, 49, 102, 64, 41, 73, 74, 212, 216, 207,
    42, 74, 184, 169, 170, 211, 170, 149, 176, 105, 66, 69, 122, 6, 168, 123, 147, 187,
    96, 77, 90, 65, 55, 107, 89, 90, 180, 101, 100, 120, 63, 105, 104, 93, 137, 227,
    15, 86, 85, 129, 102, 49, 14, 87, 86, 55, 8, 9, 100, 47, 121, 145, 23, 22,
    88, 89, 179, 6, 122, 196, 88, 95, 96, 138, 172, 136, 215, 58, 172, 115, 48, 219,
    42, 80, 81, 195, 3, 51, 43, 146, 61, 171, 175, 199, 81, 82, 38, 53, 46, 225,
    144, 163, 110, 246, 33, 7, 52, 65, 66, 229, 228, 117, 34, 127, 234, 107, 108, 69,
    109, 108, 151, 48, 64, 235, 62, 78, 191, 129, 209, 126, 111, 35, 143, 163, 161, 246,
    117, 123, 50, 222, 65, 52, 19, 125, 141, 221, 55, 65, 3, 195, 197, 25, 7, 33,
    220, 237, 44, 70, 71, 139, 122, 193, 245, 247, 130, 33, 71, 21, 162, 153, 158,
    133, 246, 247, 194, 204, 206, 194, 195, 204, 26, 161, 4, 207, 205, 36, 210, 214, 153,
    // Eyes
    33, 7, 163, 144, 145, 163, 163, 246, 33, 133, 155, 7, 246, 161, 160, 159, 145, 144,
    33, 246, 161, 246, 33, 173, 7, 173, 33,
    // Mouth
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181,
    91, 146, 61, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317,
    14, 87, 178, 88, 95, 78
];

export class FaceMeshGenerator {
    constructor() {
        this.geometry = null;
        this.material = null;
        this.mesh = null;
    }
    
    generate(landmarks, blendshapes, transformMatrix) {
        // Create geometry from landmarks
        this.geometry = new THREE.BufferGeometry();
        
        const vertices = [];
        const normals = [];
        
        // Convert landmarks to 3D vertices
        landmarks.forEach(landmark => {
            // MediaPipe coordinates are normalized [0,1]
            // Convert to centered 3D space [-0.5, 0.5]
            vertices.push(
                (landmark.x - 0.5) * 2,
                -(landmark.y - 0.5) * 2,
                landmark.z * 2
            );
        });
        
        // Apply blendshapes to vertices
        this.applyBlendshapes(vertices, blendshapes);
        
        // Create faces using triangulation
        const indices = [];
        for (let i = 0; i < FACE_TRIANGULATION.length; i += 3) {
            indices.push(
                FACE_TRIANGULATION[i],
                FACE_TRIANGULATION[i + 1],
                FACE_TRIANGULATION[i + 2]
            );
        }
        
        // Set geometry attributes
        this.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        
        // Create material with double-sided rendering
        this.material = new THREE.MeshPhongMaterial({
            color: 0xffdab9,
            shininess: 30,
            side: THREE.DoubleSide,
            flatShading: false,
            wireframe: false
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        
        // Apply transformation matrix if available
        if (transformMatrix) {
            this.applyTransformMatrix(transformMatrix);
        }
        
        // Add wireframe for debugging (optional)
        const wireframeGeometry = new THREE.WireframeGeometry(this.geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
            opacity: 0.1,
            transparent: true
        });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        this.mesh.add(wireframe);
        
        return this.mesh;
    }
    
    applyBlendshapes(vertices, blendshapes) {
        // Apply blendshape deformations
        // This is a simplified version - in production, you'd have
        // pre-calculated blendshape deltas for each vertex
        
        const jawOpen = blendshapes.jawOpen || 0;
        const mouthSmileLeft = blendshapes.mouthSmileLeft || 0;
        const mouthSmileRight = blendshapes.mouthSmileRight || 0;
        const browInnerUp = blendshapes.browInnerUp || 0;
        
        // Example: Apply jaw open to lower face vertices
        for (let i = 0; i < vertices.length / 3; i++) {
            const vertexIndex = i * 3;
            const y = vertices[vertexIndex + 1];
            
            // Lower face (jaw area)
            if (y < -0.2) {
                vertices[vertexIndex + 1] -= jawOpen * 0.15;
            }
            
            // Mouth corners for smile
            if (i === 61 || i === 291) { // Mouth corner indices
                vertices[vertexIndex + 1] += (mouthSmileLeft + mouthSmileRight) * 0.05;
            }
            
            // Eyebrows for surprise
            if (y > 0.3 && Math.abs(vertices[vertexIndex]) < 0.3) {
                vertices[vertexIndex + 1] += browInnerUp * 0.08;
            }
        }
    }
    
    applyTransformMatrix(matrix) {
        if (!this.mesh || !matrix) return;
        
        // MediaPipe transformation matrix is 4x4
        const m = new THREE.Matrix4();
        m.set(
            matrix.data[0], matrix.data[1], matrix.data[2], matrix.data[3],
            matrix.data[4], matrix.data[5], matrix.data[6], matrix.data[7],
            matrix.data[8], matrix.data[9], matrix.data[10], matrix.data[11],
            matrix.data[12], matrix.data[13], matrix.data[14], matrix.data[15]
        );
        
        this.mesh.applyMatrix4(m);
    }
    
    updateBlendshapes(blendshapes) {
        if (!this.geometry) return;
        
        const positions = this.geometry.attributes.position;
        const vertices = positions.array;
        
        // Reset to original positions (you'd store these separately in production)
        // Then re-apply blendshapes
        this.applyBlendshapes(vertices, blendshapes);
        
        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }
    
    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}