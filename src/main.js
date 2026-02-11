import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ARKitBlendshapeMapper } from './arkit-mapper.js';
import { FaceMeshGenerator } from './face-mesh-generator.js';

class FaceToBlendshape3D {
    constructor() {
        this.faceLandmarker = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.faceMesh = null;
        this.blendshapes = {};
        this.currentImage = null;
        
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
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
        exportBtn.addEventListener('click', () => this.exportModel());
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
            
            // Generate 3D mesh
            this.showStatus('Generating 3D model...', 'loading');
            const meshGenerator = new FaceMeshGenerator();
            this.faceMesh = meshGenerator.generate(landmarks, this.blendshapes, transformMatrix);
            
            // Clear previous mesh
            const oldMesh = this.scene.getObjectByName('faceMesh');
            if (oldMesh) {
                this.scene.remove(oldMesh);
            }
            
            // Add new mesh
            this.faceMesh.name = 'faceMesh';
            this.scene.add(this.faceMesh);
            
            // Display blendshapes
            this.displayBlendshapes();
            
            document.getElementById('exportBtn').disabled = false;
            this.showStatus('3D model generated successfully!', 'success');
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
        
        Object.entries(this.blendshapes).forEach(([name, value]) => {
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
    
    exportModel() {
        if (!this.faceMesh) return;
        
        try {
            const exporter = {
                parse: () => {
                    const data = {
                        metadata: {
                            generator: 'Face-to-Blendshape-3D',
                            version: '1.0.0',
                            timestamp: new Date().toISOString()
                        },
                        geometry: {
                            vertices: [],
                            faces: [],
                            uvs: []
                        },
                        blendshapes: this.blendshapes
                    };
                    
                    // Extract geometry
                    const geometry = this.faceMesh.geometry;
                    const positions = geometry.attributes.position;
                    
                    for (let i = 0; i < positions.count; i++) {
                        data.geometry.vertices.push([
                            positions.getX(i),
                            positions.getY(i),
                            positions.getZ(i)
                        ]);
                    }
                    
                    if (geometry.index) {
                        const indices = geometry.index;
                        for (let i = 0; i < indices.count; i += 3) {
                            data.geometry.faces.push([
                                indices.getX(i),
                                indices.getX(i + 1),
                                indices.getX(i + 2)
                            ]);
                        }
                    }
                    
                    return JSON.stringify(data, null, 2);
                }
            };
            
            const result = exporter.parse();
            const blob = new Blob([result], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'face-model-blendshapes.json';
            link.click();
            
            URL.revokeObjectURL(url);
            
            this.showStatus('Model exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus('Export failed: ' + error.message, 'error');
        }
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