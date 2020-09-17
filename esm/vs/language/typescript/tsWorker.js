/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as ts from './lib/typescriptServices.js';
import { libFileMap } from './lib/lib.js';
var TypeScriptWorker = /** @class */ (function () {
    function TypeScriptWorker(ctx, createData) {
        this._extraLibs = Object.create(null);
        this._languageService = ts.createLanguageService(this);
        this._ctx = ctx;
        this._compilerOptions = createData.compilerOptions;
        this._extraLibs = createData.extraLibs;
    }
    // --- language service host ---------------
    TypeScriptWorker.prototype.getCompilationSettings = function () {
        return this._compilerOptions;
    };
    TypeScriptWorker.prototype.getScriptFileNames = function () {
        var models = this._ctx
            .getMirrorModels()
            .map(function (model) { return model.uri.toString(); });
        return models.concat(Object.keys(this._extraLibs));
    };
    TypeScriptWorker.prototype._getModel = function (fileName) {
        var models = this._ctx.getMirrorModels();
        for (var i = 0; i < models.length; i++) {
            if (models[i].uri.toString() === fileName) {
                return models[i];
            }
        }
        return null;
    };
    TypeScriptWorker.prototype.getScriptVersion = function (fileName) {
        var model = this._getModel(fileName);
        if (model) {
            return model.version.toString();
        }
        else if (this.isDefaultLibFileName(fileName)) {
            // default lib is static
            return '1';
        }
        else if (fileName in this._extraLibs) {
            return String(this._extraLibs[fileName].version);
        }
        return '';
    };
    TypeScriptWorker.prototype.getScriptText = function (fileName) {
        return Promise.resolve(this._getScriptText(fileName));
    };
    TypeScriptWorker.prototype._getScriptText = function (fileName) {
        var text;
        var model = this._getModel(fileName);
        var libizedFileName = 'lib.' + fileName + '.d.ts';
        if (model) {
            // a true editor model
            text = model.getValue();
        }
        else if (fileName in libFileMap) {
            text = libFileMap[fileName];
        }
        else if (libizedFileName in libFileMap) {
            text = libFileMap[libizedFileName];
        }
        else if (fileName in this._extraLibs) {
            // extra lib
            text = this._extraLibs[fileName].content;
        }
        else {
            return;
        }
        return text;
    };
    TypeScriptWorker.prototype.getScriptSnapshot = function (fileName) {
        var text = this._getScriptText(fileName);
        if (text === undefined) {
            return;
        }
        return {
            getText: function (start, end) { return text.substring(start, end); },
            getLength: function () { return text.length; },
            getChangeRange: function () { return undefined; }
        };
    };
    TypeScriptWorker.prototype.getScriptKind = function (fileName) {
        var suffix = fileName.substr(fileName.lastIndexOf('.') + 1);
        switch (suffix) {
            case 'ts':
                return ts.ScriptKind.TS;
            case 'tsx':
                return ts.ScriptKind.TSX;
            case 'js':
                return ts.ScriptKind.JS;
            case 'jsx':
                return ts.ScriptKind.JSX;
            default:
                return this.getCompilationSettings().allowJs
                    ? ts.ScriptKind.JS
                    : ts.ScriptKind.TS;
        }
    };
    TypeScriptWorker.prototype.getCurrentDirectory = function () {
        return '';
    };
    TypeScriptWorker.prototype.getDefaultLibFileName = function (options) {
        switch (options.target) {
            case 99 /* ESNext */:
                var esnext = 'lib.esnext.full.d.ts';
                if (esnext in libFileMap || esnext in this._extraLibs)
                    return esnext;
            case 7 /* ES2020 */:
            case 6 /* ES2019 */:
            case 5 /* ES2018 */:
            case 4 /* ES2017 */:
            case 3 /* ES2016 */:
            case 2 /* ES2015 */:
            default:
                // Support a dynamic lookup for the ES20XX version based on the target
                // which is safe unless TC39 changes their numbering system
                var eslib = "lib.es" + (2013 + (options.target || 99)) + ".full.d.ts";
                // Note: This also looks in _extraLibs, If you want
                // to add support for additional target options, you will need to
                // add the extra dts files to _extraLibs via the API.
                if (eslib in libFileMap || eslib in this._extraLibs) {
                    return eslib;
                }
                return 'lib.es6.d.ts'; // We don't use lib.es2015.full.d.ts due to breaking change.
            case 1:
            case 0:
                return 'lib.d.ts';
        }
    };
    TypeScriptWorker.prototype.isDefaultLibFileName = function (fileName) {
        return fileName === this.getDefaultLibFileName(this._compilerOptions);
    };
    TypeScriptWorker.prototype.getLibFiles = function () {
        return Promise.resolve(libFileMap);
    };
    // --- language features
    TypeScriptWorker.clearFiles = function (diagnostics) {
        // Clear the `file` field, which cannot be JSON'yfied because it
        // contains cyclic data structures.
        diagnostics.forEach(function (diag) {
            diag.file = undefined;
            var related = diag.relatedInformation;
            if (related) {
                related.forEach(function (diag2) { return (diag2.file = undefined); });
            }
        });
        return diagnostics;
    };
    TypeScriptWorker.prototype.getSyntacticDiagnostics = function (fileName) {
        var diagnostics = this._languageService.getSyntacticDiagnostics(fileName);
        return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
    };
    TypeScriptWorker.prototype.getSemanticDiagnostics = function (fileName) {
        var diagnostics = this._languageService.getSemanticDiagnostics(fileName);
        return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
    };
    TypeScriptWorker.prototype.getSuggestionDiagnostics = function (fileName) {
        var diagnostics = this._languageService.getSuggestionDiagnostics(fileName);
        return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
    };
    TypeScriptWorker.prototype.getCompilerOptionsDiagnostics = function (fileName) {
        var diagnostics = this._languageService.getCompilerOptionsDiagnostics();
        return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
    };
    TypeScriptWorker.prototype.getCompletionsAtPosition = function (fileName, position) {
        return Promise.resolve(this._languageService.getCompletionsAtPosition(fileName, position, undefined));
    };
    TypeScriptWorker.prototype.getCompletionEntryDetails = function (fileName, position, entry) {
        return Promise.resolve(this._languageService.getCompletionEntryDetails(fileName, position, entry, undefined, undefined, undefined));
    };
    TypeScriptWorker.prototype.getSignatureHelpItems = function (fileName, position) {
        return Promise.resolve(this._languageService.getSignatureHelpItems(fileName, position, undefined));
    };
    TypeScriptWorker.prototype.getQuickInfoAtPosition = function (fileName, position) {
        return Promise.resolve(this._languageService.getQuickInfoAtPosition(fileName, position));
    };
    TypeScriptWorker.prototype.getOccurrencesAtPosition = function (fileName, position) {
        return Promise.resolve(this._languageService.getOccurrencesAtPosition(fileName, position));
    };
    TypeScriptWorker.prototype.getDefinitionAtPosition = function (fileName, position) {
        return Promise.resolve(this._languageService.getDefinitionAtPosition(fileName, position));
    };
    TypeScriptWorker.prototype.getReferencesAtPosition = function (fileName, position) {
        return Promise.resolve(this._languageService.getReferencesAtPosition(fileName, position));
    };
    TypeScriptWorker.prototype.getNavigationBarItems = function (fileName) {
        return Promise.resolve(this._languageService.getNavigationBarItems(fileName));
    };
    TypeScriptWorker.prototype.getFormattingEditsForDocument = function (fileName, options) {
        return Promise.resolve(this._languageService.getFormattingEditsForDocument(fileName, options));
    };
    TypeScriptWorker.prototype.getFormattingEditsForRange = function (fileName, start, end, options) {
        return Promise.resolve(this._languageService.getFormattingEditsForRange(fileName, start, end, options));
    };
    TypeScriptWorker.prototype.getFormattingEditsAfterKeystroke = function (fileName, postion, ch, options) {
        return Promise.resolve(this._languageService.getFormattingEditsAfterKeystroke(fileName, postion, ch, options));
    };
    TypeScriptWorker.prototype.findRenameLocations = function (fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename) {
        return Promise.resolve(this._languageService.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename));
    };
    TypeScriptWorker.prototype.getRenameInfo = function (fileName, position, options) {
        return Promise.resolve(this._languageService.getRenameInfo(fileName, position, options));
    };
    TypeScriptWorker.prototype.getEmitOutput = function (fileName) {
        return Promise.resolve(this._languageService.getEmitOutput(fileName));
    };
    TypeScriptWorker.prototype.getCodeFixesAtPosition = function (fileName, start, end, errorCodes, formatOptions) {
        var preferences = {};
        return Promise.resolve(this._languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences));
    };
    TypeScriptWorker.prototype.updateExtraLibs = function (extraLibs) {
        this._extraLibs = extraLibs;
    };
    return TypeScriptWorker;
}());
export { TypeScriptWorker };
export function create(ctx, createData) {
    var TSWorkerClass = TypeScriptWorker;
    if (createData.customWorkerPath) {
        if (typeof importScripts === 'undefined') {
            console.warn('Monaco is not using webworkers for background tasks, and that is needed to support the customWorkerPath flag');
        }
        else {
            importScripts(createData.customWorkerPath);
            var workerFactoryFunc = self.customTSWorkerFactory;
            if (!workerFactoryFunc) {
                throw new Error("The script at " + createData.customWorkerPath + " does not add customTSWorkerFactory to self");
            }
            TSWorkerClass = workerFactoryFunc(TypeScriptWorker, ts, libFileMap);
        }
    }
    return new TSWorkerClass(ctx, createData);
}
