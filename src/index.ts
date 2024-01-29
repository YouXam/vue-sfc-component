import { Store, File as SFile } from './store'
import { compileFile } from './transform'


import { compileModules } from './moduleCompiler'

import { Component } from 'vue'
import * as vue from 'vue'

import 'systemjs'

export interface File {
    filename: string;
    content: string | ArrayBuffer | URL;
    language: string;
    mimetype?: string;
}

import 'systemjs-babel'

async function runInModule(src: string) {
    const blob = new Blob([src], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const module = await System.import(blobUrl)
    return module
}

type ImportMap = {
    imports?: Record<string, any>;
    scopes?: Record<string, Record<string, any>>;
};

declare global {
    var  __systemjs__: Record<string, any>;
    var  __VUE_OPTIONS_API__: boolean;
    var  __VUE_PROD_DEVTOOLS__: boolean;
    var  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean;
}

const systemjsKey = '__systemjs__'
function getImportUrl(moduleName: string, moduleExports: any) {
    if (!globalThis[systemjsKey]) globalThis[systemjsKey] = {}
    globalThis[systemjsKey][moduleName] = moduleExports[Symbol.toStringTag] === 'Module' ? moduleExports : {
        default: moduleExports
    }
    const src = 
        `System.register([], function($__export, $__moduleContext) {\n` +
        `    $__export(globalThis[${JSON.stringify(systemjsKey)}][${JSON.stringify(moduleName)}]);\n` +
        `    return { execute: function() {} };\n` +
        `});`
    const blob = new Blob([src], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl
}

function registerModulesWithSystemJS(importMap: ImportMap) {
    function walk(obj: Record<string, any>) {
        for (const [moduleName, moduleExports] of Object.entries(obj)) {
            if (typeof moduleExports === 'string') continue
            if (globalThis[systemjsKey]?.[moduleName]) delete obj[moduleName]
             else obj[moduleName] = getImportUrl(moduleName, moduleExports)
        }
    } 
    if (importMap.imports) {
        walk(importMap.imports)
    }
    if (importMap.scopes) {
        for (const scopeImports of Object.values(importMap.scopes)) {
            walk(scopeImports)
        }
    }

    System.addImportMap({
        imports: importMap.imports,
        scopes: importMap.scopes
    });
}





async function convertFileContent(file: FileContent | URL): Promise<string | ArrayBuffer | URL> {
    if (file instanceof Response || file instanceof Blob) {
        if (file instanceof Response) {
            const contentType = file.headers.get('content-type')
            if (contentType?.startsWith('text/')) {
                return await file.text()
            }
            file = await file.blob()
        }
        return await file.arrayBuffer()
    }
    return file

}


type MaybePromise<T> = T | Promise<T>
type FileContent = string | ArrayBuffer | Blob | Response
export async function defineSFC(
    mainfile: string,
    options?: {
        imports?: Record<string, any>;
        files?: Record<string, FileContent | URL>;
        getFile?: (path: string) => MaybePromise<FileContent | URL>;
        renderStyles?: (css: string) => MaybePromise<string>;
        catch?: (errors: Array<string | Error>) => MaybePromise<void>;
        fileConvertRule?: (file: File) => MaybePromise<void>;
    }
) : Promise<Component> {


    function ensureAsync(fn?: (...arg: any) => any) {
        if (!fn) return
        return async function(...arg: any) {
            const r = fn(...arg)
            if (r instanceof Promise) {
                return await r
            }
            return r
        }
    }
    if (options) {
        options.getFile &&= ensureAsync(options?.getFile)
        options.renderStyles &&= ensureAsync(options?.renderStyles)
        options.catch = ensureAsync(options?.catch) || console.error
        options.fileConvertRule = ensureAsync(options?.fileConvertRule)
    }

    async function fileConvertRuleWithFile(file: SFile) {
        if (options?.fileConvertRule) {
            const tmpFile: File = {
                filename: file.filename,
                content: file.data.content,
                language: file.data.language
            }
            if (file.isUnknown()) {
                tmpFile.mimetype = file.data.mimetype
            }
            await options.fileConvertRule(tmpFile)
            const diff: { content?: string | ArrayBuffer | URL, language?: string, mimetype?: string } = {}
            if (tmpFile.content !== file.data.content) diff.content = tmpFile.content
            if (tmpFile.language !== file.data.language) diff.language = tmpFile.language
            if (tmpFile.language !== file.data.language) diff.language = tmpFile.language
            if (file.isUnknown() && tmpFile.mimetype !== file.data.mimetype) diff.mimetype = tmpFile.mimetype
            file.set(diff)
        }
        return file
    }

    registerModulesWithSystemJS({
        imports: {
            vue,
            ...options?.imports
        }
    })

    const files: SFile[] = options?.files ? 
        await Promise.all(Object.entries(options?.files).map(async ([filename, content]) => {
            return new SFile(filename, await convertFileContent(content))
        })) : [] as any

    const filesMap: Record<string, SFile> = Object.fromEntries(files.map(file => [file.filename, file]))

    const store: Store = new Store(mainfile, filesMap,
        options?.getFile ? async (filename: string, target: string) => {
            const content = await options.getFile!(target)
            store.files[filename] = new SFile(filename, await convertFileContent(content))
            await fileConvertRuleWithFile(store.files[filename])
            const errors = await compileFile(store, store.files[filename])
            if (errors.length > 0 && options?.catch) options.catch(errors)
            return store.files[filename]
        } : undefined
    )


    if (!store.files[mainfile]) {
        await store.getFile(mainfile, mainfile)
    }

    await Promise.all(Object.values(store.files).map(file => 
        (async (file: SFile) => {
            await fileConvertRuleWithFile(file)
            const errors = await compileFile(store, file)
            if (errors.length > 0 && options?.catch) await options.catch(errors)
        })(file)
    ))

    if (store.files[mainfile].data.language !== 'vue') {
        throw new Error('Main file must be a .vue file or can be treated as a .vue file')
    }
    
    const modules: Record<string, any> = {}

    const css: string[] = []

    await compileModules(store, async (type, src) => {
        if (type === 'css') css.push(src)
        else {
            const defineModule = await runInModule(src)
            defineModule.default(
                modules,
                (mod: any, key: string, get: any) => {
                    Object.defineProperty(mod, key, { enumerable: true, configurable: true, get })
                },
                (key: string) => Promise.resolve(modules[key])
            )
        }
    })

    const styles = css.reverse().map((s: string) => `<style data-css-sfc>${s}</style>`).join('\\n')
    if (options?.renderStyles) await options?.renderStyles(styles)
    else {
        document.querySelectorAll('style[data-css-sfc]').forEach(el => el.remove())
        document.head.insertAdjacentHTML('beforeend', styles)
    }

    return modules[store.mainFile].default as Component
}