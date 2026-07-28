import {PageBase} from "../base/page.js"

export class StartPage extends PageBase {
  async handleCommandText() {
    await this.bdefault.show(false)
  }

  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([this])
      const da = {time: new Date().toString()}
      await this.renderAuto(kb, da, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">Refresh</g-keyboard>
      <g-keyboard type="inline" lang="id">Segarkan</g-keyboard>
      <g-message>
        Hello World! 
        Time now: {{time}}
      </g-message>
      <g-message lang="id">
        Halo Dunia! 
        Waktu: {{time}}
      </g-message>
    </g-base>
  `
}
