import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../config/env';

/**
 * Uploads card images to the user's Google Drive (15 GB free vs 1 GB in
 * Cloudinary) through a Google Apps Script Web App — no Google Cloud
 * Console / OAuth needed. The script (see server/scripts/gdrive-apps-script.gs)
 * runs as the user, saves the image in their Drive folder, makes it public
 * and returns the file id. Auth is a shared secret token.
 *
 * Caveat: Drive is not an image CDN. Public files are hotlinked through
 * `https://lh3.googleusercontent.com/d/<fileId>`, which works fine for a
 * personal project but Google may throttle it under heavy traffic.
 */
@Injectable()
export class DriveService {
  get isConfigured(): boolean {
    return env.gdrive !== null;
  }

  async uploadCardImage(file: Express.Multer.File): Promise<string> {
    if (!env.gdrive) {
      throw new ServiceUnavailableException(
        'Google Drive no está configurado (faltan GAS_UPLOAD_URL / GAS_UPLOAD_TOKEN en server/.env)',
      );
    }

    const res = await fetch(env.gdrive.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: env.gdrive.token,
        filename: `card-${Date.now()}-${file.originalname || 'imagen.jpg'}`,
        mimeType: file.mimetype,
        data: file.buffer.toString('base64'),
      }),
    });

    // Apps Script always responds 200; errors come in the JSON body.
    const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!res.ok || !json?.id) {
      throw new ServiceUnavailableException(
        `Google Drive rechazó la subida: ${json?.error ?? `HTTP ${res.status}`}`,
      );
    }

    return `https://lh3.googleusercontent.com/d/${json.id}`;
  }
}
