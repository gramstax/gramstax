import {Ctx} from "gramstax"

export class StartPage extends Ctx {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0], this.data.callback())
    })
  }

  async core(edit = true) {
    const kb = this.kb()
    const data = {time: new Date().toString()}
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
  }

  async textCommand() {
    await this.core(false)
  }

  async callback() {
    await this.core(true)
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
