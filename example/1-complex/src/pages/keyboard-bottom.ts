import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger route function "text" because need emoticon + space, only support 1 space.
    intentTextCommand: `keyboard_bottom` // <===== overrides trigger route function "textCommand" because file name user "-" that not support command in telegram
  })

  bk(count?: number) {
    const params = {data: {first: this.data.intentText}}
    return this.bkb((k, a) => {
      return k
        .text(count === undefined ? `${a[0]!} 0` : `${a[0]} ${count + 1}`)
        .row()
        .text(a[1]!)
        .oneTime()
    }, params)
  }

  ik() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async core(count?: number, baseId?: string) {
    const kb = this.bk(count)
    await this.reply(kb, {}, baseId)
  }

  async callback() {
    await this.core()
  }

  async text() {
    await this.core()
  }

  async textPayload() {
    await this.core(parseInt(this.msgTextPayload))
  }

  async textCommand() {
    await this.core()
  }

  async textCommandPayload() {
    const pld = this.msgTextCommandPayload
    const kb = this.ik()
    if (pld == `reset`) {
      await this.core(kb, pld)
    }
    if (pld == `delete`) {
      await this.reply(kb, {}, pld, {reply_markup: {remove_keyboard: true}})
    }
  }

  static template = `    
    <base>
      <keyboard>${this.kbl.home(`default`)}</keyboard>
      <keyboard lang="id">${this.kbl.home(`id`)}</keyboard>
      <keyboard type="bottom">{{first}}, ${this.kbl.home(`default`)}</keyboard>
      <keyboard lang="id" type="bottom">{{first}}, ${this.kbl.home(`id`)}</keyboard>

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
