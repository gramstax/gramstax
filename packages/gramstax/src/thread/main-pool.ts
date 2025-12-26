import type { ThreadMain } from "./main"

export class ThreadMainPool {
  public thread: Record<number, ThreadMain> = {}
  public threadCount = 0
  public constructor(instance: (Promise<ThreadMain> | ThreadMain)[]) {
    instance.forEach(async (it) => {
      const itw = await it
      this.thread[itw.id] = itw
      this.threadCount += 1
    })
  }

  public add(instance: ThreadMain) {
    this.thread[instance.id] = instance
    this.threadCount += 1
  }

  public getInstance(id: number) {
    return this.thread[id]
  }

  public killAll() {
    return Object.values(this.thread).map(({ id }) => {
      return this.kill(id)
    })
  }

  public kill(id: number) {
    const ins = this.thread[id]
    ins?.kill()
    delete this.thread[id]
    this.threadCount -= 1
    return ins?.id
  }

  public async broadcastRequest(method: string, params: any) {
    return await Promise.all(
      Object.values(this.thread).map((ins) => {
        return ins.sendRequest(method, params, true)
      })
    )
  }

  public async sendRequest(id: number, method: string, params: any, wait = true) {
    return await this.thread[id]?.sendRequest(method, params, wait)
  }
}
