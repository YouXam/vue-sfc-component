# vue-sfc-component

English | [简体中文](README_cn.md)

## Introduction

`vue-sfc-component` is a library designed for compiling and mounting Vue Single File Components (SFCs) directly in the browser. It simplifies the process of rendering Vue components from various sources, making it ideal for quick prototyping and educational purposes.

[Live demo](https://stackblitz.com/edit/vitejs-vite-ggbwj7?file=src%2FApp.vue&terminal=dev)

## Features

1. **Front-End Compilation**: All compilations are completed in the browser, eliminating the need for a build step.

2. **TypeScript**: `vue-sfc-component` provides limited TypeScript support (does not check types, only removes type annotations). Simply use the `<script lang="ts">` tag in your `.vue` files or import `.ts` files.

3. **Setup Feature**: Supports the `<script setup>` syntactic sugar.

4. **Multiple Ways to Load Dependencies**: Allows compiled components to use dependencies from the current project or to directly load dependencies via URLs.

5. **Scoped CSS Support**: You can use Scoped CSS to isolate component styles and prevent them from leaking into the global scope.

6. **Seamless Integration with Existing Vue Projects**: `vue-sfc-component` can compile a series of files into a Vue component and use `defineAsyncComponent` for integration into existing Vue projects.

## Installation

Install `vue-sfc-component` using npm:

```bash
npm install vue-sfc-component
```

Or with yarn:

```bash
yarn add vue-sfc-component
```

## Usage

### Basic Usage

```js
import { createApp, defineAsyncComponent } from 'vue'
import { defineSFC } from 'vue-sfc-component';

const files = {
    'App.vue': `
<template>
    <div>
        <h1>{{ msg }}</h1>
        <button @click="msg = msg.split('').reverse().join('')">
            Reverse
        </button>
    </div>
</template>

<script setup>
import { ref } from 'vue'
const msg = ref("Hello World!")
</script>

<style scoped>
h1 {
    color: red;
}
</style>`
}

const app = createApp({
    components: {
      'sfc-component': defineAsyncComponent(() => defineSFC('App.vue', { files })),
    },
    template: `<sfc-component></sfc-component>`
});
  
app.mount('#app')
```

### Advanced Usage

`defineSFC` is the main function of `vue-sfc-component`. It takes a `*.vue` file name and then returns a Vue component. This function also accepts an optional configuration object, allowing you to customize the component loading process.

```ts
type MaybePromise<T> = T | Promise<T>;
type FileContent = string | ArrayBuffer | Blob | Response;
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
) : Promise<Component>;
```

#### 1. Module Import

The `imports` parameter in `vue-sfc-component` enhances the module importing experience by allowing you to simplify the import process. You can use already imported modules or specify URLs for direct imports.

Here’s how you can use it:

```js 
import lodash from 'lodash'
import * as axios from 'axios';
defineSFC('App.vue', {
    files,
    imports: {
        lodash: {
            default: lodash
        },
        axios,
        moment: "https://esm.sh/moment"
    }
});
```

With this configuration, you can use imports in your SFCs like this:

```html
<script setup lang="ts">
import _ from 'lodash'
import moment from 'moment'
import axios, {isCancel, AxiosError} from 'axios'
console.log(_.camelCase('hello world'))
console.log(moment().format('MMMM Do YYYY, h:mm:ss a'))
axios('https://jsonplaceholder.typicode.com/todos/1')
    .then(console.log)
    .catch((error: AxiosError) => {
        if (isCancel(error)) {
            console.log('Request canceled', error.message)
        } else {
            console.log(error)
        }
    })
</script>
```

Alternatively, you can directly use a URL for importing within your SFC code:

```html
<script setup>
import moment from 'https://esm.sh/moment'
console.log(moment().format('MMMM Do YYYY, h:mm:ss a'))
</script>
```

Please note, if you choose to import modules via URLs, the component will need to download the dependencies each time it is compiled, which can slow down the loading speed of the component.

#### 2. Multi-File Support

##### 2.1. `files` and `getFile`

`vue-sfc-component` offers the flexibility to develop components using multiple files, supporting various file types such as `.vue`, `.js`, `.ts`, `.css`, and `.json`. This feature allows you to structure your component just like in a standard Vue project, providing a familiar and intuitive development experience.

Please note that using `.css` files will apply styles globally, which might inadvertently affect other components. It's recommended to use `scoped` styles to prevent such style contamination.

There are two approaches to utilize multi-file components:

```js
// Approach 1: Using the `files` parameter
defineSFC('App.vue', {
    files: {
        'App.vue': "xxx"
        // ... other files
    }
});
```

```js
// Approach 2: Using the `getFile` callback

defineSFC('App.vue', {
    async getFile(path) {
        const res = await fetch(path);
        return await res.text();
    }
});
```

These approaches can be mixed. The `files` object is checked first for the specified files, and if not found, the `getFile` callback is used to retrieve the file content.

###### Use of different forms of file content

The type of file content can be `string`, `ArrayBuffer`, `Blob`, `Response`, or `URL`.

- **`String`, `ArrayBuffer`, `Blob`, and `Response`**: These types are directly used as the content of your component files. 

- **URL**: For `vue`, `css`, `javascript`, `typescript` or `json`, the library will utilize `fetch` to retrieve the content from the specified URL. 

  ```js
  defineSFC('App.vue', {
      files: {
          'App.vue': new URL('http://example.com/path/to/your/App.vue')
          // ... other files  
      }
  });
  ```

  For other file types not listed above, the provided URL will be used directly. See more details in the [Other Files](#225-other-files) section.

##### 2.2 File Resolution

###### 2.2.1 Vue SFC

You can directly import Vue SFCs in your components. For instance:

```html
<script setup>
import Foo from './Foo.vue'
</script>
```

###### 2.2.2 js/ts

Imports and exports for JavaScript and TypeScript files follow the ECMAScript module (ESM) standard.

When the imported files are in `files`, you can omit the file extension. For example:

```html
<script setup>
import foo from './foo'
</script>
```

The resolution order is: original filename > `foo.ts` > `foo.js`.

However, when using the `getFile` approach, you must specify the file extension.

###### 2.2.3 CSS

To ensure CSS styles are properly processed and applied, explicit importation of CSS files is required. 

**Importing CSS in Script Tag**

You can import CSS files directly within the `<script setup>` tag. This approach applies the styles globally across your application.

Example:

```html
<script setup>
import './style.css'
</script>
```

**Scoped CSS Import**

For component-scoped styles, you should import CSS within a `<style scoped>` tag. Scoped styles ensure that CSS rules only apply to the current component, avoiding unwanted global side effects.

Examples:

```html
<style scoped>
@import './style.css';
/* or */
@import url('./style.css');
/* or */
@import './style.css' screen and (min-width: 500px);
</style>
```

**Importing External CSS**

You can also import CSS files hosted externally. However, when importing external CSS resources, you should do it within a `<style>` tag, as importing them in a `<script>` tag would treat them as JavaScript files.

Example:

```html
<style>
@import 'https://example.com/style.css';
</style>
```

###### 2.2.4 json

JSON files are imported as objects, allowing you to use JSON data directly within your SFC.

###### 2.2.5 Other files

Other file types are exported as strings representing the URL of the file.

The type of url depends on the type of file content you provide. If `string`, `ArrayBuffer`, `Blob`, or `Response` is passed, it will be a `Blob URL`. If a `URL` type is provided, it will be that specific `URL`.

For example:

```html
<script setup>
import a from './a.png' // a is a Blob URL
import b from './b.png' // b is new URL('./b.png', window.location.href).toString()
</script>

<template>
    <img :src="a">
    <img :src="b">
</template>
```

```js
defineSFC('App.vue', files, {
    async getFile(path) {
        if (path === './a.png') {
            return await fetch(path);
        } else if (path === './b.png') {
            return new URL(path, window.location.href);
        }
        throw new Error('File not found');
    }
});
```

#### 3. Rendering Styles

By default, `vue-sfc-component` automatically renders the component's styles into the `head` tag of the document. If you wish to customize the behavior of how styles are rendered, you can use the `renderStyles` parameter.

```js
defineSFC('App.vue', {
    files,
    renderStyles(styles) {
        // 'styles' is a string containing all the component's styles
        // You can decide how to render these styles, but remember to clear previous styles if necessary
    }
});
```
#### 4. Handling Compilation Errors

By default, compilation errors are logged to the console. If you prefer to handle errors in a custom way, you can use the `catch` parameter.

```js
defineSFC('App.vue', {
    files,
    catch(err) {
        // 'err' is an array containing errors, which can be either Error objects or strings
        // Custom error handling logic goes here
    }
});
```

#### 5. Overriding Files

If you have specific requirements that necessitate modifying file contents before compilation, you can achieve this using the `fileConvertRule` parameter.

```js
defineSFC('App.vue', {
    files,
    fileConvertRule(file) {
        console.log(file.filename); 
        console.log(file.content);
        console.log(file.language); // 'vue' | 'javascript' | 'typescript' | 'json' | 'css' | 'other'
        console.log(file.mimetype); // Only present when file.language is 'other'
        file.content = "xxx"; // Modify the file content
        file.language = 'vue'; // Treat as a Vue file
        // file.mime = 'text/plain'; // Set MIME type for 'other' language files
    }
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
