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
        this.faceGeometry = null;
        this.backGeometry = null;
        this.faceMaterial = null;
        this.backMaterial = null;
        this.mesh = null;
        this.headGenerator = new HeadGeometryGenerator();
    }
    
    generateWithMorphTargets(landmarks, blendshapes, transformMatrix, textureCanvas) {
        // Calculate bounds
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
        
        // Sample skin color
        const sampledSkinColor = this.sampleSkinColorFromTexture(textureCanvas);
        
        // Generate complete head data
        const headData = this.headGenerator.generateCompleteHead(
            landmarks, centerX, centerY, centerZ, scaleX, scaleY, scaleZ
        );
        
        // Create FACE geometry (only face vertices)
        this.faceGeometry = new THREE.BufferGeometry();
        
        const faceVertices = [];
        const faceUVs = [];
        
        landmarks.forEach((landmark, index) => {
            const x = (landmark.x - centerX) / scaleX * 2;
            const y = -(landmark.y - centerY) / scaleY * 2;
            const z = -((landmark.z - centerZ) / scaleZ * 2);
            
            faceVertices.push(x, y, z);
            faceUVs.push(landmark.x, 1.0 - landmark.y);
        });
        
        this.faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(faceVertices, 3));
        this.faceGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(faceUVs, 2));
        
        // Face triangulation (reversed winding)
        const faceIndices = [];
        for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
            faceIndices.push(
                FACEMESH_TESSELATION[i],
                FACEMESH_TESSELATION[i + 2],
                FACEMESH_TESSELATION[i + 1]
            );
        }
        this.faceGeometry.setIndex(faceIndices);
        this.faceGeometry.computeVertexNormals();
        
        // Create texture
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Face material with texture
        this.faceMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.FrontSide
        });
        
        // Create BACK geometry (only back vertices)
        this.backGeometry = new THREE.BufferGeometry();
        
        const backVertices = [];
        const backColors = [];
        
        // Extract back vertices from headData
        const faceVertexCount = landmarks.length;
        const backVertexCount = (headData.vertices.length / 3) - faceVertexCount;
        
        for (let i = 0; i < backVertexCount; i++) {
            const idx = (faceVertexCount + i) * 3;
            backVertices.push(
                headData.vertices[idx],
                headData.vertices[idx + 1],
                headData.vertices[idx + 2]
            );
            backColors.push(
                sampledSkinColor.r,
                sampledSkinColor.g,
                sampledSkinColor.b
            );
        }
        
        this.backGeometry.setAttribute('position', new THREE.Float32BufferAttribute(backVertices, 3));
        this.backGeometry.setAttribute('color', new THREE.Float32BufferAttribute(backColors, 3));
        
        // Adjust back triangulation indices (subtract face vertex count)
        const backIndices = headData.backTriangulation.map(idx => {
            if (idx >= faceVertexCount) {
                return idx - faceVertexCount;
            }
            return idx; // Keep face indices as-is for connection
        });
        
        // Actually we need to handle this differently
        // Back triangulation connects face to back, so we need to split it
        const pureBackIndices = [];
        
        // Only include triangles that are purely in the back
        // This is complex - let's regenerate back triangulation properly
        const backSegments = headData.backSegments || 30;
        const backRings = headData.backRings || 5;
        
        // Generate triangulation for back only (not connecting to face)
        for (let ring = 0; ring < backRings; ring++) {
            for (let seg = 0; seg < backSegments; seg++) {
                const current = ring * backSegments + seg;
                const next = ring * backSegments + ((seg + 1) % backSegments);
                const below = (ring + 1) * backSegments + seg;
                const belowNext = (ring + 1) * backSegments + ((seg + 1) % backSegments);
                
                if (ring < backRings - 1) {
                    pureBackIndices.push(current, next, below);
                    pureBackIndices.push(next, belowNext, below);
                }
            }
        }
        
        this.backGeometry.setIndex(pureBackIndices);
        this.backGeometry.computeVertexNormals();
        
        // Back material with vertex colors
        this.backMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        
        // Create group to hold both meshes
        this.mesh = new THREE.Group();
        
        const faceMesh = new THREE.Mesh(this.faceGeometry, this.faceMaterial);
        const backMesh = new THREE.Mesh(this.backGeometry, this.backMaterial);
        
        faceMesh.castShadow = true;
        faceMesh.receiveShadow = true;
        backMesh.castShadow = true;
        backMesh.receiveShadow = true;
        
        this.mesh.add(faceMesh);
        this.mesh.add(backMesh);
        
        // Store for morph targets
        this.baseVertices = Float32Array.from(faceVertices);
        
        // Create morph targets for face
        this.createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ);
        
        // Apply morph target influences
        Object.entries(blendshapes).forEach(([name, value], index) => {
            if (faceMesh.morphTargetInfluences && index < faceMesh.morphTargetInfluences.length) {
                faceMesh.morphTargetInfluences[index] = value;
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
    
    createMorphTargets(landmarks, blendshapes, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
        const morphTargets = [];
        const morphTargetNames = [];
        
        MORPH_TARGET_NAMES.forEach(blendshapeName => {
            const morphPositions = this.calculateMorphTarget(
                landmarks, blendshapeName, centerX, centerY, centerZ, scaleX, scaleY, scaleZ
            );
            
            morphTargets.push({ name: blendshapeName, vertices: morphPositions });
            morphTargetNames.push(blendshapeName);
        });
        
        morphTargets.forEach((target, index) => {
            this.faceGeometry.morphAttributes.position = this.faceGeometry.morphAttributes.position || [];
            this.faceGeometry.morphAttributes.position[index] = new THREE.Float32BufferAttribute(target.vertices, 3);
        });
        
        this.faceGeometry.morphTargetsRelative = false;
        this.faceGeometry.userData.targetNames = morphTargetNames;
    }
    
    calculateMorphTarget(landmarks, blendshapeName, centerX, centerY, centerZ, scaleX, scaleY, scaleZ) {
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
        if (this.faceGeometry) this.faceGeometry.dispose();
        if (this.backGeometry) this.backGeometry.dispose();
        if (this.faceMaterial) {
            if (this.faceMaterial.map) this.faceMaterial.map.dispose();
            this.faceMaterial.dispose();
        }
        if (this.backMaterial) this.backMaterial.dispose();
    }
}