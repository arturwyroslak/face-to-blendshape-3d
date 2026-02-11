import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation.js';
import { HeadGeometryGenerator } from './head-geometry-generator.js';

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
        this.geometry = new THREE.BufferGeometry();
        
        // Calculate bounds for geometry AND UV mapping
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
        
        // Independent X/Y scaling to preserve face aspect ratio
        const scaleX = maxX - minX;
        const scaleY = maxY - minY;
        // Z uses a fixed normalization factor (MediaPipe Z is in different scale)
        // Similar to spite's approach: -p[2] / 500
        // MediaPipe normalizedLandmarks Z is roughly in range [-0.5, 0.5] relative to image width
        const scaleZ = Math.max(scaleX, scaleY);  // Match X/Y scale for proper depth ratio
        
        // Calculate texture crop bounds (same as TextureMapper)
        const padding = 0.2;
        const faceWidth = maxX - minX;
        const faceHeight = maxY - minY;
        const cropSize = Math.max(faceWidth, faceHeight) * (1 + padding);
        const textureCenterX = centerX;
        const textureCenterY = centerY;
        const textureMinX = textureCenterX - cropSize / 2;
        const textureMinY = textureCenterY - cropSize / 2;
        
        // Sample skin color
        const sampledSkinColor = this.sampleSkinColorFromTexture(textureCanvas);
        
        // Generate complete head
        const headData = this.headGenerator.generateCompleteHead(
            landmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ
        );
        
        // Update back colors
        const faceVertexCount = landmarks.length;
        for (let i = faceVertexCount * 3; i < headData.colors.length; i += 3) {
            headData.colors[i] = sampledSkinColor.r;
            headData.colors[i + 1] = sampledSkinColor.g;
            headData.colors[i + 2] = sampledSkinColor.b;
        }
        
        // Create UVs normalized to texture crop region (matching TextureMapper)
        const uvs = [];
        landmarks.forEach(landmark => {
            // Normalize landmark position to texture crop region
            const u = (landmark.x - textureMinX) / cropSize;
            const v = 1.0 - (landmark.y - textureMinY) / cropSize;  // Flip Y
            uvs.push(u, v);
        });
        
        // Back vertices dummy UVs
        const backVertexCount = headData.vertices.length / 3 - landmarks.length;
        for (let i = 0; i < backVertexCount; i++) {
            uvs.push(0, 0);
        }
        
        this.baseVertices = Float32Array.from(headData.vertices);
        
        // Set attributes
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(headData.vertices, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(headData.colors, 3));
        
        // Triangulation - face + back
        const indices = [];
        
        // Face triangulation
        for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
            indices.push(
                FACEMESH_TESSELATION[i],
                FACEMESH_TESSELATION[i + 1],
                FACEMESH_TESSELATION[i + 2]
            );
        }
        
        // Back triangulation
        headData.backTriangulation.forEach(idx => indices.push(idx));
        
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        
        // Morph targets
        this.createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, headData.vertices.length / 3);
        
        // Texture
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Material with vertex colors for back
        this.material = new THREE.MeshStandardMaterial({
            map: texture,
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.FrontSide
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Apply blendshapes
        Object.entries(blendshapes).forEach(([name, value], index) => {
            if (this.mesh.morphTargetInfluences && index < this.mesh.morphTargetInfluences.length) {
                this.mesh.morphTargetInfluences[index] = value;
            }
        });
        
        if (transformMatrix) {
            this.applyTransformMatrix(transformMatrix);
        }
        
        return this.mesh;
    }
    
    sampleSkinColorFromTexture(textureCanvas) {
        const ctx = textureCanvas.getContext('2d');
        const width = textureCanvas.width;
        const height = textureCanvas.height;
        
        const sampleX = Math.floor(width * 0.35);
        const sampleY = Math.floor(height * 0.45);
        const sampleSize = 30;
        
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
            return { r: 0.92, g: 0.82, b: 0.72 };
        }
    }
    
    createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, totalVertexCount) {
        const morphTargets = [];
        const morphTargetNames = [];
        
        MORPH_TARGET_NAMES.forEach(blendshapeName => {
            const morphPositions = this.calculateMorphTarget(
                landmarks, blendshapeName, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, totalVertexCount
            );
            
            morphTargets.push({ name: blendshapeName, vertices: morphPositions });
            morphTargetNames.push(blendshapeName);
        });
        
        morphTargets.forEach((target, index) => {
            this.geometry.morphAttributes.position = this.geometry.morphAttributes.position || [];
            this.geometry.morphAttributes.position[index] = new THREE.Float32BufferAttribute(target.vertices, 3);
        });
        
        this.geometry.morphTargetsRelative = false;
        this.geometry.userData.targetNames = morphTargetNames;
    }
    
    calculateMorphTarget(landmarks, blendshapeName, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, totalVertexCount) {
        const vertices = [];
        const multiplier = 0.1;
        
        landmarks.forEach((landmark, index) => {
            let x = (landmark.x - centerX) / scaleX * 2;
            let y = -(landmark.y - centerY) / scaleY * 2;
            let z = -((landmark.z - centerZ) / scaleZ * 2);
            
            switch(blendshapeName) {
                case 'jawOpen':
                    if (y < 0) y -= multiplier * 0.5;
                    break;
                case 'eyeBlinkLeft':
                    if (index >= 33 && index <= 133) y -= multiplier * 0.2;
                    break;
                case 'eyeBlinkRight':
                    if (index >= 362 && index <= 398) y -= multiplier * 0.2;
                    break;
            }
            
            vertices.push(x, y, z);
        });
        
        // Back vertices don't morph
        const backVertexCount = totalVertexCount - landmarks.length;
        for (let i = 0; i < backVertexCount; i++) {
            const baseIdx = (landmarks.length + i) * 3;
            vertices.push(
                this.baseVertices[baseIdx],
                this.baseVertices[baseIdx + 1],
                this.baseVertices[baseIdx + 2]
            );
        }
        
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