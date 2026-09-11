import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([this])
      const da = {time: new Date().toString()}
      await this.renderAuto(kb, da)
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
