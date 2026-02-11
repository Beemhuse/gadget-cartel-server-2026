import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS
  const allowedOrigins = [
    configService.get('FRONTEND_URL'),
    'https://gadget-cartel-2026.vercel.app',
  ].filter(Boolean); // removes undefined/null

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global Config
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Config
  const config = new DocumentBuilder()
    .setTitle('Gadget Cartel API')
    .setDescription('The Gadget Cartel API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(configService.get('PORT') || 3001);
}
bootstrap();
