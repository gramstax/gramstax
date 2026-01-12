import {Ctx} from "gramstax"

export class StartPage extends Ctx {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0], this.data.callbackData())
    })
  }

  async internal(edit = true) {
    const kb = this.kb()
    const data = {time: new Date().toString()}
    if (edit) {
      await this.edit(kb, data)
    } else {
      await this.reply(kb, data)
    }
  }

  async textCommand() {
    await this.internal(false)
  }

  async callback() {
    await this.internal(true)
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
