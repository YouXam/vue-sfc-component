import * as defaultCompiler from '@vue/compiler-sfc'

import { lookup } from './mimetypes'

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


export class Store {
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

type KnownFileType = 'css' | 'javascript' | 'typescript' | 'json' | 'vue';
type UnknownFileType = 'other';

interface UnknownFile {
    state: 'unknown';
    language: UnknownFileType;
    content: string | ArrayBuffer | URL;
    mimetype?: string;
}

interface KnownFile {
    state: 'known';
    language: KnownFileType;
    content: string | URL;
}

export class File  {
    data: UnknownFile | KnownFile;
    finished: boolean = false;
    compiled: {
        js?: string,
        css?: string
    } = {}

    constructor(
        public filename: string,
        content: string | ArrayBuffer | URL
    ) {
        const language = guessFileType(filename);
        if (language === 'other') {
            this.data = {state: 'unknown', language, content, mimetype: guessMimeType(filename) };
        } else {
            if (typeof content !== 'string') throw new Error('Content must be string');
            this.data = { state: 'known', language, content };
        }
    }

    set (options: {
        language?: string,
        content?: string | ArrayBuffer | URL
        mimetype?: string
    }) {
        options.language ||= this.data.language
        options.content ||= this.data.content
        if (options.language === 'other') {
            let oldMimeType = '';
            if (this.isUnknown()) {
                oldMimeType = this.data.mimetype || guessMimeType(this.filename);
            } else {
                oldMimeType = guessMimeType(this.filename);;
            }
            this.data = {
                state: 'unknown',
                language: options.language,
                content: options.content,
                mimetype: options.mimetype || oldMimeType
            };
        } else if ([ 'css', 'javascript', 'typescript', 'json', 'vue' ].includes(options.language)) {
            if (typeof options.content !== 'string') throw new Error('Content must be string');
            this.data = {
                state: 'known',
                language: options.language as KnownFileType,
                content: options.content
            };
        } else {
            throw new Error('Unknown language');
        }
    }

    isKnown(): this is { data: KnownFile } {
        return this.data.state === 'known';
    }

    isUnknown(): this is { data: UnknownFile } {
        return this.data.state === 'unknown';
    }
}

function guessFileType(filename: string): KnownFileType | UnknownFileType {
    const ext = filename.split('.').pop();
    switch (ext) {
        case 'css':
            return 'css';
        case 'js':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'json':
            return 'json';
        case 'vue':
            return 'vue';
        default:
            return 'other';
    }

}


export function guessMimeType(filename: string): string {
    const ext = filename.split('.').pop();
    return ext && lookup(ext) || 'application/octet-stream';
}