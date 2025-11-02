import { LoggingPretty } from "logging-pretty"

export abstract class BaseGeneral {
  public static log = new LoggingPretty()
  public static logError(error: any, func: string) {
    // const name = typeof this.name != `string` ? this.toString().match(/class\s+([^\s{]+)/)?.[1] : this.name
    this.log.error(`[${this.toString().match(/class\s+([^\s{]+)/)?.[1]}:${func}]: ${String(error)}`)
  }

  // protected logError(error: any, func: string, name?: string) {
  //   log.error(`[${name || this.constructor.name}:${func}]: ${String(error)}`)
  // }

  public logError(error: any, constructorName?: string, funcName?: string) {
    ;(this.constructor as any).log.error(`[${constructorName || this.constructor.name}:${funcName}] ${String(error)}`)
  }
}
