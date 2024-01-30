"use strict"
// builtin tooling
import * as path from './lib/path.js'

// internal tooling
import applyConditions from "./lib/apply-conditions.js"
import applyRaws from "./lib/apply-raws.js"
import applyStyles from "./lib/apply-styles.js"
import parseStyles from "./lib/parse-styles.js"

function AtImport(options) {
  options = {
    // root: process.cwd(),
    path: [],
    skipDuplicates: true,
    // resolve: resolveId,
    // load: loadContent,
    plugins: [],
    addModulesDirectories: [],
    warnOnEmpty: true,
    ...options,
  }

  // convert string to an array of a single element
  if (typeof options.path === "string") options.path = [options.path]

  if (!Array.isArray(options.path)) options.path = []

  options.path = options.path.map(p => path.join(options.root, p))

  return {
    postcssPlugin: "postcss-import",
    async Once(styles, { result, atRule, postcss }) {
      const state = {
        importedFiles: {},
        hashFiles: {},
      }

      if (styles.source?.input?.file) {
        state.importedFiles[styles.source.input.file] = {}
      }

      if (options.plugins && !Array.isArray(options.plugins)) {
        throw new Error("plugins option must be an array")
      }
      const bundle = await parseStyles(
        result,
        styles,
        options,
        state,
        [],
        [],
        postcss,
      )

      applyRaws(bundle)
      applyConditions(bundle, atRule)
      applyStyles(bundle, styles)
    },
  }
}

AtImport.postcss = true

export default AtImport
