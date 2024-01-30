import type { File, Store } from "./store";

import {
    MagicString,
    babelParse,
    extractIdentifiers,
    isInDestructureAssignment,
    isStaticProperty,
    walk,
    walkIdentifiers,
} from '@vue/compiler-sfc'

import { type ExportSpecifier, type Identifier, type Node } from '@babel/types'

import { join, dirname } from './utils'

const modulesKey = `__sfc_modules__`
const exportKey = `__sfc_export__`
const staticImportKey = `__static_import__`
const dynamicImportKey = `__dynamic_import__`
const moduleKey = `__module__`

export async function compileModules(store: Store, callback: (type: 'js' | 'css', src: string, filename: string) => Promise<any>) {
    const seen = new Set<File>()
    await processFile(store, store.files[store.mainFile], seen, callback)
}


async function processFile(
    store: Store,
    file: File,
    seen: Set<File>,
    callback: (type: 'js' | 'css', src: string, filename: string) => Promise<any>
) {
    if (!file) {
        throw new Error("file is empty")
    }
    if (seen.has(file)) {
        return []
    }
    seen.add(file)
    let {
        code: js,
        importedFiles,
        hasDynamicImport,
        filetype
    } = await processModule(
        store,
        file
    )
    if (filetype != 'css') {
        await processChildFiles(
            store,
            importedFiles!,
            hasDynamicImport!,
            seen,
            callback
        )
    }

    if (file.compiled.css && file.data.language !== 'css') {
        await callback('css', file.compiled.css, file.filename);
    }

    await callback('js', js, file.filename)
}


async function processChildFiles(
    store: Store,
    importedFiles: Set<string>,
    hasDynamicImport: boolean,
    seen: Set<File>,
    callback: (type: 'js' | 'css', src: string, filename: string) => Promise<any>
) {
    if (hasDynamicImport) {
        // process all files
        for (const file of Object.values(store.files)) {
            if (seen.has(file)) continue
            await processFile(store, file, seen, callback)
        }
    } else if (importedFiles.size > 0) {
        // crawl child imports
        for (const imported of importedFiles) {
            await processFile(store, store.files[imported], seen, callback)
        }
    }
}


