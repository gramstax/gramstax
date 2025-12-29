import { log, ThreadMain, ThreadSub, ThreadExport } from "gramstax"

export class IncrementCoreJob extends ThreadSub {
  public count = 0
  public constructor() {
    super()

    const ms = process.argv[3] as any
    setInterval(() => {
      this.count += 1
      log.debug(`(${this.pid}:${this.id}) [SubThread:IncrementJob] count: ${this.count}`)
    }, ms)
  }

  public getCount() {
    return this.count
  }
}

export const IncrementJob = ThreadExport.init({
  path: __filename,
  CSub: IncrementCoreJob,
  CMain: ThreadMain,
  wrap: (main) => ({
    getCount: async () => await main.sendRequest(`getCount`, [])
  })
})
