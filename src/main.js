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
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                delegate: 'GPU'
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: 'IMAGE',
            numFaces: 1
        });
    }

    initThreeJS() {
        const canvas = document.getElementById('canvas3d');
        const container = canvas.parentElement;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9ff);

        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 2;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            preserveDrawingBuffer: true
        });

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;

        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);

        const front = new THREE.DirectionalLight(0xffffff, 1.0);
        front.position.set(0, 0, 5);
        this.scene.add(front);

        const top = new THREE.DirectionalLight(0xffffff, 0.8);
        top.position.set(0, 5, 0);
        this.scene.add(top);

        const loader = new GLTFLoader();

        loader.load(headModelUrl, (gltf) => {
            this.headModel = gltf.scene;

            this.headModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(0.8, 0.6, 0.5),
                        roughness: 0.6,
                        metalness: 0.0
                    });
                }
            });

            const box = new THREE.Box3().setFromObject(this.headModel);
            const center = box.getCenter(new THREE.Vector3());
            this.headModel.position.sub(center);

            this.scene.add(this.headModel);
            this.headModel.visible = false;
        });

        window.addEventListener('resize', () => this.onResize());
    }

    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const exportBtn = document.getElementById('exportBtn');

        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadImage(file);
        });

        processBtn.addEventListener('click', () => this.processImage());
        exportBtn.addEventListener('click', () => this.exportGLB());
    }

    loadImage(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                document.getElementById('processBtn').disabled = false;
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    async processImage() {
        if (!this.currentImage) return;

        const results = this.faceLandmarker.detect(this.currentImage);

        if (!results.faceLandmarks?.length) return;

        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
        const transformMatrix = results.facialTransformationMatrixes?.[0];

        const mapper = new ARKitBlendshapeMapper();
        this.blendshapes = mapper.mapMediaPipeToARKit(blendshapes, landmarks);

        const textureMapper = new TextureMapper();
        this.textureCanvas = textureMapper.createFaceTexture(
            this.currentImage,
            landmarks
        );

        const meshGenerator = new FaceMeshGenerator();
        this.faceMesh = meshGenerator.generateWithMorphTargets(
            landmarks,
            this.blendshapes,
            transformMatrix,
            this.textureCanvas
        );

        this.faceMesh.name = 'faceMesh';
        this.scene.add(this.faceMesh);

        // 🔥 1️⃣ LEKKIE ZWĘŻENIE TWARZY
        const FACE_NARROW_SCALE = 0.93;
        this.faceMesh.scale.x *= FACE_NARROW_SCALE;
        this.faceMesh.updateMatrixWorld(true);

        // 🔥 2️⃣ DYNAMICZNE DOPASOWANIE GŁOWY DO REALNEJ SZEROKOŚCI TWARZY
        if (this.headModel) {
            this.headModel.visible = true;

            // landmarki policzków
            const left = landmarks[234];
            const right = landmarks[454];

            // szerokość twarzy w przestrzeni modelu
            const faceWidth = Math.abs(left.x - right.x) * this.faceMesh.scale.x;

            // szerokość głowy
            const headBox = new THREE.Box3().setFromObject(this.headModel);
            const headWidth = headBox.max.x - headBox.min.x;

            // skalowanie jednolite
            const scale = (faceWidth * 1.15) / headWidth;

            this.headModel.scale.set(scale, scale, scale);
            this.headModel.updateMatrixWorld(true);

            // 🔥 3️⃣ WYŚRODKOWANIE GŁOWY DO TWARZY
            this.faceMesh.geometry.computeBoundingBox();
            const faceBox = this.faceMesh.geometry.boundingBox;
            const faceCenter = faceBox.getCenter(new THREE.Vector3());

            const newHeadBox = new THREE.Box3().setFromObject(this.headModel);
            const headCenter = newHeadBox.getCenter(new THREE.Vector3());
            const headDepth =
                newHeadBox.max.z - newHeadBox.min.z;

            const offset = new THREE.Vector3().subVectors(
                faceCenter,
                headCenter
            );

            // lekkie cofnięcie dla wtapiania
            offset.z -= headDepth * 0.28;

            this.headModel.position.add(offset);

            // minimalne wysunięcie twarzy (brak z-fighting)
            this.faceMesh.position.z += 0.01;

            this.faceMesh.renderOrder = 2;
            this.headModel.renderOrder = 1;
        }

        document.getElementById('exportBtn').disabled = false;
    }

    async exportGLB() {
        if (!this.faceMesh) return;

        const exporter = new GLTFExporter();
        const group = new THREE.Group();

        group.add(this.faceMesh.clone());
        if (this.headModel?.visible)
            group.add(this.headModel.clone());

        exporter.parse(
            group,
            (result) => {
                const blob = new Blob([result], {
                    type: 'application/octet-stream'
                });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'face-model.glb';
                link.click();
            },
            { binary: true }
        );
    }

    onResize() {
        const container = this.renderer.domElement.parentElement;
        this.camera.aspect =
            container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(
            container.clientWidth,
            container.clientHeight
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new FaceToBlendshape3D();
