import { type File, type Store } from './store'
import type {
  BindingMetadata,
  CompilerOptions,
  SFCDescriptor,
} from 'vue/compiler-sfc'
import { transform } from 'sucrase'
import hashId from 'hash-sum'

import { join } from './utils'

import postcss from './libs/postcss/lib/postcss.js'
import postcssImport from './libs/postcss-import/index.js'

import { guessMimeType } from './store'

export const COMP_IDENTIFIER = `__sfc__`

async function transformTS(src: string) {
  return transform(src, {
    transforms: ['typescript'],
  }).code
}


export async function compileFile(
  store: Store,
  file: File
): Promise<(string | Error)[]> {

  if (!file.isKnown()) {
    if (file.data.content instanceof URL) {
      file.compiled.js = `export default ${JSON.stringify(file.data.content)}`
      return []
    }
    const blob = new Blob([file.data.content], { type: guessMimeType(file.filename) })
    const url = URL.createObjectURL(blob)
    file.compiled.js = `export default ${JSON.stringify(url)}`
    return []
  }

  let { data: { content }, filename, compiled, finished } = file

  const setFinished = (errors: (string | Error)[]) => {
    file.finished = true
    return errors
  }

  if (content instanceof URL) {
    const res = await fetch(content)
    content = await res.text()
  }


  if (finished) {
    return []
  }
  if (!content.trim()) {
    return setFinished([])
  }

  if (file.data.language === 'css') {
    compiled.css = content

    function load(id: string, _: any) {
      const file = store.files[id]
      if (!file) {
        throw new Error(`css can not import ${id} because it is not found`)
      } else if (file.isUnknown()) {
        throw new Error(`css can not import ${id}`)
      } else if (file.data.language !== 'css') {
        throw new Error(`css can not import ${id} because it is not css`)
      } else if (file.data.content instanceof URL) {
        async function get() {
          const res = await fetch(file.data.content as URL)
          return res.text()
        }
        return get()
      } 
      return Promise.resolve(file.data.content);
    }


    function resolve(id: string, base: string, _: any) {
      return Promise.resolve(join(base, id));
    }

    const postcssError: any = []

    function compileStyles(): Promise<string> {
      return new Promise(res => {
        postcss()
          .use(postcssImport({
            root: '.',
            load,
            resolve
          }))
          .process(content, { from: file.filename })
          .then(result => res(result.css))
          .catch(error => {
            postcssError.push(error.toString())
            res('')
          });
      })
    }

    compiled.css = await compileStyles();
    return setFinished(postcssError)
  }

  if (file.data.language === 'javascript' || file.data.language === 'typescript') {
    if (file.data.language === 'typescript') {
      content = await transformTS(content)
    }
    compiled.js = content
    return setFinished([])
  }

  if (file.data.language === 'json') {
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (err: any) {
      console.error(`Error parsing ${filename}`, err.message)
      return setFinished([err.message])
    }
    compiled.js = `export default ${JSON.stringify(parsed)}`
    return setFinished([])
  }


  const id = hashId(filename)
  const { errors, descriptor } = store.compiler.parse(content, {
    filename,
    sourceMap: true,
    templateParseOptions: store.sfcOptions?.template?.compilerOptions,
  })
  if (errors.length) {
    return setFinished(errors)
  }

  if (
    descriptor.styles.some((s: any) => s.lang) ||
    (descriptor.template && descriptor.template.lang)
  ) {
    return setFinished([
      `lang="x" pre-processors for <template> or <style> are currently not ` +
      `supported.`,
    ])
  }

  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang)
  const isTS = scriptLang === 'ts'
  if (scriptLang && !isTS) {
    return setFinished([`Only lang="ts" is supported for <script> blocks.`])
  }

  const hasScoped = descriptor.styles.some((s: any) => s.scoped)
  let clientCode = ''
  let ssrCode = ''

  const appendSharedCode = (code: string) => {
    clientCode += code
    ssrCode += code
  }

  let clientScript: string
  let bindings: BindingMetadata | undefined
  try {
    ;[clientScript, bindings] = await doCompileScript(
      store,
      descriptor,
      id,
      false,
      isTS,
    )
  } catch (e: any) {
    return setFinished([e.stack.split('\n').slice(0, 12).join('\n')])
  }

  clientCode += clientScript

  // script ssr needs to be performed if :
  // 1.using <script setup> where the render fn is inlined.
  // 2.using cssVars, as it do not need to be injected during SSR.
  if (descriptor.scriptSetup || descriptor.cssVars.length > 0) {
    try {
      const ssrScriptResult = await doCompileScript(
        store,
        descriptor,
        id,
        true,
        isTS,
      )
      ssrCode += ssrScriptResult[0]
    } catch (e) {
      ssrCode = `/* SSR compile error: ${e} */`
    }
  } else {
    // the script result will be identical.
    ssrCode += clientScript
  }

  // template
  // only need dedicated compilation if not using <script setup>
  if (
    descriptor.template &&
    (!descriptor.scriptSetup ||
      store.sfcOptions?.script?.inlineTemplate === false)
  ) {
    const clientTemplateResult = await doCompileTemplate(
      store,
      descriptor,
      id,
      bindings,
      false,
      isTS,
    )
    if (Array.isArray(clientTemplateResult)) {
      return setFinished(clientTemplateResult)
    }
    clientCode += `;${clientTemplateResult}`

    const ssrTemplateResult = await doCompileTemplate(
      store,
      descriptor,
      id,
      bindings,
      true,
      isTS,
    )
    if (typeof ssrTemplateResult === 'string') {
      // ssr compile failure is fine
      ssrCode += `;${ssrTemplateResult}`
    } else {
      ssrCode = `/* SSR compile error: ${ssrTemplateResult[0]} */`
    }
  }

  if (hasScoped) {
    appendSharedCode(
      `\n${COMP_IDENTIFIER}.__scopeId = ${JSON.stringify(`data-v-${id}`)}`,
    )
  }

  // styles
  const ceFilter = store.sfcOptions.script?.customElement || /\.ce\.vue$/
  function isCustomElement(filters: typeof ceFilter): boolean {
    if (typeof filters === 'boolean') {
      return filters
    }
    if (typeof filters === 'function') {
      return filters(filename)
    }
    return filters.test(filename)
  }
  let isCE = isCustomElement(ceFilter)

  let css = ''
  let styles: string[] = []
  for (const style of descriptor.styles) {
    if (style.module) {
      return setFinished([`<style module> is not supported in the playground.`])
    }

    const styleResult = await store.compiler.compileStyleAsync({
      ...store.sfcOptions?.style,
      source: style.content,
      filename,
      id,
      scoped: style.scoped,
      modules: !!style.module,
    })
    if (styleResult.errors.length) {
      // postcss uses pathToFileURL which isn't polyfilled in the browser
      // ignore these errors for now
      if (!styleResult.errors[0].message.includes('pathToFileURL')) {
        store.errors = styleResult.errors
      }
      // proceed even if css compile errors
    } else {
      isCE ? styles.push(styleResult.code) : (css += styleResult.code + '\n')
    }
  }
  if (css) {
    compiled.css = css.trim()
  } else {
    compiled.css = isCE
      ? (compiled.css =
        '/* The component style of the custom element will be compiled into the component object */')
      : '/* No <style> tags present */'
  }

  if (clientCode || ssrCode) {
    const ceStyles = isCE
      ? `\n${COMP_IDENTIFIER}.styles = ${JSON.stringify(styles)}`
      : ''
    appendSharedCode(
      `\n${COMP_IDENTIFIER}.__file = ${JSON.stringify(filename)}` +
      ceStyles +
      `\nexport default ${COMP_IDENTIFIER}`,
    )
    compiled.js = clientCode.trimStart()
  }

  return setFinished([])
}

