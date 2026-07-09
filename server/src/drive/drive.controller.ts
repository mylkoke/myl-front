import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriveService } from './drive.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // scanned+compressed cards are ~100-300 KB

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  /** Lets the editor know whether the Drive destination is available. */
  @Get('drive-status')
  status() {
    return { success: true, data: { configured: this.drive.isConfigured } };
  }

  @Post('drive-card')
  @Roles('admin', 'supervisor')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadCard(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Solo se aceptan imágenes');
    }
    const url = await this.drive.uploadCardImage(file);
    return { success: true, data: { url } };
  }
}
