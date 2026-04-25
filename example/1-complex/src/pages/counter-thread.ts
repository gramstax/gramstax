import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

class Perform {
  static async entryPoint(ctx: CounterThreadPage) {
    const count = await IncrementJob.mtdGetCount()
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(`1`), StartPage])
    const da = {count, timestamp: new Date().getTime()}
    await ctx.edit(kb, da)
  }
}

export class CounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  async handleArgsCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.refresh_back()}
      <message>
        🧵 Worker counter

        Count: {{count}}
        Timestamp: {{timestamp}}

        This counter is updated by a worker thread running in the background.
      </message>
      <message lang="id">
        🧵 Kounter worker

        Kounter: {{count}}
        Waktu: {{timestamp}}

        Kounter ini diperbarui oleh worker thread yang berjalan di latar belakang.
      </message>
    </base>
  `
}
