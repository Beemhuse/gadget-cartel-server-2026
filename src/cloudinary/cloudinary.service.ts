import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary environment variables are missing');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ) {
    if (!file || !('buffer' in file)) {
      throw new Error('Missing image buffer');
    }

    const buffer = file.buffer; // now type-safe

    return new Promise<{
      url: string;
      secure_url: string;
      public_id: string;
      width?: number;
      height?: number;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              error instanceof Error
                ? error
                : new Error(error?.message || 'Cloudinary upload failed'),
            );
          }

          resolve({
            url: result.url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<{ result: string }> {
    if (!publicId) {
      throw new Error('Missing publicId');
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });

    return result as { result: string };
  }
}
