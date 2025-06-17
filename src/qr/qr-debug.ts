// qr-debug.ts - Run this script to debug your QR image
import Jimp from 'jimp';
import { promises as fs } from 'fs';

async function debugQRImage(imagePath: string) {
  try {
    console.log(`Analyzing image: ${imagePath}`);
    
    const image = await Jimp.read(imagePath);
    const width = image.getWidth();
    const height = image.getHeight();
    
    console.log(`Dimensions: ${width}x${height}`);
    
    // Analyze image properties
    let totalBrightness = 0;
    let darkPixels = 0;
    let lightPixels = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    
    // Sample the center area where QR code is likely to be
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.min(width, height) / 4;
    
    for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y += 10) {
      for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x += 10) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
          const brightness = (rgba.r + rgba.g + rgba.b) / 3;
          
          totalBrightness += brightness;
          minBrightness = Math.min(minBrightness, brightness);
          maxBrightness = Math.max(maxBrightness, brightness);
          
          if (brightness < 128) darkPixels++;
          else lightPixels++;
        }
      }
    }
    
    const sampleCount = darkPixels + lightPixels;
    const avgBrightness = totalBrightness / sampleCount;
    const contrast = (maxBrightness - minBrightness) / 255;
    
    console.log(`\nImage Statistics:`);
    console.log(`- Average brightness: ${avgBrightness.toFixed(2)}`);
    console.log(`- Min brightness: ${minBrightness}`);
    console.log(`- Max brightness: ${maxBrightness}`);
    console.log(`- Contrast ratio: ${contrast.toFixed(2)}`);
    console.log(`- Dark pixels: ${darkPixels}`);
    console.log(`- Light pixels: ${lightPixels}`);
    console.log(`- Dark/Light ratio: ${(darkPixels / lightPixels).toFixed(2)}`);
    
    // Recommendations
    console.log(`\nRecommendations:`);
    if (contrast < 0.3) {
      console.log(`⚠️  Low contrast detected (${contrast.toFixed(2)}). Try increasing contrast.`);
    }
    if (avgBrightness < 50) {
      console.log(`⚠️  Very dark image. QR code might be white on black background.`);
    }
    if (avgBrightness > 200) {
      console.log(`⚠️  Very bright image. QR code might be very light.`);
    }
    if (darkPixels / lightPixels > 3) {
      console.log(`⚠️  Mostly dark image. Consider inverting colors.`);
    }
    if (lightPixels / darkPixels > 3) {
      console.log(`⚠️  Mostly light image. QR code might be very faint.`);
    }
    
    // Create enhanced versions
    console.log(`\nCreating enhanced versions...`);
    
    // Version 1: High contrast
    const highContrast = image.clone()
      .greyscale()
      .contrast(0.8)
      .normalize();
    await highContrast.writeAsync('debug-high-contrast.png');
    console.log(`✅ Saved: debug-high-contrast.png`);
    
    // Version 2: Binary threshold
    const binary = image.clone().greyscale();
    binary.scan(0, 0, width, height, (x, y, idx) => {
      const gray = binary.bitmap.data[idx];
      const value = gray > avgBrightness ? 255 : 0; // Use average as threshold
      binary.bitmap.data[idx] = value;
      binary.bitmap.data[idx + 1] = value;
      binary.bitmap.data[idx + 2] = value;
    });
    await binary.writeAsync('debug-binary.png');
    console.log(`✅ Saved: debug-binary.png`);
    
    // Version 3: Inverted
    const inverted = image.clone().invert();
    await inverted.writeAsync('debug-inverted.png');
    console.log(`✅ Saved: debug-inverted.png`);
    
    // Version 4: Edge enhanced
    const edges = image.clone()
      .greyscale()
      .convolute([
        [-1, -1, -1],
        [-1,  9, -1],
        [-1, -1, -1]
      ])
      .normalize();
    await edges.writeAsync('debug-edges.png');
    console.log(`✅ Saved: debug-edges.png`);
    
    console.log(`\n📸 Try testing these enhanced versions with your QR decoder.`);
    console.log(`💡 If none work, the image might not contain a valid QR code or might be corrupted.`);
    
  } catch (error) {
    console.error(`Error analyzing image: ${error.message}`);
  }
}

// Usage: node qr-debug.js /path/to/your/test2.png
const imagePath = process.argv[2] || '/home/codesec/Documents/codesec/QR/test2.png';
debugQRImage(imagePath);