async function doCompileScript(
  store: Store,
  descriptor: SFCDescriptor,
  id: string,
  ssr: boolean,
  isTS: boolean,
): Promise<[code: string, bindings: BindingMetadata | undefined]> {
  if (descriptor.script || descriptor.scriptSetup) {
    const expressionPlugins: CompilerOptions['expressionPlugins'] = isTS
      ? ['typescript']
      : undefined
    const compiledScript = store.compiler.compileScript(descriptor, {
      inlineTemplate: true,
      ...store.sfcOptions?.script,
      id,
      templateOptions: {
        ...store.sfcOptions?.template,
        ssr,
        ssrCssVars: descriptor.cssVars,
        compilerOptions: {
          ...store.sfcOptions?.template?.compilerOptions,
          expressionPlugins,
        },
      },
    })
    let code = ''
    if (compiledScript.bindings) {
      code += `\n/* Analyzed bindings: ${JSON.stringify(
        compiledScript.bindings,
        null,
        2,
      )} */`
    }
    code +=
      `\n` +
      store.compiler.rewriteDefault(
        compiledScript.content,
        COMP_IDENTIFIER,
        expressionPlugins,
      )

    if ((descriptor.script || descriptor.scriptSetup)!.lang === 'ts') {
      code = await transformTS(code)
    }

    return [code, compiledScript.bindings]
  } else {
    return [`\nconst ${COMP_IDENTIFIER} = {}`, undefined]
  }
}

async function doCompileTemplate(
  store: Store,
  descriptor: SFCDescriptor,
  id: string,
  bindingMetadata: BindingMetadata | undefined,
  ssr: boolean,
  isTS: boolean,
) {
  let { code, errors } = store.compiler.compileTemplate({
    isProd: false,
    ...store.sfcOptions?.template,
    ast: descriptor.template!.ast,
    source: descriptor.template!.content,
    filename: descriptor.filename,
    id,
    scoped: descriptor.styles.some((s) => s.scoped),
    slotted: descriptor.slotted,
    ssr,
    ssrCssVars: descriptor.cssVars,
    compilerOptions: {
      ...store.sfcOptions?.template?.compilerOptions,
      bindingMetadata,
      expressionPlugins: isTS ? ['typescript'] : undefined,
    },
  })
  if (errors.length) {
    return errors
  }

  const fnName = ssr ? `ssrRender` : `render`

  code =
    `\n${code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `$1 ${fnName}`,
    )}` + `\n${COMP_IDENTIFIER}.${fnName} = ${fnName}`

  if ((descriptor.script || descriptor.scriptSetup)?.lang === 'ts') {
    code = await transformTS(code)
  }

  return code
}
