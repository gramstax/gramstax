import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static title = `t`
  static notes = `n`
  static success = `s`
}

class Helper {
  static buildHomeKeyboard(ctx: CreatePage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }

  static getSessionParams(ctx: CreatePage) {
    return (
      (ctx.temp.session?.params as {
        step?: Base
        title?: string
      }) ?? {}
    )
  }
}

// Creates a new item in cache.
export class CreatePage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gtitle.show()
  }

  async handleSessionFreeText() {
    const {step, title} = Helper.getSessionParams(this)
    const input = this.msg!.text!.trim()
    if (step === Base.title) {
      await this.gnotes.show(title!)
    } else if (step === Base.notes) {
      await this.gsuccess.show(title!, input)
    }
  }

  gtitle = {
    show: async () => {
      const bi = Base.title
      const kb = Helper.buildHomeKeyboard(this, bi)
      await this.setSessionFreeText({step: bi})
      await this.renderAuto(kb, {}, bi)
    }
  }
  gnotes = {
    show: async (title: string) => {
      const bi = Base.notes
      const kb = Helper.buildHomeKeyboard(this, bi)
      const da = {title}
      await this.setSessionFreeText({step: bi, title})
      await this.renderAuto(kb, da, bi)
    }
  }
  gsuccess = {
    show: async (title: string, input: string) => {
      await this.clearSession()
      const item = await this.db.items.create(this.from!.id, title!, input)
      const bi = Base.success
      const kb = Helper.buildHomeKeyboard(this, bi)
      const da = {
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status
      }
      await this.renderAuto(kb, da, bi)
    }
  }

  static template = `
    <g-base id="${Base.title}">
      ${this.kbk.cancel()}
      <g-message>
        ✏️ Create a new item

        Send a clear title for the item.
        Example: Coffee Beans
      </g-message>
      <g-message lang="id">
        ✏️ Buat item baru

        Kirim judul item yang jelas.
        Contoh: Biji Kopi
      </g-message>
    </g-base>

    <g-base id="${Base.notes}">
      ${this.kbk.cancel()}
      <g-message>
        ✅ Title saved: {{title}}

        Now send a short description or notes.
        Example: Medium roast, 250g
      </g-message>
      <g-message lang="id">
        ✅ Judul tersimpan: {{title}}

        Sekarang kirim deskripsi singkat atau catatan.
        Contoh: Medium roast, 250g
      </g-message>
    </g-base>
    
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}

        You can update or delete it anytime from the menu.
      </g-message>
      <g-message lang="id">
        ✅ Item dibuat (#{{id}})

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}

        Anda dapat memperbarui atau menghapusnya kapan saja dari menu.
      </g-message>
    </g-base>
  `
}
