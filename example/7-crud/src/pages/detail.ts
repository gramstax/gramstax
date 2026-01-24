import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {TimeUt} from "~/utils/time"

// Shows a single item by ID.
export class DetailPage extends PageBase {
  static BASE = {form: `form`, detail: `detail`, notFound: `not-found`, invalid: `invalid`}

  async callback() {
    await this.sessionTextFree()
    const bi = DetailPage.BASE.form
    await this.edit(this.kb(bi), {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.handleDetail(this.msgText)
  }

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private replyBase(baseId: string, data: Record<string, unknown> = {}) {
    return this.reply(this.kb(baseId), data, baseId)
  }

  private async handleInvalid() {
    await this.replyBase(DetailPage.BASE.invalid)
    await this.sessionClear()
  }

  private async handleNotFound(id: string) {
    await this.replyBase(DetailPage.BASE.notFound, {id})
    await this.sessionClear()
  }

  private async handleDetail(input?: string) {
    const id = input?.trim()
    if (!id) {
      return await this.handleInvalid()
    }

    const item = await this.db.getItem(this.userId, id)
    if (!item) {
      return await this.handleNotFound(id)
    }

    const createdAt = TimeUt.formatTimestamp(item.createdAt)
    const updatedAt = TimeUt.formatTimestamp(item.updatedAt)
    await this.replyBase(DetailPage.BASE.detail, {id: item.id, title: item.title, description: item.description, status: item.status, createdAt, updatedAt})
    await this.sessionClear()
  }

  static template = `
    <base id="${this.BASE.form}">
      ${this.kbk.cancel()}
      <message>
        🔎 View item details

        Enter the item ID to see the full record.
        Example: 1
      </message>
      <message lang="id">
        🔎 Lihat detail item

        Masukkan ID item untuk melihat data lengkap.
        Contoh: 1
      </message>
    </base>

    <base id="${this.BASE.detail}">
      ${this.kbk.home()}
      <message>
        📋 Item #{{id}}

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
        🕒 Created: {{createdAt}}
        🔄 Updated: {{updatedAt}}
      </message>
      <message lang="id">
        📋 Item #{{id}}

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}
        🕒 Dibuat: {{createdAt}}
        🔄 Diperbarui: {{updatedAt}}
      </message>
    </base>

    <base id="${this.BASE.notFound}">
      ${this.kbk.cancel()}
      <message>
        ❌ Item not found: {{id}}

        Double-check the ID and try again, or return to the list to browse.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Periksa kembali ID, atau kembali ke daftar untuk melihat item.
      </message>
    </base>

    <base id="${this.BASE.invalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid ID

        Please send a numeric item ID (example: 1).
      </message>
      <message lang="id">
        ⚠️ ID tidak valid

        Mohon kirim ID item angka (contoh: 1).
      </message>
    </base>
  `
}
