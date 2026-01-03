import {Client} from "net-ipc"
import {WorkerThreadRpc} from "./rpc"

export class WorkerThreadGatewayClient {
  client = new Client()
  rpc: WorkerThreadRpc

  constructor() {
    this.rpc = new WorkerThreadRpc((data) => {
      return this.client.send(data)
    }, {})

    this.client.on(`message`, (data: any) => {
      this.rpc.make(data)
    })
  }

  async connect(path: string) {
    this.client.options.path = path
    const p = new Promise((resolve) => {
      this.client.once(`ready`, () => resolve(this))
    })
    await this.client.connect()
    return p
  }

  async request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }
}
