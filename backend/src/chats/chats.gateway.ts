import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChatsService } from './chats.service';
import {Socket, Server} from 'socket.io'

@WebSocketGateway(8081, {cors: {origin: '*'}})
export class ChatsGateway implements OnGatewayDisconnect, OnGatewayConnection{
  constructor(private readonly chatsService: ChatsService) {}

  @WebSocketServer() server : Server

  handleConnection(client: Socket) {
    client.join(client.id); 
  }

  handleDisconnect(client: Socket) {
    this.server.to(client.id).emit('end-call');
  }

  @SubscribeMessage("call-user")
  async handleCallUser(@MessageBody() data : {to : string, offer: RTCSessionDescriptionInit}, @ConnectedSocket() client : Socket){
    await this.server.to(data.to).emit('receive-call', {
      from: client.id,
      offer: data.offer
    })
  }

  @SubscribeMessage("answer-call")
  async handleAnswerCall(@MessageBody() data : {to : string, answer: RTCSessionDescriptionInit}, @ConnectedSocket() client : Socket){
    await this.server.to(data.to).emit('call-answered', {
      from: client.id,
      answer: data.answer
    })
  }

  @SubscribeMessage('send-ice-candidate')
  async handleSendIceCandidate(@MessageBody() data : {to: string, candidate : RTCIceCandidate}, @ConnectedSocket() client: Socket){
    this.server.to(data.to).emit('ice-candidate', {
      from: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('end-call')
  async handleEndCall(@MessageBody() data: { to: string }, @ConnectedSocket() client: Socket) {
    await this.server.to(data.to).emit('end-call', { from: client.id });
  } 
}
