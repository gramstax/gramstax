import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestDocumentPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditDocument(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
        📄 Document demo
        
        This is a sample document reply with a caption.
      </g-media>
      <g-media lang="id" type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
        📄 Demo dokumen
        
        Ini adalah contoh balasan dokumen dengan caption.
      </g-media>
    </g-base>
  `
}
