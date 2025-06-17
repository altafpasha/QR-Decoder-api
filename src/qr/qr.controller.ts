import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { QrService } from './qr.service';
import { ConfigService } from '@nestjs/config';

@Controller('qr')
@UseGuards(AuthGuard)
export class QrController {
  private readonly logger = new Logger(QrController.name);

  constructor(
    private readonly qrService: QrService,
    private readonly configService: ConfigService,
  ) {}

  @Post('decode')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10485760, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|bmp|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async decodeQr(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      this.logger.error('No file provided in request');
      throw new BadRequestException('File is required');
    }

    this.logger.log(
      `Processing QR decode request - File: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`,
    );

    try {
      const decodedText = await this.qrService.decodeQrFromBuffer(file.buffer);
      
      if (decodedText) {
        this.logger.log(`QR decode successful - Text: ${decodedText.substring(0, 100)}${decodedText.length > 100 ? '...' : ''}`);
        return {
          success: true,
          text: decodedText,
          metadata: {
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          },
        };
      } else {
        this.logger.warn(`QR decode failed - No QR code found in image: ${file.originalname}`);
        return {
          success: false,
          text: null,
          error: 'No QR code found in the image',
          metadata: {
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          },
        };
      }
    } catch (error) {
      this.logger.error(`QR decode error - ${error.message}`, error.stack);
      return {
        success: false,
        text: null,
        error: 'Failed to process the image',
        metadata: {
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      };
    }
  }
}