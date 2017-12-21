/**
 * Diagnostics.ts
 *
 * Integrates the `textDocument/publishDiagnostics` protocol with Oni's UI
 */

import * as types from "vscode-languageserver-types"

import { Event, IEvent } from "oni-types"

import * as UI from "./../UI"
import * as Selectors from "./../UI/Selectors"

import { ILanguageServerNotificationResponse, LanguageManager } from "./Language"

import * as Helpers from "./../Plugins/Api/LanguageClient/LanguageClientHelpers"

import * as Utility from "./../Utility"

interface IPublishDiagnosticsParams {
    uri: string
    diagnostics: types.Diagnostic[]
}

export interface Errors { [file: string]: { [key: string]: types.Diagnostic[] } }

export interface IDiagnosticsDataSource {
    onErrorsChanged: IEvent<void>

    getErrors(): Errors

    setErrors(filePath: string, key: string, errors: types.Diagnostic[]): void
    getErrorsForPosition(filePath: string, line: number, column: number): types.Diagnostic[]

    start(languageManager: LanguageManager): void
}

export class DiagnosticsDataSource {

    private _errors: Errors = {}
    private _onErrorsChangedEvent = new Event<void>()

    public get onErrorsChanged(): IEvent<void> {
        return this._onErrorsChangedEvent
    }

    public setErrors(filePath: string, key: string, errors: types.Diagnostic[]): void {
        const currentFile = this._errors[filePath] || null

        this._errors = {
            ...this._errors,
            [filePath]: {
                ...currentFile,
                [key]: [...errors],
            }
        }

        this._onErrorsChangedEvent.dispatch()
    }

    public getErrors(): Errors {
        return this._errors
    }

    public getErrorsForPosition(filePath: string, line: number, column: number): types.Diagnostic[] {
        const state: any = UI.store.getState()
        const errors = Selectors.getAllErrorsForFile(Utility.normalizePath(filePath), state.errors)

        return errors.filter((diagnostic) => {
            return Utility.isInRange(line, column, diagnostic.range)
        })
    }

    public start(languageManager: LanguageManager): void {
        languageManager.subscribeToLanguageServerNotification("textDocument/publishDiagnostics", (args: ILanguageServerNotificationResponse) => {
            const test = args.payload as IPublishDiagnosticsParams

            const file = Helpers.unwrapFileUriPath(test.uri)
            const key = "language-" + args.language

            this.setErrors(file, key, test.diagnostics)
        })
    }
}

let _diagnostics: DiagnosticsDataSource = null

export const getInstance = (): IDiagnosticsDataSource => {

    if (!_diagnostics) {
        _diagnostics = new DiagnosticsDataSource()
    }

    return _diagnostics
}