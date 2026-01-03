import type {WorkerThreadLaunch} from "./launch"

export class WorkerThreadPool {
  thread = new Map<number, WorkerThreadLaunch>()
  threadCount = 0
  constructor(instance: WorkerThreadLaunch[]) {
    this.addMany(instance)
  }

  add(instance: WorkerThreadLaunch) {
    this.thread.set(instance.threadId, instance)
    this.threadCount += 1
  }

  addMany(instance: WorkerThreadLaunch[]) {
    instance.forEach((it) => this.add(it))
  }

  getInstance(threadId: number) {
    return this.thread.get(threadId)
  }

  kill(threadId: number) {
    const ins = this.thread.get(threadId)
    ins?.kill()
    this.thread.delete(threadId)
    this.threadCount -= 1
    return ins?.threadId
  }

  killAll() {
    this.thread.values().forEach(({threadId}) => this.kill(threadId))
  }

  async broadcastRequest(method: string, params: any) {
    return await Promise.all(
      Object.values(this.thread).map((ins) => {
        return ins.request(method, params, true)
      })
    )
  }

  async request(threadId: number, method: string, params: any, _wait = true, _others?: any) {
    return await this.thread.get(threadId)?.request(method, params, _wait, _others)
  }
}
