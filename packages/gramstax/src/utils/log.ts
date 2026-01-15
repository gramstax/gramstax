import {LoggingPretty} from "logging-pretty"

export class LoggingUtils extends LoggingPretty {
  constructor(options?: ConstructorParameters<typeof LoggingPretty>[0]) {
    super(options)
  }

  errorMake(pureError: any, constructorName?: any, funcName?: string) {
    this.error(`[${constructorName ? `${constructorName}:${funcName}` : funcName}] ${this._formatErrorObj(pureError)}`)
  }

  _formatErrorObj(pureError: any) {
    const error = JSON.stringify(pureError instanceof Error ? {message: pureError.message, stack: pureError.stack, name: pureError.name} : pureError, null, 2)
    return error
  }
}

export const log = new LoggingUtils()
