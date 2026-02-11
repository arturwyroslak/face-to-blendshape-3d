# 🎭 Face to Blendshape 3D

Generate production-ready 3D face models with ARKit blendshapes and texture mapping from a single photo using MediaPipe Face Landmarker. Export as GLB with embedded textures and morph targets.

## ✨ Features

🎯 **Single Photo Input** - Upload one face image and generate a complete 3D model

🤖 **MediaPipe Face Landmarker** - Advanced 478-point facial landmark detection

🎨 **Texture Mapping** - Automatic face texture extraction and UV mapping from input image

🎭 **52 ARKit Blendshapes** - Full ARKit blendshape coefficients as morph targets

📦 **GLB Export** - Industry-standard format with embedded textures and morph targets

🔧 **Three.js Rendering** - Real-time 3D visualization with orbit controls

🚀 **Zero Server** - Runs entirely in the browser, no backend required

## 🎬 What You Get

The exported GLB file contains:

- ✅ **3D Face Mesh** - 478 vertices, ~900 triangles
- ✅ **UV-Mapped Texture** - Face texture from input photo (1024x1024)
- ✅ **52 Morph Targets** - All ARKit blendshapes for facial animation
- ✅ **Embedded Data** - Everything in a single `.glb` file
- ✅ **Universal Format** - Works in Unity, Unreal, Blender, Three.js, Babylon.js

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📖 Usage

1. **Upload Image**: Click or drag & drop a face photo
2. **Process**: Click "Process Image" to detect landmarks, extract texture, and generate model
3. **View**: Interact with the 3D model using mouse/touch controls
4. **Export**: Download the complete GLB file with texture and morph targets

## 🛠️ Technology Stack

- **MediaPipe Face Landmarker** - Google's ML model for facial landmark detection
- **Three.js** - 3D rendering, geometry, and GLB export
- **GLTFExporter** - Export to glTF/GLB format with morph targets
- **Canvas API** - Texture extraction and processing
- **Vite** - Build tool and dev server
- **Vanilla JavaScript** - No framework dependencies

## 🎯 ARKit Blendshapes (Morph Targets)

All 52 ARKit blendshapes are included as morph targets:

### Eyes (14)
`eyeBlinkLeft`, `eyeBlinkRight`, `eyeLookUpLeft`, `eyeLookUpRight`, `eyeLookDownLeft`, `eyeLookDownRight`, `eyeLookInLeft`, `eyeLookInRight`, `eyeLookOutLeft`, `eyeLookOutRight`, `eyeSquintLeft`, `eyeSquintRight`, `eyeWideLeft`, `eyeWideRight`

### Eyebrows (5)
`browDownLeft`, `browDownRight`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`

### Jaw (4)
`jawForward`, `jawLeft`, `jawRight`, `jawOpen`

### Mouth (23)
`mouthClose`, `mouthFunnel`, `mouthPucker`, `mouthLeft`, `mouthRight`, `mouthSmileLeft`, `mouthSmileRight`, `mouthFrownLeft`, `mouthFrownRight`, `mouthDimpleLeft`, `mouthDimpleRight`, `mouthStretchLeft`, `mouthStretchRight`, `mouthRollLower`, `mouthRollUpper`, `mouthShrugLower`, `mouthShrugUpper`, `mouthPressLeft`, `mouthPressRight`, `mouthLowerDownLeft`, `mouthLowerDownRight`, `mouthUpperUpLeft`, `mouthUpperUpRight`

### Cheeks (3)
`cheekPuff`, `cheekSquintLeft`, `cheekSquintRight`

### Nose (2)
`noseSneerLeft`, `noseSneerRight`

### Tongue (1)
`tongueOut`

## 🏗️ Architecture

```
src/
├── main.js                # Main application controller
├── arkit-mapper.js        # MediaPipe → ARKit blendshape mapping
├── face-mesh-generator.js # 3D mesh generation with morph targets
└── texture-mapper.js      # Face texture extraction and UV mapping
```

### Key Components

**FaceToBlendshape3D** - Main application class:
- MediaPipe Face Landmarker initialization
- Three.js scene setup
- Image processing pipeline
- GLB export with GLTFExporter
- UI interactions

**TextureMapper** - Texture extraction:
- Face region detection from landmarks
- Automatic cropping and centering
- UV coordinate generation
- Texture enhancement (contrast, sharpness)
- Canvas-based processing

**FaceMeshGenerator** - 3D mesh with morph targets:
- Converts 478 landmarks to 3D vertices
- Generates face triangulation
- Creates 52 morph targets for ARKit blendshapes
- Applies UV mapping for texture
- Handles transformation matrices
- Morph target deformations

**ARKitBlendshapeMapper** - Blendshape conversion:
- Direct mapping for matching blendshapes
- Landmark-based enhancement for missing blendshapes
- Normalized coefficient calculations

## 📦 GLB Export Format

The exported GLB contains:

```javascript
// Geometry
- 478 vertices (face landmarks)
- ~900 triangles (face mesh)
- UV coordinates (texture mapping)
- Vertex normals

