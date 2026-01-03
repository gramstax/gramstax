import {parentPort, threadId, isMainThread} from "node:worker_threads"
import {WorkerThreadRpc} from "./rpc"
import {WorkerThreadGatewayServer} from "./gateway-server"
import {WorkerThreadGatewayClient} from "./gateway-client"

export class WorkerThreadInit {
  argv = process.argv
  id = threadId
  pid = process.pid
  rpc: WorkerThreadRpc = {} as any
  parentPort = parentPort
  gatewayServer?: WorkerThreadGatewayServer
  gatewayClients = new Map<string, WorkerThreadGatewayClient>()
  gatewayClientLatest?: WorkerThreadGatewayClient

  get gatewayClient() {
    return this.gatewayClientLatest
  }

  static isMainThread = isMainThread

  constructor() {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this)
    this.send({method: `mtdReady`})
  }

  init() {
    this.parentPort?.on(`message`, (data) => this.handleOnMessage(data))
  }

  handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  send(payload: any) {
    this.parentPort?.postMessage(payload)
  }

  request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }

  async createGatewayServer(path: string, methods: any = {}) {
    this.gatewayServer = new WorkerThreadGatewayServer()
    await this.gatewayServer.start(path, methods)
    return true
  }

  async createGatewayClient(path: string) {
    const client = new WorkerThreadGatewayClient()
    await client.connect(path)
    this.gatewayClients.set(path, client)
    this.gatewayClientLatest = client
    return client
  }
}
