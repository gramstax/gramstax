import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Creates a new item in cache.
export class CreatePage extends PageBase {
  static BASE = {title: `form-title`, description: `form-description`, success: `success`, invalid: `invalid`}

  async callback() {
    await this.sessionTextFree({step: `title`})
    const baseId = CreatePage.BASE.title
    await this.edit(this.kb(baseId), {}, baseId)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.sessionGet()
    await this.handleCreate(this.msgText)
  }

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private getSessionParams() {
    return (this.session?.params as {step?: `title` | `description`; title?: string} | undefined) ?? {}
  }

  private replyBase(baseId: string, data: Record<string, unknown> = {}) {
    return this.reply(this.kb(baseId), data, baseId)
  }

  private async handleCreate(input?: string) {
    const {BASE} = CreatePage
    const {step, title} = this.getSessionParams()
    const currentStep = step === `description` ? `description` : `title`
    const value = input?.trim()
    if (!value) {
      await this.sessionTextFree({step: currentStep})
      return await this.replyBase(BASE.invalid)
    }
    if (currentStep === `title`) {
      await this.sessionTextFree({step: `description`, title: value})
      return await this.replyBase(BASE.description, {title: value})
    }
    if (!title) {
      await this.sessionTextFree({step: `title`})
      return await this.replyBase(BASE.invalid)
    }

    await this.sessionClear()
    const item = await this.db.createItem(this.userId, title, value)
    return await this.replyBase(BASE.success, {id: item.id, title: item.title, description: item.description, status: item.status})
  }

  static template = `
    <base id="${this.BASE.title}">
      ${this.kbk.cancel()}
      <message>
        ✏️ Create a new item

        Send a clear title for the item.
        Example: Coffee Beans
      </message>
      <message lang="id">
        ✏️ Buat item baru

        Kirim judul item yang jelas.
        Contoh: Biji Kopi
      </message>
    </base>

    <base id="${this.BASE.description}">
      ${this.kbk.cancel()}
      <message>
        ✅ Title saved: {{title}}

        Now send a short description or notes.
        Example: Medium roast, 250g
      </message>
      <message lang="id">
        ✅ Judul tersimpan: {{title}}

        Sekarang kirim deskripsi singkat atau catatan.
        Contoh: Medium roast, 250g
      </message>
    </base>

    <base id="${this.BASE.success}">
      ${this.kbk.home()}
      <message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}

        You can update or delete it anytime from the menu.
      </message>
      <message lang="id">
        ✅ Item dibuat (#{{id}})

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}

        Anda dapat memperbarui atau menghapusnya kapan saja dari menu.
      </message>
    </base>

    <base id="${this.BASE.invalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid input

        Please send a non-empty value so we can continue.
      </message>
      <message lang="id">
        ⚠️ Input tidak valid

        Mohon kirim nilai yang tidak kosong agar proses bisa dilanjutkan.
      </message>
    </base>
  `
}
