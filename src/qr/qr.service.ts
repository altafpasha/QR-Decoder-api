import { Injectable, Logger } from '@nestjs/common';
import Jimp from 'jimp';
import {
  BinaryBitmap,
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  NotFoundException,
  ChecksumException,
  FormatException,
} from '@zxing/library';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly reader = new MultiFormatReader();

  async decodeQrFromBuffer(buffer: Buffer): Promise<string | null> {
    try {
      this.logger.debug('Starting QR decode process');
      
      // Load image with Jimp
      const image = await Jimp.read(buffer);
      this.logger.debug(`Image loaded - Dimensions: ${image.getWidth()}x${image.getHeight()}`);
      
      // Analyze image properties for diagnostics
      await this.analyzeImageProperties(image);
      
      // Try multiple processing approaches
      const results = await Promise.allSettled([
        this.tryDecodeWithProcessing(image, 'original'),
        this.tryDecodeWithProcessing(image, 'grayscale'),
        this.tryDecodeWithProcessing(image, 'contrast'),
        this.tryDecodeWithProcessing(image, 'threshold'),
        this.tryDecodeWithProcessing(image, 'resize'),
        this.tryDecodeWithProcessing(image, 'aggressive-threshold'),
        this.tryDecodeWithProcessing(image, 'edge-enhance')
      ]);

      // Return the first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }

      this.logger.debug('No QR code found after trying all processing methods');
      
      // Save processed versions for debugging (optional)
      await this.saveDebugVersions(image);
      
      return null;
      
    } catch (error) {
      this.logger.error(`Unexpected error during QR decode: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async analyzeImageProperties(image: Jimp): Promise<void> {
    try {
      const width = image.getWidth();
      const height = image.getHeight();
      
      // Sample pixels to analyze contrast and brightness
      let totalBrightness = 0;
      let darkPixels = 0;
      let lightPixels = 0;
      const sampleSize = Math.min(1000, width * height);
      
      for (let i = 0; i < sampleSize; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
        const brightness = (rgba.r + rgba.g + rgba.b) / 3;
        
        totalBrightness += brightness;
        if (brightness < 128) darkPixels++;
        else lightPixels++;
      }
      
      const avgBrightness = totalBrightness / sampleSize;
      const contrast = Math.abs(darkPixels - lightPixels) / sampleSize;
      
      this.logger.debug(`Image analysis - Avg Brightness: ${avgBrightness.toFixed(2)}, Contrast Ratio: ${contrast.toFixed(2)}, Dark/Light: ${darkPixels}/${lightPixels}`);
      
      // Check if image might be inverted (white QR on black background)
      if (avgBrightness < 64) {
        this.logger.debug('Image appears very dark - might need inversion');
      } else if (avgBrightness > 192) {
        this.logger.debug('Image appears very light - might be low contrast');
      }
      
    } catch (error) {
      this.logger.debug(`Image analysis failed: ${error.message}`);
    }
  }

  private async saveDebugVersions(image: Jimp): Promise<void> {
    try {
      // Only save debug images in development/debug mode
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_QR === 'true') {
        const debugDir = '/tmp/qr-debug';
        
        // Create debug versions
        const versions = [
          { name: 'original', img: image.clone() },
          { name: 'grayscale', img: image.clone().greyscale() },
          { name: 'contrast', img: image.clone().greyscale().contrast(0.5).normalize() },
          { name: 'threshold', img: this.applyThreshold(image.clone()) }
        ];
        
        for (const version of versions) {
          const filename = `${debugDir}/debug-${version.name}-${Date.now()}.png`;
          await version.img.writeAsync(filename);
          this.logger.debug(`Debug image saved: ${filename}`);
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to save debug images: ${error.message}`);
    }
  }

  private calculateOtsuThreshold(histogram: number[]): number {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;
    
    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      
      wF = total - wB;
      if (wF === 0) break;
      
      sumB += i * histogram[i];
      
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const variance = wB * wF * (mB - mF) * (mB - mF);
      
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }
    
    return threshold;
  }

  private applyThreshold(image: Jimp): Jimp {
    return image.greyscale().scan(0, 0, image.getWidth(), image.getHeight(), (x, y, idx) => {
      const gray = image.bitmap.data[idx];
      const value = gray > 128 ? 255 : 0;
      image.bitmap.data[idx] = value;
      image.bitmap.data[idx + 1] = value;
      image.bitmap.data[idx + 2] = value;
    });
  }

  private async tryDecodeWithProcessing(
    originalImage: Jimp, 
    method: string
  ): Promise<string | null> {
    try {
      this.logger.debug(`Trying decode with method: ${method}`);
      
      // Clone the image for processing
      let processedImage = originalImage.clone();
      
      // Apply different preprocessing based on method
      switch (method) {
        case 'original':
          // No processing
          break;
          
        case 'grayscale':
          processedImage = processedImage.greyscale();
          break;
          
        case 'contrast':
          processedImage = processedImage
            .greyscale()
            .contrast(0.5)
            .normalize();
          break;
          
        case 'threshold':
          // Convert to grayscale and apply threshold
          processedImage = processedImage.greyscale();
          
          // Calculate optimal threshold using Otsu's method approximation
          const histogram = new Array(256).fill(0);
          processedImage.scan(0, 0, processedImage.getWidth(), processedImage.getHeight(), (x, y, idx) => {
            const gray = processedImage.bitmap.data[idx];
            histogram[gray]++;
          });
          
          const threshold = this.calculateOtsuThreshold(histogram);
          this.logger.debug(`Calculated Otsu threshold: ${threshold}`);
          
          // Apply calculated threshold
          processedImage.scan(0, 0, processedImage.getWidth(), processedImage.getHeight(), (x, y, idx) => {
            const gray = processedImage.bitmap.data[idx];
            const value = gray > threshold ? 255 : 0;
            processedImage.bitmap.data[idx] = value;
            processedImage.bitmap.data[idx + 1] = value;
            processedImage.bitmap.data[idx + 2] = value;
          });
          break;
          
        case 'resize':
          // Sometimes smaller images work better
          const minDim = Math.min(processedImage.getWidth(), processedImage.getHeight());
          if (minDim > 500) {
            processedImage = processedImage
              .resize(500, 500)
              .greyscale()
              .normalize();
          }
          break;
          
        case 'aggressive-threshold':
          // More aggressive black/white conversion
          processedImage = processedImage
            .greyscale()
            .contrast(0.8);
          
          processedImage.scan(0, 0, processedImage.getWidth(), processedImage.getHeight(), (x, y, idx) => {
            const gray = processedImage.bitmap.data[idx];
            const value = gray > 100 ? 255 : 0; // Lower threshold
            processedImage.bitmap.data[idx] = value;
            processedImage.bitmap.data[idx + 1] = value;
            processedImage.bitmap.data[idx + 2] = value;
          });
          break;
          
        case 'edge-enhance':
          // Edge enhancement for better detection
          processedImage = processedImage
            .greyscale()
            .convolute([
              [-1, -1, -1],
              [-1,  9, -1],
              [-1, -1, -1]
            ])
            .normalize();
          break;
      }

      // Try with both binarizers
      const results = await Promise.allSettled([
        this.decodeWithBinarizer(processedImage, 'hybrid'),
        this.decodeWithBinarizer(processedImage, 'global')
      ]);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          this.logger.debug(`Successfully decoded with method: ${method}`);
          return result.value;
        }
      }

      return null;
      
    } catch (error) {
      this.logger.debug(`Method ${method} failed: ${error.message}`);
      return null;
    }
  }

  private async decodeWithBinarizer(
    image: Jimp, 
    binarizerType: 'hybrid' | 'global'
  ): Promise<string | null> {
    try {
      const width = image.getWidth();
      const height = image.getHeight();
      
      // Create luminance array directly (more accurate for ZXing)
      const luminanceArray = new Uint8ClampedArray(width * height);
      let lumIndex = 0;
      
      // Convert to grayscale luminance values
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
          // Use proper luminance formula (ITU-R BT.709)
          const luminance = Math.round(0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b);
          luminanceArray[lumIndex++] = luminance;
        }
      }
      
      // Create custom luminance source
      const luminanceSource = {
        getRow: (y: number, row?: Uint8ClampedArray) => {
          const start = y * width;
          const end = start + width;
          if (!row || row.length < width) {
            row = new Uint8ClampedArray(width);
          }
          row.set(luminanceArray.slice(start, end));
          return row;
        },
        getMatrix: () => luminanceArray,
        getWidth: () => width,
        getHeight: () => height,
        isCropSupported: () => false,
        crop: () => { throw new Error('Crop not supported'); },
        isRotateSupported: () => false,
        rotateCounterClockwise: () => { throw new Error('Rotate not supported'); },
        rotateCounterClockwise45: () => { throw new Error('Rotate not supported'); }
      };
      
      // Use the specified binarizer
      const binarizer = binarizerType === 'hybrid' 
        ? new HybridBinarizer(luminanceSource as any)
        : new GlobalHistogramBinarizer(luminanceSource as any);
      
      const binaryBitmap = new BinaryBitmap(binarizer);
      
      // Attempt to decode
      const result = this.reader.decode(binaryBitmap);
      const decodedText = result.getText();
      
      this.logger.debug(`QR code successfully decoded with ${binarizerType} binarizer, length: ${decodedText.length} characters`);
      return decodedText;
      
    } catch (error) {
      if (error instanceof NotFoundException) {
        // This is expected when no QR code is found
        return null;
      } else if (error instanceof ChecksumException) {
        this.logger.debug('QR code found but checksum validation failed');
        return null;
      } else if (error instanceof FormatException) {
        this.logger.debug('QR code found but format is invalid');
        return null;
      } else {
        throw error;
      }
    }
  }
}