import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: TestDocumentPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editDocument(kb)
  }
}

export class TestDocumentPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
        📄 Document demo
        
        This is a sample document reply with a caption.
      </media>
      <media lang="id" type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
        📄 Demo dokumen
        
        Ini adalah contoh balasan dokumen dengan caption.
      </media>
    </base>
  `
}
