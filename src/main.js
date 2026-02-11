import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ARKitBlendshapeMapper } from './arkit-mapper.js';
import { FaceMeshGenerator } from './face-mesh-generator.js';
import { TextureMapper } from './texture-mapper.js';
import headModelUrl from '../head.glb?url';

class FaceToBlendshape3D {
    constructor() {
        this.faceLandmarker = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.faceMesh = null;
        this.headModel = null;
        this.blendshapes = {};
        this.currentImage = null;
        this.textureCanvas = null;
        
        // Debug parameters
        this.debugParams = {
            head: {
                scaleMultiplierX: 1.15,
                scaleMultiplierY: 1.45,
                scaleMultiplierZ: 1.45,
                posOffsetX: 0,
                posOffsetY: 0,
                posOffsetZ: 0,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                pushBackFactor: 0.40
            },
            face: {
                scaleX: 1.0,
                scaleY: 1.0,
                scaleZ: 1.0,
                posOffsetX: 0,
                posOffsetY: 0,
                posOffsetZ: 0,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0
            }
        };
        
        this.faceData = null;
        
        this.init();
    }
    
    async init() {
        await this.initMediaPipe();
        this.initThreeJS();
        this.initEventListeners();
        this.initDebugControls();
        this.animate();
    }
    
    async initMediaPipe() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );
            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: 'IMAGE',
                numFaces: 1
            });
            this.showStatus('MediaPipe initialized successfully', 'success');
        } catch (error) {
            console.error('MediaPipe initialization error:', error);
            this.showStatus('Failed to initialize MediaPipe: ' + error.message, 'error');
        }
    }
    
    initThreeJS() {
        const canvas = document.getElementById('canvas3d');
        const container = canvas.parentElement;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9ff);
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.z = 2;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
        frontLight.position.set(0, 0, 5);
        this.scene.add(frontLight);
        const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
        topLight.position.set(0, 5, 0);
        this.scene.add(topLight);
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(0, 0, -5);
        this.scene.add(backLight);
        const leftLight = new THREE.PointLight(0xffffff, 0.5);
        leftLight.position.set(-5, 0, 0);
        this.scene.add(leftLight);
        const rightLight = new THREE.PointLight(0xffffff, 0.5);
        rightLight.position.set(5, 0, 0);
        this.scene.add(rightLight);
        
        const loader = new GLTFLoader();
        loader.load(headModelUrl, (gltf) => {
            this.headModel = gltf.scene;
            this.headModel.traverse((child) => {
                if (child.isMesh) {
                    const forcedMat = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(0.8, 0.6, 0.5),
                        roughness: 0.6,
                        metalness: 0.0,
                        emissive: new THREE.Color(0.3, 0.2, 0.15),
                        emissiveIntensity: 0.4,
                        side: THREE.FrontSide,
                        flatShading: false
                    });
                    child.material = forcedMat;
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });
            const box = new THREE.Box3().setFromObject(this.headModel);
            const center = box.getCenter(new THREE.Vector3());
            this.headModel.position.sub(center);
            this.scene.add(this.headModel);
            this.headModel.visible = false;
        }, undefined, (error) => {
            console.error('Error loading head model:', error);
            this.showStatus('Failed to load head model.', 'error');
        });
        
        window.addEventListener('resize', () => this.onResize());
    }
    
    initDebugControls() {
        // Head controls
        const headSliders = {
            scaleX: document.getElementById('headScaleXSlider'),
            scaleY: document.getElementById('headScaleYSlider'),
            scaleZ: document.getElementById('headScaleZSlider'),
            posX: document.getElementById('headPosXSlider'),
            posY: document.getElementById('headPosYSlider'),
            posZ: document.getElementById('headPosZSlider'),
            rotX: document.getElementById('headRotXSlider'),
            rotY: document.getElementById('headRotYSlider'),
            rotZ: document.getElementById('headRotZSlider'),
            pushBack: document.getElementById('headPushBackSlider')
        };
        
        const headValues = {
            scaleX: document.getElementById('headScaleXValue'),
            scaleY: document.getElementById('headScaleYValue'),
            scaleZ: document.getElementById('headScaleZValue'),
            posX: document.getElementById('headPosXValue'),
            posY: document.getElementById('headPosYValue'),
            posZ: document.getElementById('headPosZValue'),
            rotX: document.getElementById('headRotXValue'),
            rotY: document.getElementById('headRotYValue'),
            rotZ: document.getElementById('headRotZValue'),
            pushBack: document.getElementById('headPushBackValue')
        };
        
        // Face controls
        const faceSliders = {
            scaleX: document.getElementById('faceScaleXSlider'),
            scaleY: document.getElementById('faceScaleYSlider'),
            scaleZ: document.getElementById('faceScaleZSlider'),
            posX: document.getElementById('facePosXSlider'),
            posY: document.getElementById('facePosYSlider'),
            posZ: document.getElementById('facePosZSlider'),
            rotX: document.getElementById('faceRotXSlider'),
            rotY: document.getElementById('faceRotYSlider'),
            rotZ: document.getElementById('faceRotZSlider')
        };
        
        const faceValues = {
            scaleX: document.getElementById('faceScaleXValue'),
            scaleY: document.getElementById('faceScaleYValue'),
            scaleZ: document.getElementById('faceScaleZValue'),
            posX: document.getElementById('facePosXValue'),
            posY: document.getElementById('facePosYValue'),
            posZ: document.getElementById('facePosZValue'),
            rotX: document.getElementById('faceRotXValue'),
            rotY: document.getElementById('faceRotYValue'),
            rotZ: document.getElementById('faceRotZValue')
        };
        
        // Head slider listeners
        headSliders.scaleX.addEventListener('input', (e) => { this.debugParams.head.scaleMultiplierX = parseFloat(e.target.value); headValues.scaleX.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.scaleY.addEventListener('input', (e) => { this.debugParams.head.scaleMultiplierY = parseFloat(e.target.value); headValues.scaleY.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.scaleZ.addEventListener('input', (e) => { this.debugParams.head.scaleMultiplierZ = parseFloat(e.target.value); headValues.scaleZ.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.posX.addEventListener('input', (e) => { this.debugParams.head.posOffsetX = parseFloat(e.target.value); headValues.posX.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.posY.addEventListener('input', (e) => { this.debugParams.head.posOffsetY = parseFloat(e.target.value); headValues.posY.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.posZ.addEventListener('input', (e) => { this.debugParams.head.posOffsetZ = parseFloat(e.target.value); headValues.posZ.textContent = e.target.value; this.updateHeadTransform(); });
        headSliders.rotX.addEventListener('input', (e) => { this.debugParams.head.rotationX = parseFloat(e.target.value); headValues.rotX.textContent = e.target.value + '°'; this.updateHeadTransform(); });
        headSliders.rotY.addEventListener('input', (e) => { this.debugParams.head.rotationY = parseFloat(e.target.value); headValues.rotY.textContent = e.target.value + '°'; this.updateHeadTransform(); });
        headSliders.rotZ.addEventListener('input', (e) => { this.debugParams.head.rotationZ = parseFloat(e.target.value); headValues.rotZ.textContent = e.target.value + '°'; this.updateHeadTransform(); });
        headSliders.pushBack.addEventListener('input', (e) => { this.debugParams.head.pushBackFactor = parseFloat(e.target.value); headValues.pushBack.textContent = e.target.value; this.updateHeadTransform(); });
        
        // Face slider listeners
        faceSliders.scaleX.addEventListener('input', (e) => { this.debugParams.face.scaleX = parseFloat(e.target.value); faceValues.scaleX.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.scaleY.addEventListener('input', (e) => { this.debugParams.face.scaleY = parseFloat(e.target.value); faceValues.scaleY.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.scaleZ.addEventListener('input', (e) => { this.debugParams.face.scaleZ = parseFloat(e.target.value); faceValues.scaleZ.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.posX.addEventListener('input', (e) => { this.debugParams.face.posOffsetX = parseFloat(e.target.value); faceValues.posX.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.posY.addEventListener('input', (e) => { this.debugParams.face.posOffsetY = parseFloat(e.target.value); faceValues.posY.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.posZ.addEventListener('input', (e) => { this.debugParams.face.posOffsetZ = parseFloat(e.target.value); faceValues.posZ.textContent = e.target.value; this.updateFaceTransform(); });
        faceSliders.rotX.addEventListener('input', (e) => { this.debugParams.face.rotationX = parseFloat(e.target.value); faceValues.rotX.textContent = e.target.value + '°'; this.updateFaceTransform(); });
        faceSliders.rotY.addEventListener('input', (e) => { this.debugParams.face.rotationY = parseFloat(e.target.value); faceValues.rotY.textContent = e.target.value + '°'; this.updateFaceTransform(); });
        faceSliders.rotZ.addEventListener('input', (e) => { this.debugParams.face.rotationZ = parseFloat(e.target.value); faceValues.rotZ.textContent = e.target.value + '°'; this.updateFaceTransform(); });
        
        // Reset button
        document.getElementById('resetDebugBtn').addEventListener('click', () => {
            // Reset head
            headSliders.scaleX.value = 1.15; headSliders.scaleY.value = 1.45; headSliders.scaleZ.value = 1.45;
            headSliders.posX.value = 0; headSliders.posY.value = 0; headSliders.posZ.value = 0;
            headSliders.rotX.value = 0; headSliders.rotY.value = 0; headSliders.rotZ.value = 0;
            headSliders.pushBack.value = 0.40;
            // Reset face
            faceSliders.scaleX.value = 1.0; faceSliders.scaleY.value = 1.0; faceSliders.scaleZ.value = 1.0;
            faceSliders.posX.value = 0; faceSliders.posY.value = 0; faceSliders.posZ.value = 0;
            faceSliders.rotX.value = 0; faceSliders.rotY.value = 0; faceSliders.rotZ.value = 0;
            // Trigger updates
            Object.values(headSliders).forEach(s => s.dispatchEvent(new Event('input')));
            Object.values(faceSliders).forEach(s => s.dispatchEvent(new Event('input')));
        });
        
        // Copy button
        document.getElementById('copyValuesBtn').addEventListener('click', () => {
            const text = `HEAD:
scaleMultiplierX: ${this.debugParams.head.scaleMultiplierX}
scaleMultiplierY: ${this.debugParams.head.scaleMultiplierY}
scaleMultiplierZ: ${this.debugParams.head.scaleMultiplierZ}
posOffsetX: ${this.debugParams.head.posOffsetX}
posOffsetY: ${this.debugParams.head.posOffsetY}
posOffsetZ: ${this.debugParams.head.posOffsetZ}
rotationX: ${this.debugParams.head.rotationX}
rotationY: ${this.debugParams.head.rotationY}
rotationZ: ${this.debugParams.head.rotationZ}
pushBackFactor: ${this.debugParams.head.pushBackFactor}

FACE:
scaleX: ${this.debugParams.face.scaleX}
scaleY: ${this.debugParams.face.scaleY}
scaleZ: ${this.debugParams.face.scaleZ}
posOffsetX: ${this.debugParams.face.posOffsetX}
posOffsetY: ${this.debugParams.face.posOffsetY}
posOffsetZ: ${this.debugParams.face.posOffsetZ}
rotationX: ${this.debugParams.face.rotationX}
rotationY: ${this.debugParams.face.rotationY}
rotationZ: ${this.debugParams.face.rotationZ}`;
            navigator.clipboard.writeText(text);
            alert('Values copied to clipboard!');
        });
    }
    
    updateHeadTransform() {
        if (!this.headModel || !this.faceData) return;
        
        const { faceWidth, faceHeight, faceCenter } = this.faceData;
        
        this.headModel.scale.set(1, 1, 1);
        this.headModel.rotation.set(0, 0, 0);
        this.headModel.position.set(0, 0, 0);
        this.headModel.updateMatrixWorld(true);
        
        const resetHeadBox = new THREE.Box3().setFromObject(this.headModel);
        const headWidth = resetHeadBox.max.x - resetHeadBox.min.x;
        const headHeight = resetHeadBox.max.y - resetHeadBox.min.y;
        
        const targetHeadWidth = faceWidth * this.debugParams.head.scaleMultiplierX;
        const targetHeadHeight = faceHeight * this.debugParams.head.scaleMultiplierY;
        
        const scaleX = targetHeadWidth / headWidth;
        const scaleY = targetHeadHeight / headHeight;
        const scaleZ = Math.max(scaleX, scaleY) * (this.debugParams.head.scaleMultiplierZ / this.debugParams.head.scaleMultiplierY);
        
        this.headModel.scale.set(scaleX, scaleY, scaleZ);
        
        // Apply rotation (degrees to radians)
        this.headModel.rotation.set(
            THREE.MathUtils.degToRad(this.debugParams.head.rotationX),
            THREE.MathUtils.degToRad(this.debugParams.head.rotationY),
            THREE.MathUtils.degToRad(this.debugParams.head.rotationZ)
        );
        
        this.headModel.updateMatrixWorld(true);
        
        const scaledHeadBox = new THREE.Box3().setFromObject(this.headModel);
        const scaledHeadCenter = scaledHeadBox.getCenter(new THREE.Vector3());
        const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;
        
        const offsetX = faceCenter.x - scaledHeadCenter.x + this.debugParams.head.posOffsetX;
        const offsetY = faceCenter.y - scaledHeadCenter.y + this.debugParams.head.posOffsetY;
        let targetZ = faceCenter.z - scaledHeadCenter.z;
        const pushBack = scaledHeadDepth * this.debugParams.head.pushBackFactor;
        const offsetZ = targetZ - pushBack + this.debugParams.head.posOffsetZ;
        
        this.headModel.position.set(offsetX, offsetY, offsetZ);
        this.updateDebugDisplay();
    }
    
    updateFaceTransform() {
        if (!this.faceMesh || !this.faceData) return;
        
        const { originalPosition } = this.faceData;
        
        this.faceMesh.scale.set(
            this.debugParams.face.scaleX,
            this.debugParams.face.scaleY,
            this.debugParams.face.scaleZ
        );
        
        // Apply rotation (degrees to radians)
        this.faceMesh.rotation.set(
            THREE.MathUtils.degToRad(this.debugParams.face.rotationX),
            THREE.MathUtils.degToRad(this.debugParams.face.rotationY),
            THREE.MathUtils.degToRad(this.debugParams.face.rotationZ)
        );
        
        this.faceMesh.position.set(
            originalPosition.x + this.debugParams.face.posOffsetX,
            originalPosition.y + this.debugParams.face.posOffsetY,
            originalPosition.z + this.debugParams.face.posOffsetZ
        );
        
        // Recalculate face data after transform
        this.faceMesh.geometry.computeBoundingBox();
        const faceBox = new THREE.Box3().setFromObject(this.faceMesh);
        const faceWidth = faceBox.max.x - faceBox.min.x;
        const faceHeight = faceBox.max.y - faceBox.min.y;
        const faceCenter = faceBox.getCenter(new THREE.Vector3());
        
        this.faceData.faceWidth = faceWidth;
        this.faceData.faceHeight = faceHeight;
        this.faceData.faceCenter = faceCenter;
        
        this.updateHeadTransform();
        this.updateDebugDisplay();
    }
    
    updateDebugDisplay() {
        const debugValues = document.getElementById('debugValues');
        debugValues.textContent = `HEAD:
{
  scaleMultiplierX: ${this.debugParams.head.scaleMultiplierX},
  scaleMultiplierY: ${this.debugParams.head.scaleMultiplierY},
  scaleMultiplierZ: ${this.debugParams.head.scaleMultiplierZ},
  posOffsetX: ${this.debugParams.head.posOffsetX},
  posOffsetY: ${this.debugParams.head.posOffsetY},
  posOffsetZ: ${this.debugParams.head.posOffsetZ},
  rotationX: ${this.debugParams.head.rotationX},
  rotationY: ${this.debugParams.head.rotationY},
  rotationZ: ${this.debugParams.head.rotationZ},
  pushBackFactor: ${this.debugParams.head.pushBackFactor}
}

FACE:
{
  scaleX: ${this.debugParams.face.scaleX},
  scaleY: ${this.debugParams.face.scaleY},
  scaleZ: ${this.debugParams.face.scaleZ},
  posOffsetX: ${this.debugParams.face.posOffsetX},
  posOffsetY: ${this.debugParams.face.posOffsetY},
  posOffsetZ: ${this.debugParams.face.posOffsetZ},
  rotationX: ${this.debugParams.face.rotationX},
  rotationY: ${this.debugParams.face.rotationY},
  rotationZ: ${this.debugParams.face.rotationZ}
}`;
    }
    
    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const exportBtn = document.getElementById('exportBtn');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) this.loadImage(file);
        });
        fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) this.loadImage(file); });
        processBtn.addEventListener('click', () => this.processImage());
        exportBtn.addEventListener('click', () => this.exportGLB());
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                document.getElementById('processBtn').disabled = false;
                this.showStatus('Image loaded. Ready to process.', 'success');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    async processImage() {
        if (!this.currentImage || !this.faceLandmarker) return;
        try {
            document.getElementById('processBtn').disabled = true;
            document.getElementById('processBtnText').innerHTML = '<span class="spinner"></span> Processing...';
            this.showStatus('Detecting face landmarks...', 'loading');
            const results = this.faceLandmarker.detect(this.currentImage);
            if (!results.faceLandmarks || results.faceLandmarks.length === 0) throw new Error('No face detected in the image');
            const landmarks = results.faceLandmarks[0];
            const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
            const transformMatrix = results.facialTransformationMatrixes?.[0];
            const mapper = new ARKitBlendshapeMapper();
            this.blendshapes = mapper.mapMediaPipeToARKit(blendshapes, landmarks);
            this.showStatus('Generating face texture...', 'loading');
            const textureMapper = new TextureMapper();
            this.textureCanvas = textureMapper.createFaceTexture(this.currentImage, landmarks);
            this.showStatus('Generating 3D model with morph targets...', 'loading');
            const meshGenerator = new FaceMeshGenerator();
            this.faceMesh = meshGenerator.generateWithMorphTargets(landmarks, this.blendshapes, transformMatrix, this.textureCanvas);
            const oldMesh = this.scene.getObjectByName('faceMesh');
            if (oldMesh) this.scene.remove(oldMesh);
            this.faceMesh.name = 'faceMesh';
            this.scene.add(this.faceMesh);
            
            if (this.headModel) {
                this.headModel.visible = true;
                this.faceMesh.geometry.computeBoundingBox();
                const faceBox = this.faceMesh.geometry.boundingBox;
                const faceWidth = faceBox.max.x - faceBox.min.x;
                const faceHeight = faceBox.max.y - faceBox.min.y;
                const faceCenter = faceBox.getCenter(new THREE.Vector3());
                const originalPosition = this.faceMesh.position.clone();
                
                const headBox = new THREE.Box3().setFromObject(this.headModel);
                
                this.faceData = { faceWidth, faceHeight, faceCenter, headBox, originalPosition };
                
                const skinColor = this.faceMesh.userData.skinColor;
                if (skinColor) {
                    this.headModel.traverse((child) => {
                        if (child.isMesh) {
                            const r = Math.max(skinColor.r * 1.2, 0.5);
                            const g = Math.max(skinColor.g * 1.2, 0.4);
                            const b = Math.max(skinColor.b * 1.2, 0.3);
                            child.material.color.setRGB(r, g, b);
                            child.material.emissive.setRGB(r * 0.3, g * 0.3, b * 0.3);
                            child.material.needsUpdate = true;
                        }
                    });
                }
                
                this.updateHeadTransform();
                this.faceMesh.renderOrder = 2;
                this.headModel.renderOrder = 1;
            }
            
            this.displayBlendshapes();
            document.getElementById('exportBtn').disabled = false;
            this.showStatus('3D model with texture and morph targets generated!', 'success');
        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus('Error: ' + error.message, 'error');
        } finally {
            document.getElementById('processBtn').disabled = false;
            document.getElementById('processBtnText').textContent = 'Process Image';
        }
    }
    
    displayBlendshapes() {
        const panel = document.getElementById('blendshapesPanel');
        const list = document.getElementById('blendshapesList');
        list.innerHTML = '';
        Object.entries(this.blendshapes)
            .filter(([name, value]) => value > 0.01)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, value]) => {
                const item = document.createElement('div');
                item.className = 'blendshape-item';
                item.innerHTML = `<span class="blendshape-name">${name}</span><span class="blendshape-value">${(value * 100).toFixed(1)}%</span>`;
                list.appendChild(item);
            });
        panel.style.display = 'block';
    }
    
    async exportGLB() {
        if (!this.faceMesh) return;
        try {
            document.getElementById('exportBtn').disabled = true;
            this.showStatus('Exporting GLB with texture and morph targets...', 'loading');
            const exporter = new GLTFExporter();
            const options = { binary: true, maxTextureSize: 2048, embedImages: true, truncateDrawRange: false };
            const exportGroup = new THREE.Group();
            exportGroup.add(this.faceMesh.clone());
            if (this.headModel && this.headModel.visible) exportGroup.add(this.headModel.clone());
            exporter.parse(exportGroup, (result) => {
                if (result instanceof ArrayBuffer) {
                    this.saveArrayBuffer(result, 'face-model-blendshapes.glb');
                    this.showStatus('GLB model exported successfully!', 'success');
                }
            }, (error) => {
                console.error('Export error:', error);
                this.showStatus('Export failed: ' + error.message, 'error');
            }, options);
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus('Export failed: ' + error.message, 'error');
        } finally {
            document.getElementById('exportBtn').disabled = false;
        }
    }
    
    saveArrayBuffer(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        if (type === 'success') setTimeout(() => { status.style.display = 'none'; }, 3000);
    }
    
    onResize() {
        const container = this.renderer.domElement.parentElement;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
new FaceToBlendshape3D();