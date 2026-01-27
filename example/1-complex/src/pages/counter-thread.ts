import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

export class CounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    const kb = this.inlineKeyboardT([this.data.callbackdata(`1`), StartPage])
    const count = await IncrementJob.mtdGetCount()
    await this.edit(kb, {count, timestamp: new Date().getTime()})
  }

  async handleArgsCallbackData() {
    await this.handleCallbackData()
  }

  static template = `
    <base>
      ${this.kbk.refreshBack()}
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
