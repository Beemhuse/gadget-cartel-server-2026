import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60, // seconds
          limit: 100, // global limit
        },
      ],
    }),
  ],
})
export class AppModule {}
