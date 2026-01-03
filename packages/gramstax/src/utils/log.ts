import {LoggingPretty} from "logging-pretty"

export class LoggingUtils extends LoggingPretty {
  constructor(options?: ConstructorParameters<typeof LoggingPretty>[0]) {
    super(options)
  }

  errorMake(error: any, constructorName?: any, funcName?: string) {
    this.error(`[${constructorName ? `${constructorName}:${funcName}` : funcName}] ${String(error)}`)
  }
}

export const log = new LoggingUtils()
