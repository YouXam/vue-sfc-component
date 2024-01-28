# vue-sfc-component

## Introduction

`vue-sfc-component` is a library designed for compiling and mounting Vue Single File Components (SFCs) directly in the browser. It simplifies the process of rendering Vue components from various sources, making it ideal for quick prototyping and educational purposes.

## Features

1. **Front-End Compilation**: This library allows you to compile SFCs into components directly in the browser. This feature is particularly useful for on-the-fly component rendering and simplifies the development process by eliminating the need for server-side compilation.

2. **TypeScript and Setup Feature Support**: `vue-sfc-component` offering comprehensive support for TypeScript. To utilize TypeScript within your Vue SFCs, simply use the `<script lang="ts">` tag in your `.vue` files. Also, the library supports the `<script setup>` feature, which allows you to use the Composition API without the need for a build step.

3. **Load Libraries from URLs**: Enhance your components by importing libraries directly from URLs. This feature offers the flexibility to include external scripts or styles without the hassle of managing them within your project structure.

4. **Scoped CSS Support**: With Scoped CSS, you can ensure that your component styles are isolated and do not leak into the global scope. This is crucial for maintaining a clean and conflict-free styling environment.

5. **Seamless Integration with Existing Vue Projects**: `vue-sfc-component` is designed to integrate smoothly with your existing Vue projects. Its intuitive API and flexible configuration make it easy to embed within your current Vue setup, enhancing your project with minimal effort.

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
import { loadSFCModule } from 'vue-sfc-component';

const files = [
    {
        filename: 'App.vue',
        content: `
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
]

const app = createApp({
    components: {
      'sfc-component': defineAsyncComponent(() => loadSFCModule('App.vue', { files })),
    },
    template: `<sfc-component></sfc-component>`
});
  
app.mount('#app')
```

### Advanced Usage

`loadSFCModule` is the main function of `vue-sfc-component`. It takes a file path and returns a Promise that resolves to a Vue component. The function also accepts an optional configuration object that allows you to customize the component loading process.

```ts
export async function loadSFCModule(
    mainfile: string,
    options?: {
        imports?: Record<string, any>;
        files?: Array<{ filename: string, content: string }>;
        getFile?: (path: string) => MaybePromise<string>;
        renderStyles?: (css: string) => MaybePromise<string>;
        catch?: (errors: Array<string | Error>) => MaybePromise<void>;
        fileConvertRule?: (file: File) => MaybePromise<void>;
    }
) : Promise<Component>
```

#### 1. Module Import

The `imports` parameter in `vue-sfc-component` enhances the module importing experience by allowing you to simplify the import process. You can use already imported modules or specify URLs for direct imports.

Here’s how you can use it:

```js 
import * as _ from 'lodash'
import { loadSFCModule } from 'vue-sfc-component';

loadSFCModule('App.vue', {
    files,
    imports: {
        'lodash': _,
        'moment': "https://esm.sh/moment"
    }
});
```

With this configuration, you can use imports in your SFCs like this:

```html
<script setup>
import _ from 'lodash'
import moment from 'moment'
console.log(_.VERSION)
console.log(moment().format('MMMM Do YYYY, h:mm:ss a'))
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

It's also important to remember that if a URL is specified in the `imports` but not used within the SFC, the dependency will not be downloaded. This feature is particularly useful for optimizing load times and avoiding unnecessary downloads.

#### 2. Multi-File Support

`vue-sfc-component` offers the flexibility to develop components using multiple files, supporting various file types such as `.vue`, `.js`, `.ts`, `.css`, and `.json`. This feature allows you to structure your component just like in a standard Vue project, providing a familiar and intuitive development experience.

Please note that using `.css` files will apply styles globally, which might inadvertently affect other components. It's recommended to use `scoped` styles to prevent such style contamination.

There are two approaches to utilize multi-file components:

```js
// Approach 1: Using the `files` parameter
loadSFCModule('App.vue', {
    files: [
        {
            filename: 'App.vue',
            content: `...`
        }
        // ... other files
    ]
});
```

```js
// Approach 2: Using the `getFile` callback

loadSFCModule('App.vue', {
    async getFile(path) {
        const res = await fetch(path);
        return await res.text();
    }
});
```

These approaches can be mixed. The `files` array is checked first for the specified files, and if not found, the `getFile` callback is used to retrieve the file content.

When using the `files` parameter with `.ts` or `.js` files, you can omit the file extension during imports. For example:

```html
<script setup>
import foo from './foo'
</script>
```

The resolution order is: original filename > `foo.ts` > `foo.js`.

However, when using the `getFile` approach, you must specify the file extension. This ensures that the correct file type is loaded and processed as expected.


#### 3. Rendering Styles

By default, `vue-sfc-component` automatically renders the component's styles into the `head` tag of the document. If you wish to customize the behavior of how styles are rendered, you can use the `renderStyles` parameter.

```js
loadSFCModule('App.vue', {
    files,
    renderStyles(styles) {
        // 'styles' is a string containing all the component's styles
        // You can decide how to render these styles, but remember to clear previous styles if necessary
    }
});
```

This function gives you full control over the style rendering process, allowing for a more tailored integration into your application.

#### 4. Handling Compilation Errors

By default, compilation errors are logged to the console. If you prefer to handle errors in a custom way, you can use the `catch` parameter.

```js
loadSFCModule('App.vue', {
    files,
    catch(err) {
        // 'err' is an array containing errors, which can be either Error objects or strings
        // Custom error handling logic goes here
    }
});
```

This feature is particularly useful for providing a better developer experience or integrating with custom logging systems.

#### 5. Overriding Files

If you have specific requirements that necessitate modifying file contents before compilation, you can achieve this using the `fileConvertRule` parameter.

```js
loadSFCModule('App.vue', {
    files,
    fileConvertRule(file) {
        console.log(file.filename); // Log the filename
        console.log(file.content); // Log the current content
        console.log(file.language); // 'vue' | 'javascript' | 'typescript' | 'json' | 'css' | 'other'
        file.content = "xxx"; // Modify the file content
        file.language = 'vue'; // Treat as a Vue file, 'other' is not a valid assignment here
    }
});
```

This functionality provides a way to programmatically alter the contents of a file before it's processed by `vue-sfc-component`, offering flexibility for advanced use-cases like pre-processing or conditional modifications.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
