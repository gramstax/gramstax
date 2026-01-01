import { parentPort, threadId, isMainThread } from "node:worker_threads"
import { WorkerThreadRpc } from "./rpc"
import { WorkerThreadGatewayServer } from "./gateway-server"
import { WorkerThreadGatewayClient } from "./gateway-client"

export class WorkerThreadInit {
  public argv = process.argv
  public id = threadId
  public pid = process.pid
  public rpc: WorkerThreadRpc = {} as any
  public parentPort = parentPort
  public gatewayServer?: WorkerThreadGatewayServer
  public gatewayClients = new Map<string, WorkerThreadGatewayClient>()
  public gatewayClientLatest?: WorkerThreadGatewayClient

  public get gatewayClient() {
    return this.gatewayClientLatest
  }

  public static isMainThread = isMainThread

  public constructor() {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this)
    this.send({ method: `mtdReady` })
  }

  public init() {
    this.parentPort?.on(`message`, (data) => this.handleOnMessage(data))
  }

  public handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  public send(payload: any) {
    this.parentPort?.postMessage(payload)
  }

  public request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }

  public async createGatewayServer(path: string, methods: any = {}) {
    this.gatewayServer = new WorkerThreadGatewayServer()
    await this.gatewayServer.start(path, methods)
    return true
  }

  public async createGatewayClient(path: string) {
    const client = new WorkerThreadGatewayClient()
    await client.connect(path)
    this.gatewayClients.set(path, client)
    this.gatewayClientLatest = client
    return client
  }
}