// Texture
- Embedded 1024x1024 face texture
- SRGB color space
- Extracted from input photo

// Morph Targets (52)
- Each blendshape as separate morph target
- Relative or absolute positioning
- Named according to ARKit convention
- Influence weights stored

// Material
- PBR Standard material
- Albedo texture map
- Roughness: 0.8
- Metalness: 0.1
```

## 🎮 Using the GLB Model

### Unity

```csharp
// Import GLB and access blend shapes
SkinnedMeshRenderer renderer = GetComponent<SkinnedMeshRenderer>();
int blendShapeIndex = renderer.sharedMesh.GetBlendShapeIndex("mouthSmileLeft");
renderer.SetBlendShapeWeight(blendShapeIndex, 75.0f);
```

### Unreal Engine

```cpp
// Import as Skeletal Mesh with Morph Targets
UMorphTarget* MorphTarget = SkeletalMesh->FindMorphTarget("mouthSmileLeft");
SkeletalMeshComponent->SetMorphTarget("mouthSmileLeft", 0.75f);
```

### Blender

```python
import bpy

# Import GLB (File > Import > glTF 2.0)
# Access shape keys
obj = bpy.context.active_object
shape_key = obj.data.shape_keys.key_blocks["mouthSmileLeft"]
shape_key.value = 0.75
```

### Three.js

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('face-model-blendshapes.glb', (gltf) => {
  const mesh = gltf.scene.children[0];
  
  // Animate morph targets
  const morphIndex = mesh.morphTargetDictionary['mouthSmileLeft'];
  mesh.morphTargetInfluences[morphIndex] = 0.75;
  
  scene.add(gltf.scene);
});
```

## 🎨 Use Cases

🎮 **Game Development** - Character facial animation and expressions

🎬 **Film/Animation** - Facial motion capture and digital doubles

📱 **AR/VR Applications** - Avatar creation and personalization

🤖 **Digital Humans** - AI assistant faces and virtual influencers

📸 **Photo Apps** - Face filters, effects, and transformations

🎓 **Education** - Anatomy, animation, and 3D modeling tutorials

## ⚡ Performance

- **Processing Time**: ~800ms per image (depends on device)
- **Model Size**: 26.8MB MediaPipe model (cached after first load)
- **GLB Size**: ~500KB - 2MB (depends on texture resolution)
- **Landmarks**: 478 3D points
- **Blendshapes**: 52 morph targets
- **Triangles**: ~900 faces
- **Texture**: 1024x1024 embedded

## 🌐 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires WebGL 2.0 and WebAssembly support.

## 📋 Requirements

**Input Image:**
- Single face, front-facing
- Good lighting conditions
- Minimum resolution: 640x480
- Maximum file size: 10MB
- Formats: JPEG, PNG, WebP

**Browser:**
- WebGL 2.0 support
- WebAssembly enabled
- Canvas API support
- Sufficient memory (~2GB recommended)

## 🔬 Advanced Features

### Texture Enhancement

Automatic post-processing:
- Contrast enhancement
- Sharpening
- Color correction
- Face region isolation

### Morph Target Calculation

Intelligent deformation:
- Landmark-based vertex displacement
- Anatomically correct movements
- Smooth interpolation
- Realistic facial expressions

### UV Mapping

Optimized texture coordinates:
- Automatic face bounds detection
- Centered projection
- Padding for edge quality
- Distortion minimization

## 🛣️ Roadmap

- [ ] Multiple face support in single image
- [ ] Video input for animation sequence export
- [ ] FBX export option
- [ ] Higher resolution textures (2K/4K)
- [ ] Normal map generation
- [ ] Depth map inclusion
- [ ] Eye/teeth texture separation
- [ ] Hair detection and mesh
- [ ] Real-time blendshape preview
- [ ] Custom morph target creation
- [ ] Batch processing
- [ ] API endpoint deployment

## 🤝 Contributing

Contributions welcome! Areas for improvement:

1. **Morph Target Accuracy** - Better vertex deformations
2. **Texture Quality** - Advanced mapping algorithms
3. **Performance** - Optimization for mobile devices
4. **Additional Formats** - FBX, OBJ, USD export
5. **Documentation** - More integration examples

Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

- **MediaPipe** - Google's ML framework
- **Three.js** - 3D rendering library and GLTF exporter
- **ARKit** - Apple's AR framework (blendshape specification)
- **glTF** - Khronos Group 3D format specification

## 💬 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/arturwyroslak/face-to-blendshape-3d/issues)
- Discussions: [Join discussion](https://github.com/arturwyroslak/face-to-blendshape-3d/discussions)

## 🎯 Example Output

Input: Single face photo (JPEG/PNG)

Output: `face-model-blendshapes.glb`
- 3D mesh with texture
- 52 morph targets (ARKit blendshapes)
- Ready to import in any 3D software
- Fully animatable facial expressions

---

**Made with ❤️ by SUPERAI**

Transform faces into animated 3D art. One photo at a time. 🎭

**GLB Export Ready • Texture Mapped • Morph Targets Included**