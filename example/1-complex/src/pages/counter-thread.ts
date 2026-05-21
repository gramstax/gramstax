import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: CounterThreadPage) {
    const count = await IncrementJob.mtdGetCount() // difference thread
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi, `1`), StartPage], `1`, bi)
    const da = {count, timestamp: new Date().getTime()}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: CounterThreadPage) {
    await Main.showStep1Form(ctx)
  }
}

export class CounterThreadPage extends PageBase {
  static data = this.buildData((step?: string, exe?: string) => [step, exe])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    const [step, exe] = this.callbackDataArgs
    if (step === Base.step1 && exe === `1`) {
      await Main.processStep1Answer(this)
    }
  }

  static template = `
    <base id="${Base.step1}">
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
