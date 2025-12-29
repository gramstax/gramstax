import type { ThreadMain } from "./main"

export class ThreadMainPool {
  public thread: Record<number, ThreadMain> = {}
  public threadCount = 0
  public constructor(instance: (Promise<ThreadMain> | ThreadMain)[]) {
    instance.forEach(async (it) => {
      const itw = await it
      this.thread[itw.subId] = itw
      this.threadCount += 1
    })
  }

  public add(instance: ThreadMain) {
    this.thread[instance.subId] = instance
    this.threadCount += 1
  }

  public getInstance(subId: number) {
    return this.thread[subId]
  }

  public killAll() {
    return Object.values(this.thread).map(({ subId }) => {
      return this.kill(subId)
    })
  }

  public kill(subId: number) {
    const ins = this.thread[subId]
    ins?.kill()
    delete this.thread[subId]
    this.threadCount -= 1
    return ins?.subId
  }

  public async broadcastRequest(method: string, params: any) {
    return await Promise.all(
      Object.values(this.thread).map((ins) => {
        return ins.sendRequest(method, params, true)
      })
    )
  }

  public async sendRequest(subId: number, method: string, params: any, wait = true) {
    return await this.thread[subId]?.sendRequest(method, params, wait)
  }
}
