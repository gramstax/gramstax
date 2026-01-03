import {Server, type Connection} from "net-ipc"
import {WorkerThreadRpc} from "./rpc"

export class WorkerThreadGatewayServer {
  server = new Server()
  rpc = new Map<string, WorkerThreadRpc>()
  methods: any = {}

  constructor() {
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

  async start(path: string, methods: any = {}) {
    this.methods = methods
    this.server.options.path = path
    const p = new Promise((resolve) => {
      this.server.once(`ready`, () => resolve(this))
    })
    await this.server.start()
    return p
  }
}
