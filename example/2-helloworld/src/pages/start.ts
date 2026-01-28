import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([this])
    const data = {time: new Date().toString()}
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
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
