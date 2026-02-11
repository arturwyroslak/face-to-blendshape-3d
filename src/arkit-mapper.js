/**
 * ARKit Blendshape Mapper
 * Maps MediaPipe Face Landmarker blendshapes to ARKit blendshape naming convention
 */

export const ARKIT_BLENDSHAPE_NAMES = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft',
    'browOuterUpRight',
    'cheekPuff',
    'cheekSquintLeft',
    'cheekSquintRight',
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeLookDownLeft',
    'eyeLookDownRight',
    'eyeLookInLeft',
    'eyeLookInRight',
    'eyeLookOutLeft',
    'eyeLookOutRight',
    'eyeLookUpLeft',
    'eyeLookUpRight',
    'eyeSquintLeft',
    'eyeSquintRight',
    'eyeWideLeft',
    'eyeWideRight',
    'jawForward',
    'jawLeft',
    'jawOpen',
    'jawRight',
    'mouthClose',
    'mouthDimpleLeft',
    'mouthDimpleRight',
    'mouthFrownLeft',
    'mouthFrownRight',
    'mouthFunnel',
    'mouthLeft',
    'mouthLowerDownLeft',
    'mouthLowerDownRight',
    'mouthPressLeft',
    'mouthPressRight',
    'mouthPucker',
    'mouthRight',
    'mouthRollLower',
    'mouthRollUpper',
    'mouthShrugLower',
    'mouthShrugUpper',
    'mouthSmileLeft',
    'mouthSmileRight',
    'mouthStretchLeft',
    'mouthStretchRight',
    'mouthUpperUpLeft',
    'mouthUpperUpRight',
    'noseSneerLeft',
    'noseSneerRight',
    'tongueOut'
];

export class ARKitBlendshapeMapper {
    constructor() {
        this.mediaPipeToARKitMap = this.createMapping();
    }
    
    createMapping() {
        return {
            // Eye movements
            'eyeBlinkLeft': 'eyeBlinkLeft',
            'eyeBlinkRight': 'eyeBlinkRight',
            'eyeLookDownLeft': 'eyeLookDownLeft',
            'eyeLookDownRight': 'eyeLookDownRight',
            'eyeLookInLeft': 'eyeLookInLeft',
            'eyeLookInRight': 'eyeLookInRight',
            'eyeLookOutLeft': 'eyeLookOutLeft',
            'eyeLookOutRight': 'eyeLookOutRight',
            'eyeLookUpLeft': 'eyeLookUpLeft',
            'eyeLookUpRight': 'eyeLookUpRight',
            'eyeSquintLeft': 'eyeSquintLeft',
            'eyeSquintRight': 'eyeSquintRight',
            'eyeWideLeft': 'eyeWideLeft',
            'eyeWideRight': 'eyeWideRight',
            
            // Eyebrows
            'browDownLeft': 'browDownLeft',
            'browDownRight': 'browDownRight',
            'browInnerUp': 'browInnerUp',
            'browOuterUpLeft': 'browOuterUpLeft',
            'browOuterUpRight': 'browOuterUpRight',
            
            // Jaw
            'jawForward': 'jawForward',
            'jawLeft': 'jawLeft',
            'jawRight': 'jawRight',
            'jawOpen': 'jawOpen',
            
            // Mouth
            'mouthClose': 'mouthClose',
            'mouthFunnel': 'mouthFunnel',
            'mouthPucker': 'mouthPucker',
            'mouthLeft': 'mouthLeft',
            'mouthRight': 'mouthRight',
            'mouthSmileLeft': 'mouthSmileLeft',
            'mouthSmileRight': 'mouthSmileRight',
            'mouthFrownLeft': 'mouthFrownLeft',
            'mouthFrownRight': 'mouthFrownRight',
            'mouthDimpleLeft': 'mouthDimpleLeft',
            'mouthDimpleRight': 'mouthDimpleRight',
            'mouthStretchLeft': 'mouthStretchLeft',
            'mouthStretchRight': 'mouthStretchRight',
            'mouthRollLower': 'mouthRollLower',
            'mouthRollUpper': 'mouthRollUpper',
            'mouthShrugLower': 'mouthShrugLower',
            'mouthShrugUpper': 'mouthShrugUpper',
            'mouthPressLeft': 'mouthPressLeft',
            'mouthPressRight': 'mouthPressRight',
            'mouthLowerDownLeft': 'mouthLowerDownLeft',
            'mouthLowerDownRight': 'mouthLowerDownRight',
            'mouthUpperUpLeft': 'mouthUpperUpLeft',
            'mouthUpperUpRight': 'mouthUpperUpRight',
            
            // Cheeks
            'cheekPuff': 'cheekPuff',
            'cheekSquintLeft': 'cheekSquintLeft',
            'cheekSquintRight': 'cheekSquintRight',
            
            // Nose
            'noseSneerLeft': 'noseSneerLeft',
            'noseSneerRight': 'noseSneerRight',
            
            // Tongue
            'tongueOut': 'tongueOut'
        };
    }
    
