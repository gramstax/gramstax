import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class ZOnePage extends PageBase {
  static data = this.buildData({
    textCommand: `z_one`,
    callbackData: (confirm: string) => confirm
  })

  kb() {
    return this.ikb((k, a) => {
      return k //
        .text(a[0]!, this.data.callbackData(`1`))
        .text(a[1]!, StartPage.data.callbackData(`asumsi-wallet`))
    })
  }

  async textCommand() {
    await this.sessionToCallbackPayload({from: `to`})
    await this.reply(this.kb())
  }

  async callbackPayload() {
    const pld = this.callbackDataPayload
    console.log(`callbackPayload: ${pld}`)
  }

  static template = /*html*/ `
    <base>
      <keyboard>Yes, Repeat</keyboard>
      <message>Z One Message</message>
    </base>
  `
}
