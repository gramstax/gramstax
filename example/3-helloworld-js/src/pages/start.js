import {PageBase} from "../base/page.js"

export class StartPage extends PageBase {
  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({keyboard: this.inlineKeyboardT([this]), data: {time: new Date().toString()}})
    },
    process: () => {}
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
