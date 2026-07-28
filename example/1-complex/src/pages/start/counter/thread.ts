import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"
import {IncrementJob} from "~/jobs/increment"

export class StartCounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  async handleArgsCallbackQueryData() {
    const [exe] = this.callbackQueryDataArgs
    if (exe === `1`) {
      await this.bdefault.process()
    }
  }

  bdefault = {
    show: async () => {
      const count = await IncrementJob.mtdGetCount() // difference thread
      const kb = this.inlineKeyboardT([this.data.callbackQueryData(`1`), StartPage])
      const da = {count, timestamp: new Date().getTime()}
      await this.renderEdit(kb, da)
    },
    process: async () => {
      await this.bdefault.show()
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