async function processModule(store: Store, file: File) {
    if (file.data.language === 'css') {
        return {
            filetype: 'css',
            code: `export default async function(_1, _2, _3, _4, addCss) { addCss(${JSON.stringify(file.compiled.css)}) }`
        }
    }
    const src = file.compiled.js
    if (!src) {
        throw new Error(`Module ${file.filename} is empty`)
    }
    const filename = file.filename
    const s = new MagicString(src)
    const ast = babelParse(src, {
        sourceFilename: filename,
        sourceType: 'module',
    }).program.body

    const idToImportMap = new Map<string, string>()
    const declaredConst = new Set<string>()
    const importedFiles = {
        local: new Set<string>(),
        other: new Set<string>()
    }
    const importToIdMap = {
        local: new Map<string, string>(),
        other: new Map<string, string>()
    }

    function resolveImport(raw: string): string | undefined {
        const files = store.files
        let resolved = raw
        const file =
            files[resolved] ||
            files[(resolved = raw + '.ts')] ||
            files[(resolved = raw + '.js')]
        return file ? resolved : undefined
    }

    async function defineImport(node: Node, source: string, pathname: string) {
        function addImport(importType: 'local' | 'other', name: string) {
            if (importedFiles[importType].has(name)) {
                return importToIdMap[importType].get(name)!
            }
            importedFiles[importType].add(name)
            const id = `__sfc_${importType}_import_${importedFiles[importType].size}__`
            importToIdMap[importType].set(name, id)
            return id;
        }
        if (source.startsWith('./') || source.startsWith('../')) {
            const resolvedPath = join(dirname(pathname), source)
            let filename = resolveImport(resolvedPath)
            if (!filename) {
                filename = resolvedPath
                await store.getFile(filename, source)
            }
            if (importedFiles['local'].has(filename)) {
                return importToIdMap['local'].get(filename)!
            }
            const id = addImport('local', filename)
            s.appendLeft(
                node.start!,
                `const ${id} = ${modulesKey}[${JSON.stringify(filename)}]\n`,
            )
            return id;
        }
        if (importedFiles['other'].has(source)) {
            return importToIdMap['other'].get(source)!
        }
        const id = addImport('other', source)
        s.appendLeft(
            node.start!,
            `const ${id} = await ${staticImportKey}(${JSON.stringify(source)})\n`,
        )
        return id
        
    }

    function defineExport(name: string, local = name) {
        s.append(`\n${exportKey}(${moduleKey}, "${name}", () => ${local})`)
    }

    // 0. instantiate module
    s.prepend(
        `\n\nexport default async function(${modulesKey}, ${exportKey}, ${dynamicImportKey}, ${staticImportKey}) {\n` +
        `const ${moduleKey} = ${modulesKey}[${JSON.stringify(filename)}] = { [Symbol.toStringTag]: "Module" }\n\n`,
    )

    // 1. check all import statements and record id -> importName map
    for (const node of ast) {
        // import foo from 'foo' --> foo -> __import_foo__.default
        // import { baz } from 'foo' --> baz -> __import_foo__.baz
        // import * as ok from 'foo' --> ok -> __import_foo__
        if (node.type === 'ImportDeclaration') {
            const importId = await defineImport(node, node.source.value, filename)
            for (const spec of node.specifiers) {
                if (spec.type === 'ImportSpecifier') {
                    idToImportMap.set(
                        spec.local.name,
                        `${importId}.${(spec.imported as Identifier).name}`,
                    )
                } else if (spec.type === 'ImportDefaultSpecifier') {
                    idToImportMap.set(spec.local.name, `${importId}.default`)
                } else {
                    // namespace specifier
                    idToImportMap.set(spec.local.name, importId)
                }
            }
            s.remove(node.start!, node.end!)
        }
    }

    // 2. check all export statements and define exports
    for (const node of ast) {
        // named exports
        if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                if (
                    node.declaration.type === 'FunctionDeclaration' ||
                    node.declaration.type === 'ClassDeclaration'
                ) {
                    // export function foo() {}
                    defineExport(node.declaration.id!.name)
                } else if (node.declaration.type === 'VariableDeclaration') {
                    // export const foo = 1, bar = 2
                    for (const decl of node.declaration.declarations) {
                        for (const id of extractIdentifiers(decl.id)) {
                            defineExport(id.name)
                        }
                    }
                }
                s.remove(node.start!, node.declaration.start!)
            } else if (node.source) {
                // export { foo, bar } from './foo'
                const importId = defineImport(node, node.source.value, filename)
                for (const spec of node.specifiers) {
                    defineExport(
                        (spec.exported as Identifier).name,
                        `${importId}.${(spec as ExportSpecifier).local.name}`,
                    )
                }
                s.remove(node.start!, node.end!)
            } else {
                // export { foo, bar }
                for (const spec of node.specifiers) {
                    const local = (spec as ExportSpecifier).local.name
                    const binding = idToImportMap.get(local)
                    defineExport((spec.exported as Identifier).name, binding || local)
                }
                s.remove(node.start!, node.end!)
            }
        }

        // default export
        if (node.type === 'ExportDefaultDeclaration') {
            if ('id' in node.declaration && node.declaration.id) {
                // named hoistable/class exports
                // export default function foo() {}
                // export default class A {}
                const { name } = node.declaration.id
                s.remove(node.start!, node.start! + 15)
                s.append(`\n${exportKey}(${moduleKey}, "default", () => ${name})`)
            } else {
                // anonymous default exports
                s.overwrite(node.start!, node.start! + 14, `${moduleKey}.default =`)
            }
        }

        // export * from './foo'
        if (node.type === 'ExportAllDeclaration') {
            const importId = defineImport(node, node.source.value, filename)
            s.remove(node.start!, node.end!)
            s.append(`\nfor (const key in ${importId}) {
          if (key !== 'default') {
            ${exportKey}(${moduleKey}, key, () => ${importId}[key])
          }
        }`)
        }
    }

    // 3. convert references to import bindings
    for (const node of ast) {
        if (node.type === 'ImportDeclaration') continue
        walkIdentifiers(node, (id, parent, parentStack) => {
            const binding = idToImportMap.get(id.name)
            if (!binding) {
                return
            }
            if (isStaticProperty(parent) && parent.shorthand) {
                // let binding used in a property shorthand
                // { foo } -> { foo: __import_x__.foo }
                // skip for destructure patterns
                if (
                    !(parent as any).inPattern ||
                    isInDestructureAssignment(parent, parentStack)
                ) {
                    s.appendLeft(id.end!, `: ${binding}`)
                }
            } else if (
                parent.type === 'ClassDeclaration' &&
                id === parent.superClass
            ) {
                if (!declaredConst.has(id.name)) {
                    declaredConst.add(id.name)
                    // locate the top-most node containing the class declaration
                    const topNode = parentStack[1]
                    s.prependRight(topNode.start!, `const ${id.name} = ${binding};\n`)
                }
            } else {
                s.overwrite(id.start!, id.end!, binding)
            }
        })
    }

    // 4. convert dynamic imports
    let hasDynamicImport = false
    walk(ast, {
        enter(node: Node, parent: Node) {
            if (node.type === 'Import' && parent.type === 'CallExpression') {
                const arg = parent.arguments[0]
                if (arg.type === 'StringLiteral' && (arg.value.startsWith('./') || arg.value.startsWith('../'))) {
                    hasDynamicImport = true
                    s.overwrite(node.start!, node.start! + 6, dynamicImportKey)
                    const name = join(dirname(filename), arg.value)
                    let importFilename = resolveImport(name)
                    if (!importFilename) {
                        importFilename = name
                        store.getFile(name, arg.value)
                    }
                    s.overwrite(
                        arg.start!,
                        arg.end!,
                        JSON.stringify(importFilename),
                    )
                }
            }
        },
    })

    s.append(`\n\n}`)

    return {
        code: s.toString(),
        importedFiles: importedFiles['local'],
        hasDynamicImport,
        filetype: 'js'
    }
}
