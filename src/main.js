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

        // Oświetlenie
        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);
        const front = new THREE.DirectionalLight(0xffffff, 1.0);
        front.position.set(0, 0, 5);
        this.scene.add(front);
        const top = new THREE.DirectionalLight(0xffffff, 0.8);
        top.position.set(0, 5, 0);
        this.scene.add(top);

        // Ładowanie modelu głowy
        const loader = new GLTFLoader();
        loader.load(headModelUrl, (gltf) => {
            this.headModel = gltf.scene;

            // Ustawienie materiału dla głowy (baza)
            this.headModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(0.85, 0.65, 0.55), // Bardziej naturalny kolor skóry
                        roughness: 0.5,
                        metalness: 0.0
                    });
                }
            });

            // Wyśrodkowanie modelu głowy względem jego własnego pivotu
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

        // 1. Generowanie blendshapes i tekstury
        const mapper = new ARKitBlendshapeMapper();
        this.blendshapes = mapper.mapMediaPipeToARKit(blendshapes, landmarks);

        const textureMapper = new TextureMapper();
        this.textureCanvas = textureMapper.createFaceTexture(
            this.currentImage,
            landmarks
        );

        // 2. Generowanie siatki twarzy (maski)
        const meshGenerator = new FaceMeshGenerator();
        this.faceMesh = meshGenerator.generateWithMorphTargets(
            landmarks,
            this.blendshapes,
            transformMatrix,
            this.textureCanvas
        );

        // Usunięcie starej siatki jeśli istnieje
        const oldMesh = this.scene.getObjectByName('faceMesh');
        if (oldMesh) this.scene.remove(oldMesh);

        this.faceMesh.name = 'faceMesh';
        this.scene.add(this.faceMesh);

        // =========================================================
        // 🔥 TU SĄ GŁÓWNE ZMIANY DO SKALOWANIA 🔥
        // =========================================================

        // Krok A: Zwężenie samej maski twarzy (zgodnie z życzeniem)
        this.faceMesh.scale.x = 0.92; // Lekkie zwężenie
        this.faceMesh.updateMatrixWorld(true);

        if (this.headModel) {
            this.headModel.visible = true;

            // 1. Obliczamy wymiary pudełka (Bounding Box) twarzy
            this.faceMesh.geometry.computeBoundingBox();
            const faceBox = this.faceMesh.geometry.boundingBox;
            const faceSize = new THREE.Vector3();
            faceBox.getSize(faceSize);
            const faceCenter = new THREE.Vector3();
            faceBox.getCenter(faceCenter); // Pobieramy środek twarzy

            // Zastosowanie skali obiektu do wymiarów z geometrii
            const faceWidthWorld = faceSize.x * this.faceMesh.scale.x;
            const faceHeightWorld = faceSize.y * this.faceMesh.scale.y;

            // 2. Obliczamy wymiary pudełka głowy (nieprzeskalowanej)
            // Resetujemy skalę głowy na chwilę, żeby pobrać czyste wymiary
            this.headModel.scale.set(1, 1, 1);
            this.headModel.updateMatrixWorld(true);
            
            const headBox = new THREE.Box3().setFromObject(this.headModel);
            const headSize = new THREE.Vector3();
            headBox.getSize(headSize);

            // 3. Obliczamy potrzebną skalę
            // Chcemy, żeby głowa była znacznie szersza niż sama maska twarzy (np. 2.2 razy szersza),
            // ponieważ maska to tylko przód, a głowa musi obejmować całość.
            // Poprzednio ten mnożnik był za mały (1.15), dlatego głowa była malutka.
            const widthRatio = (faceWidthWorld * 2.3) / headSize.x;
            const heightRatio = (faceHeightWorld * 1.5) / headSize.y; // Mniejszy mnożnik na wysokość

            // Wybieramy większą skalę, żeby głowa nie była za mała w żadnym wymiarze
            const targetScale = Math.max(widthRatio, heightRatio);

            console.log("Skala głowy:", targetScale); // Debug

            this.headModel.scale.set(targetScale, targetScale, targetScale);
            this.headModel.updateMatrixWorld(true);

            // 4. Pozycjonowanie
            // Ustawiamy głowę w centrum twarzy
            const scaledHeadBox = new THREE.Box3().setFromObject(this.headModel);
            const scaledHeadCenter = new THREE.Vector3();
            scaledHeadBox.getCenter(scaledHeadCenter);

            const offset = new THREE.Vector3().subVectors(faceCenter, scaledHeadCenter);
            this.headModel.position.add(offset);

            // 5. Korekta głębokości (Z) - kluczowe dla wtapiania
            // Przesuwamy głowę w tył względem twarzy, ale nie za daleko.
            // Im mniejsza wartość odejmowana, tym głowa jest "bliżej" przodu twarzy.
            const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;
            
            // Przesuwamy głowę tak, żeby jej środek był nieco za twarzą.
            // Wartość 0.15 jest eksperymentalna - reguluje jak bardzo uszy/tył głowy wystają.
            this.headModel.position.z += scaledHeadDepth * 0.15; 

            // Upewniamy się, że twarz jest zawsze przed głową w kolejności renderowania
            this.faceMesh.renderOrder = 2;
            this.headModel.renderOrder = 1;

            // Opcjonalnie: Próbujemy dopasować kolor głowy do średniego koloru twarzy
            // (Jeśli w faceMesh.userData zapisałeś kolor skóry w generatorze)
            if (this.faceMesh.userData.skinColor) {
                 const sc = this.faceMesh.userData.skinColor;
                 this.headModel.traverse((child) => {
                    if(child.isMesh) {
                        child.material.color.setRGB(sc.r, sc.g, sc.b);
                    }
                 });
            }
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
