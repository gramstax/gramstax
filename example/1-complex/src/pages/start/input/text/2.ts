import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

class Base {
  static index = `i`
  static success = `s`
}

export class StartInputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})

  async handleCallbackQueryData() {
    await this.bindex.show()
  }

  async handleCommandText() {
    await this.bindex.show()
  }

  async handleFreeText() {
    await this.bindex.process()
  }

  bindex = {
    show: async () => {
      const bi = Base.index
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.renderAuto(kb, {}, bi)
    },
    process: async () => {
      await this.bsuccess.show()
    }
  }

  bsuccess = {
    show: async () => {
      const bi = Base.success
      const da = {res: this.msg?.text}
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.renderAuto(kb, da, bi)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        📝 Input text (no session)

        Send a message to see an immediate echo response.
      </g-message>
      <g-message lang="id">
        📝 Masukkan teks (tanpa session)

        Kirim pesan untuk melihat balasan secara langsung.
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Result (no session)

        {{res}}

        Send another text to see a different result.
      </g-message>
      <g-message lang="id">
        ✅ Hasil (tanpa session)

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </g-message>
    </g-base>
  `
}
