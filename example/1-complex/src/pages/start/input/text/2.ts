import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

class Base {
  static index = `i`
  static success = `s`
}

export class StartInputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleCommandText() {
    await this.gindex.show()
  }

  async handleFreeText() {
    await this.gindex.process()
  }

  helper = {}
  gindex = {
    show: async () => {
      await this.renderText({AGBaseId: Base.index, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.index)})
    },
    process: async () => {
      await this.gsuccess.show()
    }
  }
  gsuccess = {
    show: async () => {
      await this.renderText({AGBaseId: Base.success, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.success), data: {res: this.msg?.text}})
    },
    process: () => {}
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
