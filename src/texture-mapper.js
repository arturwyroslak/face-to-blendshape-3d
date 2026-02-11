/**
 * Texture Mapper
 * Creates UV-mapped face texture from input image using MediaPipe landmarks
 */

export class TextureMapper {
    constructor() {
        this.textureSize = 1024;
    }
    
    createFaceTexture(image, landmarks) {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        const ctx = canvas.getContext('2d');
        
        // Get face bounding box from landmarks
        const bounds = this.getFaceBounds(landmarks);
        
        // Calculate crop region with padding
        const padding = 0.2;
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        const cropSize = Math.max(width, height) * (1 + padding);
        const cropX = centerX - cropSize / 2;
        const cropY = centerY - cropSize / 2;
        
        // Draw cropped and centered face
        ctx.fillStyle = '#f5e6d3'; // Skin tone background
        ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        
        ctx.drawImage(
            image,
            cropX * image.width,
            cropY * image.height,
            cropSize * image.width,
            cropSize * image.height,
            0,
            0,
            this.textureSize,
            this.textureSize
        );
        
        // Apply some post-processing
        this.enhanceTexture(ctx);
        
        return canvas;
    }
    
    getFaceBounds(landmarks) {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        
        landmarks.forEach(landmark => {
            minX = Math.min(minX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxX = Math.max(maxX, landmark.x);
            maxY = Math.max(maxY, landmark.y);
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    enhanceTexture(ctx) {
        // Slight sharpening and contrast enhancement
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const data = imageData.data;
        
        // Increase contrast slightly
        const factor = 1.1;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, (data[i] - 128) * factor + 128);     // R
            data[i + 1] = Math.min(255, (data[i + 1] - 128) * factor + 128); // G
            data[i + 2] = Math.min(255, (data[i + 2] - 128) * factor + 128); // B
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    createUVMapping(landmarks) {
        // Generate UV coordinates for each landmark
        const uvs = [];
        const bounds = this.getFaceBounds(landmarks);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        
        landmarks.forEach(landmark => {
            // Normalize to [0, 1] range
            const u = (landmark.x - bounds.minX) / width;
            const v = 1 - (landmark.y - bounds.minY) / height; // Flip V
            uvs.push(u, v);
        });
        
        return uvs;
    }
}