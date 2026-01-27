import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAnimationPage extends PageBase {
  static data = this.buildData((swc?: string) => [swc])
  static BASE = {dynamicAttr: `dynamic-attribute`}

  kb(isDynamic = false) {
    return this.inlineKeyboard((k, l) => {
      return k //
        .text(isDynamic ? l[1] : l[0]!, this.data.callbackData(isDynamic ? `static` : `dynamic`))
        .row()
        .text(l[2]!, StartPage.data.callbackData(`3`)) // It doesn't have to be "3" and can be filled in with anything. This will automatically enter the callbackPayload route. Why is it filled in? Because the media method doesn't support editing via editMessageText.
    })
  }

  async handleCallbackData() {
    await this.editAnimation(this.kb())
  }

  async handleArgsCallbackData() {
    const swc = this.callbackDataArg
    if (swc == `static`) return await this.handleCallbackData()
    if (swc == `dynamic`) {
      const data = {
        src: `https://www.easygifanimator.net/images/samples/eglite.gif` // Assuming is that the src value is a dynamic thing that is obtained from input or something else like a database.
      }
      await this.editAnimation(this.kb(true), data, `dynamic-attribute`)
    }
  }

  static template = `
    <base>
      <keyboard>🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.id}</keyboard>
      <media type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Animation demo
        
        This animation shows a static media source with caption.
      </media>
      <media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Demo animasi
        
        Animasi ini menunjukkan sumber media statis dengan caption.
      </media>
    </base>
    
    <base id="${this.BASE.dynamicAttr}">
      <media type="animation" src="{{src}}">
        🧩 Dynamic attribute demo

        Supports dynamic variables and exec in attributes (except lang/type) for &lt;media&gt; blocks.

        This is a caption text for media <b>animation</b>.
      </media>
      <media lang="id" type="animation" src="{{src}}">
        🧩 Demo atribut dinamis

        Mendukung variabel dinamis dan exec di atribut (kecuali lang/type) untuk blok &lt;media&gt;.

        Ini adalah caption text untuk media <b>animasi</b>.
      </media>
    </base>
  `
}
