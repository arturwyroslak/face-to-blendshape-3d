import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation.js';
import { HeadGeometryGenerator } from './head-geometry-generator.js';

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
        this.headGenerator = new HeadGeometryGenerator();
    }
    
    generateWithMorphTargets(landmarks, blendshapes, transformMatrix, textureCanvas) {
        // Create base geometry
        this.geometry = new THREE.BufferGeometry();
        
        // Calculate bounds for proper scaling
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        landmarks.forEach(landmark => {
            minX = Math.min(minX, landmark.x);
            maxX = Math.max(maxX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxY = Math.max(maxY, landmark.y);
            minZ = Math.min(minZ, landmark.z);
            maxZ = Math.max(maxZ, landmark.z);
        });
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const scaleX = maxX - minX;
        const scaleY = maxY - minY;
        const scaleZ = Math.max(scaleX, scaleY) * 2;
        
        // Generate complete head geometry
        const headData = this.headGenerator.generateCompleteHead(
            landmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ
        );
        
        // Add top center vertex
        const skinColor = { r: 0.95, g: 0.85, b: 0.75 };
        const topVertex = this.headGenerator.addTopCenterVertex(
            landmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, skinColor
        );
        headData.vertices.push(topVertex.x, topVertex.y, topVertex.z);
        headData.colors.push(topVertex.r, topVertex.g, topVertex.b);
        
        // Sample skin color from texture
        const sampledSkinColor = this.sampleSkinColorFromTexture(textureCanvas);
        
        // Update vertex colors with sampled skin color
        const faceVertexCount = landmarks.length;
        for (let i = faceVertexCount * 3; i < headData.colors.length; i += 3) {
            headData.colors[i] = sampledSkinColor.r;
            headData.colors[i + 1] = sampledSkinColor.g;
            headData.colors[i + 2] = sampledSkinColor.b;
        }
        
        // Create UVs
        const uvs = [];
        landmarks.forEach(landmark => {
            uvs.push(landmark.x, 1.0 - landmark.y);
        });
        
        // Back vertices have no texture
        const backVertexCount = headData.vertices.length / 3 - landmarks.length;
        for (let i = 0; i < backVertexCount; i++) {
            uvs.push(0, 0); // Dummy UVs
        }
        
        // Store base vertices
        this.baseVertices = Float32Array.from(headData.vertices);
        
        // Combine face and back triangulation
        const indices = [];
        
        // Face triangulation (with reversed winding)
        for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
            indices.push(
                FACEMESH_TESSELATION[i],
                FACEMESH_TESSELATION[i + 2],
                FACEMESH_TESSELATION[i + 1]
            );
        }
        
        // Back triangulation
        headData.backTriangulation.forEach(idx => indices.push(idx));
        
        // Set geometry attributes
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(headData.vertices, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(headData.colors, 3));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        
        // Create morph targets
        this.createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ);
        
        // Create texture
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Create material with texture AND vertex colors
        this.material = new THREE.MeshStandardMaterial({
            map: texture,
            vertexColors: true, // Enable vertex colors for back of head
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.FrontSide,
            flatShading: false,
            transparent: false
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
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
    
    /**
     * Sample average skin color from texture (cheek area)
     */
    sampleSkinColorFromTexture(textureCanvas) {
        const ctx = textureCanvas.getContext('2d');
        const width = textureCanvas.width;
        const height = textureCanvas.height;
        
        // Sample from cheek area (approximate)
        const sampleX = Math.floor(width * 0.3);
        const sampleY = Math.floor(height * 0.4);
        const sampleSize = 20;
        
        try {
            const imageData = ctx.getImageData(sampleX, sampleY, sampleSize, sampleSize);
            const data = imageData.data;
            
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
            
            return {
                r: (r / count) / 255,
                g: (g / count) / 255,
                b: (b / count) / 255
            };
        } catch (e) {
            // Fallback skin color
            return { r: 0.95, g: 0.85, b: 0.75 };
        }
    }
    
    createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const morphTargets = [];
        const morphTargetNames = [];
        
        // Create morph target for each ARKit blendshape
        MORPH_TARGET_NAMES.forEach(blendshapeName => {
            const morphPositions = this.calculateMorphTarget(
                landmarks, 
                blendshapeName, 
                centerX, 
                centerY, 
                centerZ, 
                scaleX, 
                scaleY, 
                scaleZ
            );
            
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
    
    calculateMorphTarget(landmarks, blendshapeName, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const vertices = [];
        const multiplier = 0.1;
        
        landmarks.forEach((landmark, index) => {
            let x = (landmark.x - centerX) / scaleX * 2;
            let y = -(landmark.y - centerY) / scaleY * 2;
            let z = -((landmark.z - centerZ) / scaleZ * 2);
            
            // Apply deformations based on blendshape type
            switch(blendshapeName) {
                case 'jawOpen':
                    if (y < 0) y -= multiplier * 0.5;
                    break;
                case 'mouthSmileLeft':
                    if (index === 61 || index === 62 || index === 308) y += multiplier * 0.3;
                    break;
                case 'mouthSmileRight':
                    if (index === 291 || index === 292 || index === 78) y += multiplier * 0.3;
                    break;
                case 'eyeBlinkLeft':
                    if (index >= 33 && index <= 133) y -= multiplier * 0.2;
                    break;
                case 'eyeBlinkRight':
                    if (index >= 362 && index <= 398) y -= multiplier * 0.2;
                    break;
                case 'browInnerUp':
                    if (index === 107 || index === 336) y += multiplier * 0.4;
                    break;
                case 'browOuterUpLeft':
                    if (index === 70 || index === 46 || index === 63) y += multiplier * 0.4;
                    break;
                case 'browOuterUpRight':
                    if (index === 300 || index === 276 || index === 293) y += multiplier * 0.4;
                    break;
                case 'mouthFunnel':
                    if ([0, 17, 61, 291].includes(index)) {
                        z += multiplier * 0.3;
                        x *= 0.8;
                        y *= 0.9;
                    }
                    break;
                case 'mouthPucker':
                    if ([61, 291, 0, 17, 78, 308].includes(index)) {
                        z -= multiplier * 0.3;
                        x *= 0.7;
                    }
                    break;
                case 'cheekPuff':
                    if ([118, 347, 425, 205, 36, 266].includes(index)) {
                        x *= 1.15;
                        z -= multiplier * 0.2;
                    }
                    break;
                case 'noseSneerLeft':
                    if ([219, 49, 129].includes(index)) y += multiplier * 0.15;
                    break;
                case 'noseSneerRight':
                    if ([439, 279, 358].includes(index)) y += multiplier * 0.15;
                    break;
                case 'jawForward':
                    if (y < -0.2) z -= multiplier * 0.4;
                    break;
                case 'jawLeft':
                    if (y < -0.1) x -= multiplier * 0.3;
                    break;
                case 'jawRight':
                    if (y < -0.1) x += multiplier * 0.3;
                    break;
                case 'eyeLookUpLeft':
                case 'eyeLookUpRight':
                    if ((index >= 33 && index <= 133) || (index >= 362 && index <= 398)) {
                        y += multiplier * 0.08;
                    }
                    break;
                case 'eyeLookDownLeft':
                case 'eyeLookDownRight':
                    if ((index >= 33 && index <= 133) || (index >= 362 && index <= 398)) {
                        y -= multiplier * 0.08;
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