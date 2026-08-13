import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static error = `e`
  static notFound = `nf`
}

export class StatusPage extends PageBase {
  static data = this.buildData()
  constructorName?: string

  constructor(p: ConstructorParameters<typeof PageBase>[0]) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (code: string, error: unknown) => {
      const bi = Base.error
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      const da = {code, error: String(error)}
      await this.renderAuto(kb, da, bi)
    }
  }
  bnotFound = {
    show: async () => {
      const bi = Base.notFound
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.renderAuto(kb, {}, bi)
    }
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ⚠️ Store temporarily unavailable

        We could not complete that action safely.
        Code: {{code}}
        Detail: {{error}}
      </g-message>
      <g-message lang="id">
        ⚠️ Toko tidak tersedia sementara

        Kami tidak dapat menyelesaikan tindakan tersebut dengan aman.
        Kode: {{code}}
        Detail: {{error}}
      </g-message>
    </g-base>
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 Action not found

        Please return home and choose an action from the store menu.
      </g-message>
      <g-message lang="id">
        🔎 Tindakan tidak ditemukan

        Silakan kembali ke beranda dan pilih tindakan dari menu toko.
      </g-message>
    </g-base>
  `
}
