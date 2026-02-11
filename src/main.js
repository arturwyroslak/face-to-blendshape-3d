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
        this.init();
    }
    
    async init() {
        await this.initMediaPipe();
        this.initThreeJS();
        this.initEventListeners();
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
        
        // Enable shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // AGGRESSIVE LIGHTING
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
        frontLight.position.set(0, 0, 5);
        frontLight.castShadow = false;
        this.scene.add(frontLight);
        
        const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
        topLight.position.set(0, 5, 0);
        topLight.castShadow = false;
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
            console.error('[ERROR] Loading head model:', error);
            this.showStatus('Failed to load head model.', 'error');
        });
        
        window.addEventListener('resize', () => this.onResize());
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

            // 🔥 1. ZWĘŻENIE TWARZY
            this.faceMesh.scale.x = 0.93; 
            this.faceMesh.updateMatrixWorld(true);
            
            if (this.headModel) {
                console.log('[DEBUG] Fitting head model...');
                this.headModel.visible = true;
                
                // 🔥 2. OBLICZANIE SKALI
                this.faceMesh.geometry.computeBoundingBox();
                const faceBox = this.faceMesh.geometry.boundingBox;
                const faceWidth = (faceBox.max.x - faceBox.min.x) * this.faceMesh.scale.x;
                const faceHeight = (faceBox.max.y - faceBox.min.y) * this.faceMesh.scale.y;
                const faceCenter = faceBox.getCenter(new THREE.Vector3());
                
                this.headModel.scale.set(1, 1, 1);
                this.headModel.rotation.set(0, 0, 0);
                this.headModel.position.set(0,0,0);
                this.headModel.updateMatrixWorld(true);
                
                const headBox = new THREE.Box3().setFromObject(this.headModel);
                const headWidth = headBox.max.x - headBox.min.x;
                const headHeight = headBox.max.y - headBox.min.y;
                
                const scaleX = (faceWidth * 2.15) / headWidth;
                const scaleY = (faceHeight * 1.5) / headHeight;
                const uniformScale = Math.max(scaleX, scaleY);
                
                this.headModel.scale.set(uniformScale, uniformScale, uniformScale);
                this.headModel.updateMatrixWorld(true);
                
                // 🔥 3. POZYCJONOWANIE (POPRAWKA: MNIEJSZE COFNIĘCIE)
                const scaledHeadBox = new THREE.Box3().setFromObject(this.headModel);
                const scaledHeadCenter = scaledHeadBox.getCenter(new THREE.Vector3());
                const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;
                
                // Centrujemy głowę względem twarzy w X
                const offsetX = faceCenter.x - scaledHeadCenter.x;
                
                // W osi Y: Podnosimy głowę lekko do góry
                const offsetY = (faceCenter.y - scaledHeadCenter.y) + (faceHeight * 0.12); 
                
                // W osi Z: COFNIĘCIE O 55% GŁĘBOKOŚCI
                const pushBack = scaledHeadDepth * 0.55; 
                const offsetZ = faceCenter.z - scaledHeadCenter.z - pushBack;
                
                this.headModel.position.add(new THREE.Vector3(offsetX, offsetY, offsetZ));

                // Dodatkowa korekta rotacji
                this.headModel.rotation.x = 0.05; 
                this.headModel.updateMatrixWorld(true);
                
                // Koloryzacja głowy
                const skinColor = this.faceMesh.userData.skinColor;
                if (skinColor) {
                    this.headModel.traverse((child) => {
                        if (child.isMesh) {
                            const r = Math.max(skinColor.r * 1.2, 0.5);
                            const g = Math.max(skinColor.g * 1.2, 0.4);
                            const b = Math.max(skinColor.b * 1.2, 0.3);
                            child.material.color.setRGB(r, g, b);
                            child.material.emissive.setRGB(r * 0.3, g * 0.3, b * 0.3);
                        }
                    });
                }
                
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
