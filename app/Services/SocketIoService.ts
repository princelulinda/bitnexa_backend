import { Server } from 'socket.io'
import server from '@adonisjs/core/services/server'
class SocketIoService {
  public io: Server | null = null
  private booted = false
  public setIo() {
    if (this.booted) {
      return
    }
    this.booted = true
    this.io = new Server(server.getNodeServer(), {
      cors: {
        origin: '*',
      },
    })
  }
}

export default new SocketIoService()
