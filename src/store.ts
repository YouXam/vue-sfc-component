import * as defaultCompiler from '@vue/compiler-sfc'
import type {
    SFCAsyncStyleCompileOptions,
    SFCScriptCompileOptions,
    SFCTemplateCompileOptions,
} from '@vue/compiler-sfc'

export interface SFCOptions {
    script?: Partial<SFCScriptCompileOptions>
    style?: Partial<SFCAsyncStyleCompileOptions>
    template?: Partial<SFCTemplateCompileOptions>
}


export class Store  {
    errors: (string | Error)[] = []
    showOutput: boolean = false
    sfcOptions: SFCOptions = {}
    compiler: typeof defaultCompiler = defaultCompiler
    constructor(
        public mainFile: string,
        public files: Record<string, File>,
        public getFileHandler?: (filename: string, target: string) => Promise<File>
        ) {
    }

    async getFile(filename: string, target: string) {
        if (this.files[filename]) {
            return this.files[filename]
        }
        if (this.getFileHandler) {
            return await this.getFileHandler(filename, target)
        }
        throw new Error(`File ${filename} not found`)
    }
}

export type FileType = 'css' | 'javascript' | 'typescript' | 'json' | 'vue'

export class File {
    compiled = {
        js: '',
        css: ''
    }

    finished = false

    constructor(
        public filename: string,
        public content = '',
        public filetype?: FileType
    ) { }


    get language() : FileType | 'other' {
        if (this.filetype) {
            return this.filetype
        }
        if (this.filename.endsWith('.vue')) {
            return 'vue'
        }
        if (this.filename.endsWith('.css')) {
            return 'css'
        }
        if (this.filename.endsWith('.ts')) {
            return 'typescript'
        }
        if (this.filename.endsWith('.json')) {
            return 'json'
        }
        if (this.filename.endsWith('.js')) {
            return 'javascript'
        }
        return 'other'
    }

    set language(value: FileType) {
        if ([ 'css', 'javascript', 'typescript', 'json', 'vue' ].includes(value)) {
            this.filetype = value
        } else {
            throw new Error(`Invalid file type ${value}`)
        }
    }
}