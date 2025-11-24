import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class GeneralErrorPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData())
    })
  }

  public async transition(constructorName: string, funcName: string, error: any, isUpdate = true) {
    this.logError(error, constructorName, funcName)
    await this.sessionClear()

    const kb = this.kb()
    if (isUpdate === true) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard lang="en" type="inline">.. Home</keyboard>
      <keyboard lang="es" type="inline">.. Inicio</keyboard>
      <keyboard lang="id" type="inline">.. Beranda</keyboard>

      <message lang="en">
        <b>❌ Error</b>

        An unexpected error occurred.
        Please try again later.
      </message>

      <message lang="it">
        <b>❌ Errore</b>

        Si è verificato un errore imprevisto.
        Riprova più tardi.
      </message>

      <message lang="id">
        <b>❌ Kesalahan</b>

        Terjadi kesalahan yang tidak diharapkan.
        Silakan coba lagi nanti.
      </message>
    </base>
  `
}
