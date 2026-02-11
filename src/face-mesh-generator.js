import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation.js';

/**
 * Face Mesh Generator
 * Creates a 3D face mesh from MediaPipe landmarks with morph targets (blendshapes)
 */

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
        
        // Create faces using official MediaPipe triangulation
        const indices = [];
        for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
            indices.push(
                FACEMESH_TESSELATION[i],
                FACEMESH_TESSELATION[i + 1],
                FACEMESH_TESSELATION[i + 2]
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