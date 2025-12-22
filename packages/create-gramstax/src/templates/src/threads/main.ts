import { isMainThread } from "bun"

export class MainThread {
  public constructor(wrapCode: () => any) {
    if (isMainThread === true) {
      wrapCode()
    }
  }
}
