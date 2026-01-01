import { isMainThread, Worker } from "node:worker_threads"
import { WorkerThreadRpc } from "./rpc"

export class WorkerThreadLaunch {
  public pid = process.pid
  public thread: Worker = {} as any
  public threadId: number = {} as any
  public rpc: WorkerThreadRpc = {} as any
  private _readyResolve?: () => void
  private _readyPromise = new Promise<void>((resolve) => (this._readyResolve = resolve))

  public static isMainThread = isMainThread

  public constructor(public path: string, public argv: any[]) {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this)
  }

  public ready() {
    return this._readyPromise
  }

  public mtdReady() {
    this._readyResolve?.()
  }

  public init() {
    this.thread = new Worker(this.path, { argv: this.argv.length == 0 && this.argv[0] === undefined ? undefined : this.argv })
    this.threadId = this.thread.threadId
    this.thread.on(`message`, (data) => this.handleOnMessage(data))
  }

  public async handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  public kill() {
    this.thread.terminate()
  }

  public send(payload: any) {
    this.thread.postMessage(payload)
  }

  public async request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }
}
