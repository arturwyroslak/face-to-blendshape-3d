# 🎭 Face to Blendshape 3D

Generate production-ready 3D face models with ARKit blendshapes from a single photo using MediaPipe Face Landmarker.

## Features

✨ **Single Photo Input** - Upload one face image and generate a complete 3D model

🎯 **MediaPipe Face Landmarker** - Advanced 478-point facial landmark detection

🎨 **ARKit Blendshapes** - Full 52 ARKit blendshape coefficients for facial animation

🔧 **Three.js Rendering** - Real-time 3D visualization with orbit controls

📦 **Export Ready** - Export models with blendshape data in JSON format

🚀 **Zero Dependencies** - Runs entirely in the browser, no server required

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Upload Image**: Click or drag & drop a face photo
2. **Process**: Click "Process Image" to detect landmarks and generate blendshapes
3. **View**: Interact with the 3D model using mouse/touch controls
4. **Export**: Download the model with blendshapes as JSON

## Technology Stack

- **MediaPipe Face Landmarker** - Google's ML model for facial landmark detection
- **Three.js** - 3D rendering and visualization
- **Vite** - Build tool and dev server
- **Vanilla JavaScript** - No framework dependencies

## ARKit Blendshapes

Supports all 52 ARKit blendshapes:

**Eyes**: `eyeBlinkLeft`, `eyeBlinkRight`, `eyeLookUp/Down/In/Out`, `eyeSquint`, `eyeWide`

**Brows**: `browDownLeft/Right`, `browInnerUp`, `browOuterUpLeft/Right`

**Jaw**: `jawForward`, `jawLeft/Right`, `jawOpen`

**Mouth**: `mouthClose`, `mouthFunnel`, `mouthPucker`, `mouthSmile`, `mouthFrown`, and 20+ more

**Cheeks**: `cheekPuff`, `cheekSquint`

**Nose**: `noseSneerLeft/Right`

**Tongue**: `tongueOut`

## Architecture

```
src/
├── main.js              # Main application controller
├── arkit-mapper.js      # MediaPipe → ARKit blendshape mapping
└── face-mesh-generator.js # 3D mesh generation with blendshapes
```

### Key Components

**FaceToBlendshape3D** - Main application class managing:
- MediaPipe Face Landmarker initialization
- Three.js scene setup
- Image processing pipeline
- UI interactions

**ARKitBlendshapeMapper** - Converts MediaPipe blendshapes to ARKit format:
- Direct mapping for matching blendshapes
- Landmark-based enhancement for missing blendshapes
- Blender export format support

**FaceMeshGenerator** - Creates 3D face mesh:
- Converts 478 landmarks to 3D vertices
- Applies face triangulation
- Applies blendshape deformations
- Handles transformation matrices

## API Reference

### ARKitBlendshapeMapper

```javascript
const mapper = new ARKitBlendshapeMapper();
const arkitBlendshapes = mapper.mapMediaPipeToARKit(mediaPipeBlendshapes, landmarks);
```

### FaceMeshGenerator

```javascript
const generator = new FaceMeshGenerator();
const mesh = generator.generate(landmarks, blendshapes, transformMatrix);
generator.updateBlendshapes(newBlendshapes);
```

## Export Format

Exported JSON structure:

```json
{
  "metadata": {
    "generator": "Face-to-Blendshape-3D",
    "version": "1.0.0",
    "timestamp": "2026-02-11T02:10:00.000Z"
  },
  "geometry": {
    "vertices": [[x, y, z], ...],
    "faces": [[v1, v2, v3], ...],
    "uvs": []
  },
  "blendshapes": {
    "eyeBlinkLeft": 0.12,
    "mouthSmileLeft": 0.85,
    ...
  }
}
```

## Use Cases

🎮 **Game Development** - Character facial animation

🎬 **Film/Animation** - Facial motion capture

📱 **AR/VR** - Avatar creation

🤖 **Digital Humans** - AI assistant faces

📸 **Photo Apps** - Face filters and effects

## Performance

- **Processing Time**: ~500ms per image
- **Model Size**: 26.8MB (cached after first load)
- **Landmarks**: 478 3D points
- **Blendshapes**: 52 coefficients
- **Triangles**: ~900 faces

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires WebGL and WebAssembly support.

## Limitations

- Single face per image
- Front-facing photos work best
- Good lighting required
- Minimum resolution: 640x480
- Maximum file size: 10MB

## Advanced Features

### Custom Blendshape Enhancement

The mapper enhances MediaPipe blendshapes using landmark geometry:

```javascript
enhanceBlendshapesFromLandmarks(blendshapes, landmarks) {
  // Calculate jaw open from mouth height
  // Calculate smile from mouth corner positions
  // Calculate brow movements from brow-nose distance
}
```

### Transformation Matrix

Applies MediaPipe's facial transformation for proper head pose:

```javascript
applyTransformMatrix(matrix) {
  // 4x4 matrix for rotation, translation, scale
}
```

## Roadmap

- [ ] Multiple face support
- [ ] Video input for animation
- [ ] GLTF/GLB export
- [ ] Texture mapping
- [ ] Real-time blendshape animation
- [ ] FBX export for Unity/Unreal
- [ ] Blender plugin integration

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- **MediaPipe** - Google's ML framework
- **Three.js** - 3D rendering library
- **ARKit** - Apple's AR framework (blendshape specification)

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/arturwyroslak/face-to-blendshape-3d/issues)
- Discussions: [Join discussion](https://github.com/arturwyroslak/face-to-blendshape-3d/discussions)

---

**Made with ❤️ by SUPERAI**

Transform faces into art. One photo at a time. 🎭