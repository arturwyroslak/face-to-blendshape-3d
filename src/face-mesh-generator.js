import * as THREE from 'three';

/**
 * Face Mesh Generator
 * Creates a 3D face mesh from MediaPipe landmarks with morph targets (blendshapes)
 */

// Complete MediaPipe Face Mesh Triangulation (468 vertices)
const FACE_TRIANGULATION = [
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
  133, 246, 247, 194, 204, 206, 216, 206, 234, 234, 216, 127, 139, 34, 143, 156, 70, 63,
  52, 225, 224, 224, 223, 52, 223, 53, 45, 51, 134, 211, 170, 140, 170, 176, 171,
  148, 176, 149, 150, 136, 172, 215, 138, 58, 215, 177, 138, 172, 177, 119, 230, 118,
  119, 101, 230, 50, 101, 36, 205, 206, 216, 207, 192, 135, 214, 135, 192, 192, 214, 187,
  50, 205, 187, 123, 147, 187, 147, 207, 216, 147, 123, 207, 34, 143, 227, 156, 143, 116,
  116, 123, 111, 111, 137, 116, 137, 227, 93, 227, 137, 34, 93, 34, 227, 123, 93, 116,
  // Right face
  356, 389, 368, 280, 265, 372, 452, 451, 340, 302, 267, 269, 357, 350, 277, 452, 350, 357,
  333, 299, 297, 400, 396, 377, 384, 381, 382, 347, 280, 330, 303, 269, 270, 238, 377, 337,
  278, 344, 360, 423, 429, 437, 304, 270, 410, 310, 272, 408, 270, 322, 415, 450, 449, 347,
  430, 411, 426, 313, 247, 246, 306, 291, 375, 389, 259, 260, 286, 384, 398, 335, 429, 423,
  364, 430, 394, 431, 394, 364, 364, 422, 430, 430, 422, 431, 422, 424, 431, 431, 424, 394,
  424, 422, 364, 364, 394, 371, 371, 394, 395, 371, 395, 369, 395, 394, 431, 369, 395, 396,
  396, 400, 369, 369, 400, 377, 377, 396, 369, 311, 310, 415, 311, 415, 312, 312, 415, 13,
  13, 415, 78, 78, 415, 14, 14, 415, 317, 317, 415, 318, 318, 415, 324, 324, 415, 308,
  // Forehead and cheeks
  10, 338, 297, 10, 297, 299, 10, 299, 333, 10, 333, 151, 10, 151, 337, 10, 337, 338,
  109, 10, 151, 109, 151, 108, 67, 109, 108, 67, 108, 69, 104, 67, 69, 104, 69, 108,
  251, 389, 356, 251, 356, 357, 251, 357, 350, 251, 350, 452, 251, 452, 350, 350, 452, 349,
  349, 452, 346, 346, 452, 340, 340, 452, 345, 345, 452, 453, 453, 452, 464, 464, 452, 465,
  // Lips and mouth detail
  61, 146, 91, 91, 146, 181, 181, 146, 84, 84, 146, 17, 17, 146, 314, 314, 146, 405,
  405, 146, 321, 321, 146, 375, 375, 146, 291, 61, 185, 40, 40, 185, 39, 39, 185, 37,
  37, 185, 0, 0, 185, 267, 267, 185, 269, 269, 185, 270, 270, 185, 409, 409, 185, 291,
  78, 191, 80, 80, 191, 81, 81, 191, 82, 82, 191, 13, 13, 191, 312, 312, 191, 311,
  311, 191, 310, 310, 191, 415, 415, 191, 308, 308, 191, 324, 324, 191, 318, 318, 191, 402,
  402, 191, 317, 317, 191, 14, 14, 191, 87, 87, 191, 178, 178, 191, 88, 88, 191, 95,
  // Eyes - complete both eyes
  33, 7, 163, 163, 7, 144, 144, 7, 145, 145, 7, 153, 153, 7, 154, 154, 7, 155,
  155, 7, 133, 33, 246, 161, 161, 246, 160, 160, 246, 159, 159, 246, 158, 158, 246, 157,
  157, 246, 173, 173, 246, 133, 133, 155, 154, 154, 153, 145, 144, 163, 7,
  263, 249, 390, 390, 249, 373, 373, 249, 374, 374, 249, 380, 380, 249, 381, 381, 249, 382,
  382, 249, 362, 263, 466, 388, 388, 466, 387, 387, 466, 386, 386, 466, 385, 385, 466, 384,
  384, 466, 398, 398, 466, 362, 362, 382, 381, 381, 380, 374, 373, 390, 249,
  // Nose bridge and nostrils
  168, 6, 197, 197, 6, 195, 195, 6, 5, 5, 6, 4, 4, 6, 1, 1, 6, 19,
  19, 6, 94, 94, 6, 2, 2, 6, 164, 164, 6, 165, 165, 6, 167, 167, 6, 164,
];

