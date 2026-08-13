import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

class Base {
  static index = `i`
  static reset = `r`
  static delete = `d`
}

class Helper {
  static async built(ctx: StartKeyboardBottomPage, count?: number, AGBaseId?: string) {
    const kb = ctx.bottomKeyboard(
      (k, l) => {
        return k
          .text(count === undefined ? `${l[0]!} 0` : `${l[0]} ${count + 1}`)
          .row()
          .text(l[1]!)
          .oneTime()
      },
      {
        AGBaseId: Base.index,
        data: {
          first: ctx.data.intentText
        }
      }
    )
    await ctx.renderAuto(kb, {}, AGBaseId)
  }
}

export class StartKeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger for function "handleText" and "handleArgsText" because need emoticon + space, only support 1 space.
    intentCommandText: `keyboard_bottom` // <===== overrides trigger for function "handleCommandText" and "handleCommandArgsText*" because file name user "-" that not support command in telegram
  })

  async handleCallbackQueryData() {
    await this.bindex.show()
  }

  async handleText() {
    await this.bindex.show()
  }

  async handleArgsText() {
    await this.bindex.process(this.msgTextArg)
  }

  async handleCommandText() {
    await this.bindex.show()
  }

  async handleCommandArgsText() {
    await this.bindex.process(this.msgTextCommandArg)
  }

  bindex = {
    show: async (count?: number) => {
      await Helper.built(this, count, Base.index)
    },
    process: async (action: string) => {
      if (action === Base.reset) {
        await this.breset.show()
      } else if (action === Base.delete) {
        await this.bdelete.show()
      } else {
        await this.bindex.show(parseInt(this.msgTextArg))
      }
    }
  }
  breset = {
    show: async () => {
      await Helper.built(this, undefined, Base.reset)
    }
  }
  bdelete = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage], `1`, Base.index)
      await this.renderAuto(kb, {}, Base.delete, {
        reply_markup: {
          remove_keyboard: true
        }
      })
    }
  }

  static template = `    
    <g-base id="${Base.index}">
      <g-keyboard type="inline">${this.kbl.home.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">${this.kbl.home.id}</g-keyboard>
      <g-keyboard type="bottom">{{first}}, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard type="bottom" lang="id">{{first}}, ${this.kbl.home.id}</g-keyboard>
      <g-message>
        ⌨️ Bottom keyboard

        Use the bottom keyboard with emojis and dynamic arg for quick actions.
      </g-message>
      <g-message lang="id">
        ⌨️ Keyboard bawah

        Gunakan keyboard bawah dengan emoji dan argument dinamis untuk aksi cepat.
      </g-message>
    </g-base>    
    <g-base id="${Base.reset}">
      <g-message>
        ✅ Keyboard reset

        Bottom keyboard has been reset successfully.
      </g-message>
      <g-message lang="id">
        ✅ Keyboard direset

        Keyboard bawah berhasil direset.
      </g-message>    
    </g-base>
    <g-base id="${Base.delete}">
      <g-message>
        ✅ Keyboard removed

        Bottom keyboard has been removed successfully.
      </g-message>
      <g-message lang="id">
        ✅ Keyboard dihapus

        Keyboard bawah berhasil dihapus.
      </g-message>    
    </g-base>
  `
}
