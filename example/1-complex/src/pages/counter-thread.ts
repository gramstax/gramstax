import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

class Main {
  static async showIndexForm(ctx: CounterThreadPage) {
    const count = await IncrementJob.mtdGetCount() // difference thread
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(`1`), StartPage])
    const da = {count, timestamp: new Date().getTime()}
    await ctx.edit(kb, da)
  }

  static async processIndexForm(ctx: CounterThreadPage) {
    await Main.showIndexForm(ctx)
  }
}

export class CounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Main.showIndexForm(this)
  }

  async handleArgsCallbackData() {
    const [exe] = this.callbackDataArgs
    if (exe === `1`) {
      await Main.processIndexForm(this)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.refresh_back()}
      <g-message>
        🧵 Worker counter

        Count: {{count}}
        Timestamp: {{timestamp}}

        This counter is updated by a worker thread running in the background.
      </g-message>
      <g-message lang="id">
        🧵 Kounter worker

        Kounter: {{count}}
        Waktu: {{timestamp}}

        Kounter ini diperbarui oleh worker thread yang berjalan di latar belakang.
      </g-message>
    </g-base>
  `
}