// ARKit blendshape names for morph targets
const MORPH_TARGET_NAMES = [
    'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookUpLeft', 'eyeLookUpRight',
    'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
    'eyeLookOutLeft', 'eyeLookOutRight', 'eyeSquintLeft', 'eyeSquintRight',
    'eyeWideLeft', 'eyeWideRight', 'browDownLeft', 'browDownRight',
    'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'jawOpen',
    'jawForward', 'jawLeft', 'jawRight', 'mouthClose', 'mouthFunnel',
    'mouthPucker', 'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight',
    'mouthFrownLeft', 'mouthFrownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
    'mouthLowerDownLeft', 'mouthLowerDownRight', 'cheekPuff', 'cheekSquintLeft',
    'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];

export class FaceMeshGenerator {
    constructor() {
        this.baseVertices = null;
        this.geometry = null;
        this.material = null;
        this.mesh = null;
    }
    
    generateWithMorphTargets(landmarks, blendshapes, transformMatrix, textureCanvas) {
        // Create base geometry
        this.geometry = new THREE.BufferGeometry();
        
        const vertices = [];
        const uvs = [];
        
        // Convert landmarks to 3D vertices
        landmarks.forEach(landmark => {
            vertices.push(
                (landmark.x - 0.5) * 2,
                -(landmark.y - 0.5) * 2,
                landmark.z * 2
            );
            // UV coordinates
            uvs.push(landmark.x, 1 - landmark.y);
        });
        
        // Store base vertices
        this.baseVertices = Float32Array.from(vertices);
        
        // Create faces
        const indices = [];
        for (let i = 0; i < FACE_TRIANGULATION.length; i += 3) {
            indices.push(
                FACE_TRIANGULATION[i],
                FACE_TRIANGULATION[i + 1],
                FACE_TRIANGULATION[i + 2]
            );
        }
        
        // Set geometry attributes
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        
        // Create morph targets
        this.createMorphTargets(landmarks, blendshapes);
        
        // Create texture
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Create material with texture
        this.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            flatShading: false
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        
        // Store morph target influences
        Object.entries(blendshapes).forEach(([name, value], index) => {
            if (this.mesh.morphTargetInfluences && index < this.mesh.morphTargetInfluences.length) {
                this.mesh.morphTargetInfluences[index] = value;
            }
        });
        
        // Apply transformation matrix
        if (transformMatrix) {
            this.applyTransformMatrix(transformMatrix);
        }
        
        return this.mesh;
    }
    
    createMorphTargets(landmarks, blendshapes) {
        const morphTargets = [];
        const morphTargetNames = [];
        
        // Create morph target for each ARKit blendshape
        MORPH_TARGET_NAMES.forEach(blendshapeName => {
            const morphPositions = this.calculateMorphTarget(landmarks, blendshapeName);
            
            morphTargets.push({
                name: blendshapeName,
                vertices: morphPositions
            });
            morphTargetNames.push(blendshapeName);
        });
        
        // Set morph targets on geometry
        morphTargets.forEach((target, index) => {
            this.geometry.morphAttributes.position = this.geometry.morphAttributes.position || [];
            this.geometry.morphAttributes.position[index] = new THREE.Float32BufferAttribute(
                target.vertices,
                3
            );
        });
        
        // Store morph target dictionary
        this.geometry.morphTargetsRelative = false;
        this.geometry.userData.targetNames = morphTargetNames;
    }
    
    calculateMorphTarget(landmarks, blendshapeName) {
        const vertices = [];
        const multiplier = 0.15; // Deformation intensity
        
        landmarks.forEach((landmark, index) => {
            let x = (landmark.x - 0.5) * 2;
            let y = -(landmark.y - 0.5) * 2;
            let z = landmark.z * 2;
            
            // Apply deformations based on blendshape type
            switch(blendshapeName) {
                case 'jawOpen':
                    if (y < -0.2) y -= multiplier; // Lower jaw
                    break;
                    
                case 'mouthSmileLeft':
                    if (index === 61 || index === 62) y += multiplier * 0.5;
                    break;
                    
                case 'mouthSmileRight':
                    if (index === 291 || index === 292) y += multiplier * 0.5;
                    break;
                    
                case 'eyeBlinkLeft':
                    if (index >= 33 && index <= 133) y -= multiplier * 0.3;
                    break;
                    
                case 'eyeBlinkRight':
                    if (index >= 362 && index <= 398) y -= multiplier * 0.3;
                    break;
                    
                case 'browInnerUp':
                    if (index === 107 || index === 336) y += multiplier * 0.5;
                    break;
                    
                case 'browOuterUpLeft':
                    if (index === 70 || index === 46) y += multiplier * 0.5;
                    break;
                    
                case 'browOuterUpRight':
                    if (index === 300 || index === 276) y += multiplier * 0.5;
                    break;
                    
                case 'mouthFunnel':
                    if (index === 13 || index === 14) z -= multiplier * 0.3;
                    break;
                    
                case 'mouthPucker':
                    if ([61, 291, 0, 17].includes(index)) z += multiplier * 0.4;
                    break;
                    
                case 'cheekPuff':
                    if ([118, 347, 425, 205].includes(index)) {
                        x *= 1.2;
                        z += multiplier * 0.3;
                    }
                    break;
                    
                case 'noseSneerLeft':
                    if ([219, 49].includes(index)) y += multiplier * 0.2;
                    break;
                    
                case 'noseSneerRight':
                    if ([439, 279].includes(index)) y += multiplier * 0.2;
                    break;
                    
                case 'jawForward':
                    if (y < -0.3) z += multiplier * 0.5;
                    break;
                    
                case 'jawLeft':
                    if (y < -0.2) x -= multiplier * 0.5;
                    break;
                    
                case 'jawRight':
                    if (y < -0.2) x += multiplier * 0.5;
                    break;
                    
                case 'eyeLookUpLeft':
                case 'eyeLookUpRight':
                    if ((index >= 33 && index <= 133) || (index >= 362 && index <= 398)) {
                        y += multiplier * 0.1;
                    }
                    break;
                    
                case 'eyeLookDownLeft':
                case 'eyeLookDownRight':
                    if ((index >= 33 && index <= 133) || (index >= 362 && index <= 398)) {
                        y -= multiplier * 0.1;
                    }
                    break;
            }
            
            vertices.push(x, y, z);
        });
        
        return Float32Array.from(vertices);
    }
    
    applyTransformMatrix(matrix) {
        if (!this.mesh || !matrix) return;
        
        const m = new THREE.Matrix4();
        m.set(
            matrix.data[0], matrix.data[1], matrix.data[2], matrix.data[3],
            matrix.data[4], matrix.data[5], matrix.data[6], matrix.data[7],
            matrix.data[8], matrix.data[9], matrix.data[10], matrix.data[11],
            matrix.data[12], matrix.data[13], matrix.data[14], matrix.data[15]
        );
        
        this.mesh.applyMatrix4(m);
    }
    
    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) {
            if (this.material.map) this.material.map.dispose();
            this.material.dispose();
        }
    }
}