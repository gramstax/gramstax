import { logUt } from "~/utils/log"
import { SubThread } from "~/thread/sub"
import { MainThread } from "~/thread/main"
import { ExportThread } from "~/thread/export"

export class IncrementCoreJob extends SubThread {
  public count = 0
  public constructor() {
    super()

    const ms = process.argv[3] as any
    setInterval(() => {
      this.count += 1
      logUt.debug(`(${this.id}) [SubThread:IncrementJob] count: ${this.count}`)
    }, ms)
  }

  public getCount() {
    return this.count
  }
}

export const IncrementJob = ExportThread.init({
  path: __filename,
  CSub: IncrementCoreJob,
  CMain: MainThread,
  wrap: (main) => ({
    getCount: async () => await main.sendRequest(`getCount`, [])
  })
})
