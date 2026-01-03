import {isMainThread, Worker} from "node:worker_threads"
import {WorkerThreadRpc} from "./rpc"

export class WorkerThreadLaunch {
  static isMainThread = isMainThread
  private _readyResolve?: () => void
  private _readyPromise = new Promise<void>((resolve) => (this._readyResolve = resolve))
  pid = process.pid
  thread: Worker = {} as any
  threadId: number = {} as any
  rpc: WorkerThreadRpc = {} as any

  constructor(public path: string, public argv: any[]) {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this)
  }

  ready() {
    return this._readyPromise
  }

  mtdReady() {
    this._readyResolve?.()
  }

  init() {
    this.thread = new Worker(this.path, {argv: this.argv.length == 0 && this.argv[0] === undefined ? undefined : this.argv})
    this.threadId = this.thread.threadId
    this.thread.on(`message`, (data) => this.handleOnMessage(data))
  }

  async handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  kill() {
    this.thread.terminate()
  }

  send(payload: any) {
    this.thread.postMessage(payload)
  }

  async request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }
}
