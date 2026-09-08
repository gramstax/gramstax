import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

class Base {
  static index = `i`
  static success = `s`
}

class Helper {
  static kb(ctx: StartInputTextPage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
}

export class StartInputTextPage extends PageBase {
  static data = this.buildData({intentCommandText: `input_text`})

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleCommandText() {
    await this.gindex.show()
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params ?? {}
    if (step === Base.index) {
      await this.gindex.process()
    }
  }

  gindex = {
    show: async () => {
      const bi = Base.index
      const kb = Helper.kb(this, bi)
      await this.setSessionFreeText({step: bi})
      await this.renderAuto(kb, {}, bi)
    },
    process: async () => {
      await this.gsuccess.show()
    }
  }

  gsuccess = {
    show: async () => {
      const bi = Base.success
      const da = {res: this.msg?.text}
      const kb = Helper.kb(this, bi)
      await this.renderAuto(kb, da, bi)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        ✍️ Input text (with session)

        Send any text and it will be echoed back on the next step.
      </g-message>
      <g-message lang="id">
        ✍️ Masukkan teks (dengan session)

        Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Result

        {{res}}

        Send another text to compare results.
      </g-message>
      <g-message lang="id">
        ✅ Hasil

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </g-message>
    </g-base>
    `
}
