import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    text: `📚 KBBottom:`, // <===== overrides trigger route function "text"
    textCommand: `keyboard_bottom` // <===== overrides trigger route function "textCommand"
  })

  bk(count?: number) {
    const params = {data: {first: this.data.text}}
    return this.bkb((k, a) => {
      return k
        .text(count === undefined ? `${a[0]!} 0` : `${a[0]} ${count + 1}`)
        .row()
        .text(a[1]!)
        .oneTime()
    }, params)
  }

  ik() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callbackData())
    })
  }

  async internal(count?: number, baseId?: string) {
    await this.reply(this.bk(count), {}, baseId)
  }

  async callback() {
    await this.internal()
  }

  async text() {
    await this.internal()
  }

  async textPayload() {
    await this.internal(parseInt(this.msgTextPayload))
  }

  async textCommand() {
    await this.internal()
  }

  async textCommandPayload() {
    const pld = this.msgTextCommandPayload
    const kb = this.ik()
    if (pld == `reset`) {
      await this.internal(kb, pld)
    }
    if (pld == `delete`) {
      await this.reply(kb, {}, pld, {reply_markup: {remove_keyboard: true}})
    }
  }

  static template = `    
    <base>
      <keyboard>${this.kbd.home(`default`)}</keyboard>
      <keyboard lang="id">${this.kbd.home(`id`)}</keyboard>
      <keyboard type="bottom">{{first}}, ${this.kbd.home(`default`)}</keyboard>
      <keyboard lang="id" type="bottom">{{first}}, ${this.kbd.home(`id`)}</keyboard>

      <message>Use keyboard bottom with emoji and dynamic payload</message>
      <message lang="id">Gunakan keyboard bottom dengan emoji dan payload dinamis</message>
    </base>
    <base id="reset">
      <message>Reset keyboard bottom success</message>
      <message lang="id">Reset keyboard bawah sukses</message>    
    </base>
    <base id="delete">
      <message>Delete keyboard bottom success</message>
      <message lang="id">Hapus keyboard bawah sukses</message>    
    </base>
  `
}
