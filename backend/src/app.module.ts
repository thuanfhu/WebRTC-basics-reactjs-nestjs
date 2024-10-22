import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatsModule } from './chats/chats.module';

@Module({
  imports: [ChatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