    mapMediaPipeToARKit(mediaPipeBlendshapes, landmarks) {
        const arkitBlendshapes = {};
        
        // Initialize all ARKit blendshapes with 0
        ARKIT_BLENDSHAPE_NAMES.forEach(name => {
            arkitBlendshapes[name] = 0;
        });
        
        // Map MediaPipe blendshapes
        mediaPipeBlendshapes.forEach(blendshape => {
            const arkitName = this.mediaPipeToARKitMap[blendshape.categoryName];
            if (arkitName) {
                arkitBlendshapes[arkitName] = blendshape.score;
            }
        });
        
        // Calculate additional blendshapes from landmarks if needed
        if (landmarks) {
            this.enhanceBlendshapesFromLandmarks(arkitBlendshapes, landmarks);
        }
        
        return arkitBlendshapes;
    }
    
    enhanceBlendshapesFromLandmarks(blendshapes, landmarks) {
        // Calculate jaw open from mouth landmarks
        const upperLip = landmarks[13]; // Upper lip center
        const lowerLip = landmarks[14]; // Lower lip center
        const mouthOpenDistance = Math.abs(upperLip.y - lowerLip.y);
        
        if (blendshapes.jawOpen === 0) {
            blendshapes.jawOpen = Math.min(mouthOpenDistance * 5, 1);
        }
        
        // Calculate smile from mouth corners
        const leftMouthCorner = landmarks[61];
        const rightMouthCorner = landmarks[291];
        const mouthCenter = landmarks[13];
        
        const leftSmileIntensity = (leftMouthCorner.y - mouthCenter.y) * -10;
        const rightSmileIntensity = (rightMouthCorner.y - mouthCenter.y) * -10;
        
        if (leftSmileIntensity > 0) {
            blendshapes.mouthSmileLeft = Math.max(blendshapes.mouthSmileLeft, Math.min(leftSmileIntensity, 1));
        }
        if (rightSmileIntensity > 0) {
            blendshapes.mouthSmileRight = Math.max(blendshapes.mouthSmileRight, Math.min(rightSmileIntensity, 1));
        }
        
        // Calculate brow movements
        const leftBrowInner = landmarks[107];
        const rightBrowInner = landmarks[336];
        const noseBridge = landmarks[6];
        
        const leftBrowHeight = (noseBridge.y - leftBrowInner.y) * 8;
        const rightBrowHeight = (noseBridge.y - rightBrowInner.y) * 8;
        
        if (leftBrowHeight < 0) {
            blendshapes.browDownLeft = Math.min(Math.abs(leftBrowHeight), 1);
        }
        if (rightBrowHeight < 0) {
            blendshapes.browDownRight = Math.min(Math.abs(rightBrowHeight), 1);
        }
        
        return blendshapes;
    }
    
    exportBlendshapesForBlender(blendshapes) {
        const blenderFormat = {
            version: '1.0',
            blendshapes: []
        };
        
        Object.entries(blendshapes).forEach(([name, value]) => {
            blenderFormat.blendshapes.push({
                name: name,
                value: value,
                mute: false,
                vertex_group: name
            });
        });
        
        return blenderFormat;
    }
}