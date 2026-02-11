import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ARKitBlendshapeMapper } from './arkit-mapper.js';
import { FaceMeshGenerator } from './face-mesh-generator.js';
import { TextureMapper } from './texture-mapper.js';
// Import head model as URL to ensure Vite bundles it
import headModelUrl from '../head.glb?url';

class FaceToBlendshape3D {
    constructor() {
        this.faceLandmarker = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.faceMesh = null;
        this.headModel = null; // Store the loaded head model
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
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9ff);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 2;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Controls
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        this.scene.add(directionalLight);
        
        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, 0, -1);
        this.scene.add(backLight);
        
        // Load Head Model using imported URL
        const loader = new GLTFLoader();
        console.log('Loading head model from:', headModelUrl);
        
        loader.load(headModelUrl, (gltf) => {
            this.headModel = gltf.scene;
            
            // Debug: Log model structure
            console.log('Head GLB loaded:', this.headModel);
            this.headModel.traverse(c => {
                if(c.isMesh) console.log('Mesh found:', c.name);
            });

            // Center the loaded model initially
            const box = new THREE.Box3().setFromObject(this.headModel);
            const center = box.getCenter(new THREE.Vector3());
            this.headModel.position.sub(center);
            
            this.scene.add(this.headModel);
            this.headModel.visible = false; // Hide until processing
            console.log('Head model added to scene (hidden)');
        }, undefined, (error) => {
            console.error('An error occurred loading the head model:', error);
            // More descriptive error
            this.showStatus('Failed to load head model. Check console.', 'error');
        });

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }
    
    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadImage(file);
            }
        });
        
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
            
            // Detect face
            const results = this.faceLandmarker.detect(this.currentImage);
            
            if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
                throw new Error('No face detected in the image');
            }
            
            const landmarks = results.faceLandmarks[0];
            const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
            const transformMatrix = results.facialTransformationMatrixes?.[0];
            
            // Map to ARKit blendshapes
            const mapper = new ARKitBlendshapeMapper();
            this.blendshapes = mapper.mapMediaPipeToARKit(blendshapes, landmarks);
            
            // Generate texture from image
            this.showStatus('Generating face texture...', 'loading');
            const textureMapper = new TextureMapper();
            this.textureCanvas = textureMapper.createFaceTexture(this.currentImage, landmarks);
            
            // Generate 3D mesh with morph targets
            this.showStatus('Generating 3D model with morph targets...', 'loading');
            const meshGenerator = new FaceMeshGenerator();
            this.faceMesh = meshGenerator.generateWithMorphTargets(
                landmarks,
                this.blendshapes,
                transformMatrix,
                this.textureCanvas
            );
            
            // Clear previous mesh
            const oldMesh = this.scene.getObjectByName('faceMesh');
            if (oldMesh) {
                this.scene.remove(oldMesh);
            }
            
            // Add new mesh
            this.faceMesh.name = 'faceMesh';
            this.scene.add(this.faceMesh);
            
            // Fit Head Model to Face Mesh
            if (this.headModel) {
                console.log('Fitting Head Model...');
                this.headModel.visible = true;
                
                // 1. Calculate Face Mesh Dimensions
                this.faceMesh.geometry.computeBoundingBox();
                const faceBox = this.faceMesh.geometry.boundingBox;
                const faceWidth = faceBox.max.x - faceBox.min.x;
                const faceHeight = faceBox.max.y - faceBox.min.y;
                const faceCenter = faceBox.getCenter(new THREE.Vector3());
                
                console.log('Face Dims:', faceWidth, faceHeight, faceCenter);

                // 2. Calculate Head Model Dimensions (Base State)
                // Reset transforms first to get true size
                this.headModel.scale.set(1, 1, 1);
                this.headModel.rotation.set(0, 0, 0);
                this.headModel.position.set(0,0,0);
                this.headModel.updateMatrixWorld(true);
                
                const headBox = new THREE.Box3().setFromObject(this.headModel);
                const headWidth = headBox.max.x - headBox.min.x;
                const headHeight = headBox.max.y - headBox.min.y;
                const headDepth = headBox.max.z - headBox.min.z;
                // Get Center of Head Model for alignment
                const headCenter = headBox.getCenter(new THREE.Vector3());

                console.log('Head Raw Dims:', headWidth, headHeight, headCenter);
                
                // 3. Calculate Scale Factors
                // Reduce multipliers for tighter fit (was 1.5/1.8)
                const safeFaceWidth = faceWidth || 2.0;
                const safeHeadWidth = headWidth || 2.0;
                const safeFaceHeight = faceHeight || 2.0;
                const safeHeadHeight = headHeight || 2.0;

                const targetHeadWidth = safeFaceWidth * 1.35; 
                const targetHeadHeight = safeFaceHeight * 1.6;
                
                const scaleX = targetHeadWidth / safeHeadWidth;
                const scaleY = targetHeadHeight / safeHeadHeight;
                const uniformScale = Math.max(scaleX, scaleY);
                
                console.log('Applying Scale:', scaleX, scaleY, uniformScale);
                
                this.headModel.scale.set(scaleX, scaleY, uniformScale);
                this.headModel.updateMatrixWorld(true);
                
                // 4. Apply Skin Color with NEW Material
                const skinColor = this.faceMesh.userData.skinColor;
                console.log('Applying Skin Color:', skinColor);
                
                if (skinColor) {
                    this.headModel.traverse((child) => {
                        if (child.isMesh) {
                            // Create NEW material to reset any GLB weirdness
                            const oldMat = child.material;
                            
                            // Ensure color is bright enough (simple tone mapping)
                            const r = Math.max(skinColor.r, 0.5);
                            const g = Math.max(skinColor.g, 0.4);
                            const b = Math.max(skinColor.b, 0.3);
                            
                            const newMat = new THREE.MeshStandardMaterial({
                                color: new THREE.Color(r, g, b),
                                roughness: 0.5,
                                metalness: 0.0,
                                side: THREE.DoubleSide
                            });
                            
                            // Copy skinning if it was a SkinnedMesh (likely not for head.glb but safe)
                            if (child.isSkinnedMesh) {
                                newMat.skinning = true;
                            }
                            
                            child.material = newMat;
                        }
                    });
                }
                
                // 5. Position Head Model
                // Re-measure after scaling
                const scaledHeadBox = new THREE.Box3().setFromObject(this.headModel);
                const scaledHeadCenter = scaledHeadBox.getCenter(new THREE.Vector3());
                const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;
                
                // Align centers X/Y
                const offsetX = faceCenter.x - scaledHeadCenter.x;
                const offsetY = faceCenter.y - scaledHeadCenter.y;
                
                // Align Z:
                // Move head center to face center
                // THEN push BACK. Since face is now DEEPER, we push back slightly MORE/LESS?
                // If face is deeper, it occupies more space backwards.
                // We want head front to meet face back.
                
                // Center alignment first:
                let targetZ = faceCenter.z - scaledHeadCenter.z;
                
                // Push back ~45% of head depth to align front of head with back of face
                const pushBack = scaledHeadDepth * 0.45; 
                
                const offsetZ = targetZ - pushBack;
                
                this.headModel.position.add(new THREE.Vector3(offsetX, offsetY, offsetZ));
                
                console.log('Final Head Position:', this.headModel.position);

                // Render order
                this.faceMesh.renderOrder = 2;
                this.headModel.renderOrder = 1;
            } else {
                console.warn('Head model not loaded yet');
            }
            
            // Display blendshapes
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
                item.innerHTML = `
                    <span class="blendshape-name">${name}</span>
                    <span class="blendshape-value">${(value * 100).toFixed(1)}%</span>
                `;
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
            
            // Export options
            const options = {
                binary: true,
                maxTextureSize: 2048,
                embedImages: true,
                truncateDrawRange: false
            };
            
            // Create a group to export both
            const exportGroup = new THREE.Group();
            exportGroup.add(this.faceMesh.clone());
            if (this.headModel && this.headModel.visible) {
                exportGroup.add(this.headModel.clone());
            }
            
            // Export to GLB
            exporter.parse(
                exportGroup,
                (result) => {
                    if (result instanceof ArrayBuffer) {
                        this.saveArrayBuffer(result, 'face-model-blendshapes.glb');
                        this.showStatus('GLB model exported successfully!', 'success');
                    }
                },
                (error) => {
                    console.error('Export error:', error);
                    this.showStatus('Export failed: ' + error.message, 'error');
                },
                options
            );
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
        
        if (type === 'success') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
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

// Initialize app
new FaceToBlendshape3D();