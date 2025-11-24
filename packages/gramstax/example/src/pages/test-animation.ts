import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestAnimationPage extends CtxCore {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editAnimation(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        This is a caption text for media <b>animation</b>
      </media>

      <media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        Ini adalah caption text untuk media <b>animasi</b>
      </media>
    </base>
  `
}
