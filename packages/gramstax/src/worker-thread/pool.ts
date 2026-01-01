import type { WorkerThreadLaunch } from "./launch"

export class WorkerThreadPool {
  public thread = new Map<number, WorkerThreadLaunch>()
  public threadCount = 0
  public constructor(instance: WorkerThreadLaunch[]) {
    this.addMany(instance)
  }

  public add(instance: WorkerThreadLaunch) {
    this.thread.set(instance.threadId, instance)
    this.threadCount += 1
  }

  public addMany(instance: WorkerThreadLaunch[]) {
    instance.forEach((it) => this.add(it))
  }

  public getInstance(threadId: number) {
    return this.thread.get(threadId)
  }

  public kill(threadId: number) {
    const ins = this.thread.get(threadId)
    ins?.kill()
    this.thread.delete(threadId)
    this.threadCount -= 1
    return ins?.threadId
  }

  public killAll() {
    this.thread.values().forEach(({ threadId }) => this.kill(threadId))
  }

  public async broadcastRequest(method: string, params: any) {
    return await Promise.all(
      Object.values(this.thread).map((ins) => {
        return ins.request(method, params, true)
      })
    )
  }

  public async request(threadId: number, method: string, params: any, _wait = true, _others?: any) {
    return await this.thread.get(threadId)?.request(method, params, _wait, _others)
  }
}
