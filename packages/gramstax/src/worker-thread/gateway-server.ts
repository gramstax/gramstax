import { Server, type Connection } from "net-ipc"
import { WorkerThreadRpc } from "./rpc"

export class WorkerThreadGatewayServer {
  public server = new Server()
  public rpc = new Map<string, WorkerThreadRpc>()
  public methods: any = {}

  public constructor() {
    this.server.on(`connect`, (connection: Connection) => {
      const rpc = new WorkerThreadRpc((data) => {
        return connection.send(data)
      }, this.methods)

      this.rpc.set(connection.id, rpc)
    })

    this.server.on(`disconnect`, (connection: Connection) => {
      this.rpc.delete(connection.id)
    })

    this.server.on(`message`, (message: any, connection: Connection) => {
      const rpc = this.rpc.get(connection.id)
      if (rpc) {
        rpc.make(message)
      }
    })

    this.server.on(`error`, (err: any) => {
      console.error(err)
    })
  }

  public async start(path: string, methods: any = {}) {
    this.methods = methods
    this.server.options.path = path
    const p = new Promise((resolve) => {
      this.server.once(`ready`, () => resolve(this))
    })
    await this.server.start()
    return p
  }
}
