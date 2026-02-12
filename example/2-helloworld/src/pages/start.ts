import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([this])
    const da = {time: new Date().toString()}
    if (edit) await this.edit(kb, da)
    else await this.reply(kb, da)
  }

  async handleCommandText() {
    await this.show(false)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>Refresh</keyboard>
      <message>
        Hello World! 
        Time now: {{time}}
      </message>
    </base>
  `
}
