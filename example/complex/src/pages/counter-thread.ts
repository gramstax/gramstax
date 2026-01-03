import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

export class CounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => exe)

  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData(`1`))
        .row()
        .text(arr[1]!, StartPage.data.callbackData())
    })
  }

  async callback() {
    const kb = this.kb()
    const count = await IncrementJob.getCount()
    await this.edit(kb, {count, timestamp: new Date().getTime()})
  }

  async callbackPayload() {
    await this.callback()
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.refreshBack()}
      <message>
        Counter: {{count}}
        Timestamp: {{timestamp}}

        That value count is from increment jobs thread
      </message>
      <message lang="id">
        Kounter: {{count}}
        Waktu Stamp: {{timestamp}}

        Jumlah kounter itu berasal dari penambahan pekerjaan thread
      </message>
    </base>
  `
}
