# vue-sfc-component

[English](./README.md) | 简体中文

## 简介

`vue-sfc-component` 是一个专为在浏览器中直接编译和挂载 Vue 单文件组件（SFC）而设计的库。

## 特性

1. **前端编译**：所有的编译都在浏览器中完成，无需构建步骤。

2. **TypeScript**：`vue-sfc-component` 提供了有限的 TypeScript 支持(不检查类型，仅删除类型注释)。只需在 `.vue` 文件中使用 `<script lang="ts">` 标签或者导入 `.ts` 文件。

3. **setup 特性**：支持 `<script setup>` 语法糖。

4. **以多种方式加载依赖**：可以让编译的组件使用当前项目中的依赖，也可以使用 URL 直接加载依赖。

5. **Scoped CSS 支持**：你可以使用 Scoped CSS，隔离组件样式，避免泄漏到全局范围。

6. **与现有 Vue 项目的无缝集成**：`vue-sfc-component` 可以将一系列文件编译成一个 Vue 组件，并使用 `defineAsyncComponent` 在现有的 Vue 项目中使用。

## 安装

使用 npm 安装 `vue-sfc-component`:

```bash
npm install vue-sfc-component
```

或者使用 yarn:

```bash
yarn add vue-sfc-component
```

## 使用

### 示例

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

### 高级用法

`defineSFC` 是 `vue-sfc-component` 的主要函数。它接收一个 `*.vue` 文件名，然后返回一个 Vue 组件。这个函数还接受一个可选的配置对象，允许你自定义组件加载过程。

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

#### 1. 导入依赖

`vue-sfc-component` 中的 `imports` 参数用于指定编译成的组件使用的依赖，可以使用现有的模块，也可以使用 URL 加载远程模块。

```js 
import * as _ from 'lodash'

defineSFC('App.vue', {
    files,
    imports: {
        'lodash': _,
        'moment': "https://esm.sh/moment"
    }
});
```

然后在 SFC 中使用依赖：

```html
<script setup>
import _ from 'lodash'
import moment from 'moment'
console.log(_.VERSION)
console.log(moment().format('MMMM Do YYYY, h:mm:ss a'))
</script>
```

也可以直接在 SFC 中使用 URL 导入：

```html
<script setup>
import moment from 'https://esm.sh/moment'
console.log(moment().format('MMMM Do YYYY, h:mm:ss a'))
</script>
```

请注意，如果您选择通过 URL 导入模块，组件在每次编译时都需要下载依赖项，这可能会降低组件的加载速度。

#### 2. 多文件支持

##### 2.1. `files` 和 `getFile`

`vue-sfc-component` 支持各种文件类型：`.vue`、`.js`、`.ts`、`.css` 和 `.json`。您可以把 `vite` 或者 `webpack` 项目中的文件直接传递给 `defineSFC` 函数，`vue-sfc-component` 会自动处理它们。

请注意，使用 `.css` 文件将全局应用样式，即整个页面。可以使用 `scoped` 将样式限制在组件内部。

有两种方式可以传入文件：

```js
// 方式 1: 使用 files 参数
defineSFC('App.vue', {
    files: {
        'App.vue': "xxx"
        // ... 其他文件
    }
});
```

```js
// 方式 2: 使用 getFile 函数
defineSFC('App.vue', {
    async getFile(path) {
        const res = await fetch(path);
        return await res.text();
    }
});
```

这些方法可以混合使用。首先检查 `files` 对象中是否有指定的文件，如果没有找到，则使用 `getFile` 函数获取文件内容。

###### 使用不同形式的文件内容

文件内容的类型可以是 `string`、`ArrayBuffer`、`Blob`、`Response` 或 `URL`。

- **`String`, `ArrayBuffer`, `Blob`, 和 `Response`**: 这些类型可以直接用作你的组件文件的内容。

- **URL**: 对于 `vue`、`css`、`javascript`、`typescript` 或 `json`，将使用 `fetch` 从指定的 URL 检索内容。

  ```js
  defineSFC('App.vue', {
      files: {
          'App.vue': new URL('http://example.com/path/to/your/App.vue')
          // ... 其他文件
      }
  });
  ```

  对于上面未列出的其他文件类型，将直接使用提供的 URL。更多详情请见[其他文件](#225-其他文件)章节。


##### 2.2 文件解析

###### 2.2.1 Vue SFC

你可以直接导入 `.vue` 文件。

```html
<script setup>
import Foo from './Foo.vue'
</script>
```

###### 2.2.2 js/ts

JavaScript 和 TypeScript 文件的导入和导出遵循 ECMAScript 模块（ESM）标准。

当导入的文件在 `files` 中时，你可以省略文件扩展名。例如：

```html
<script setup>
import foo from './foo'
</script>
```

解析顺序是：原始文件名 > `foo.ts` > `foo.js`。

然而，当使用 `getFile` 方法时，你必须指定文件扩展名。


###### 2.2.3 CSS

为了确保 CSS 样式被正确处理和应用，需要显式地导入 CSS 文件。

**在 script 中导入 CSS**

这种方法全局应用样式。

```html
<script setup>
import './style.css'
</script>
```

这种方法直接明了，适用于你想要在整个应用程序中应用的全局样式。

**Scoped CSS Import**

如果想要导入的样式只应用于当前组件，可以在 `<style scoped>` 中导入样式。


```html
<style scoped>
@import './style.css';
/* 或者 */
@import url('./style.css');
/* 或者 */
@import './style.css' screen and (min-width: 500px);
</style>
```

**导入外部 CSS**

你只能在 `<style>` 中导入远程 CSS，因为在 `<script>` 标签中导入远程 CSS 文件会被当作 esm 处理。

```html
<style>
@import 'https://example.com/style.css';
</style>
```

###### 2.2.4 JSON

JSON 文件会被解析成 JavaScript 对象。

###### 2.2.5 其他文件

其他文件类型会被导出为文件 URL 的字符串。

URL 的类型取决于你提供的文件内容类型。如果是 `string`、`ArrayBuffer`、`Blob` 或 `Response`，它将是一个 `Blob URL`。如果是 `URL` 类型，则将是该 `URL`。

```html
<script setup>
import a from './a.png' // a 是 Blob URL
import b from './b.png' // b 是 new URL('./b.png', window.location.href).toString()
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

#### 3. 样式渲染

默认情况下，样式被插入到 `head` 中。你也可以使用 `renderStyles` 函数自定义样式的渲染方式。

```js
defineSFC('App.vue', {
    files,
    renderStyles(styles) {
        // 'styles' 是一个字符串，包含所有的样式
        // 你可能需要清除之前的样式
    }
});
```

#### 4. 处理编译错误

当 js/ts/vue/css/json 文件编译失败时，`vue-sfc-component` 会把错误信息传递给 `catch` 函数。默认情况下，该函数会把错误信息打印到控制台。

```js
defineSFC('App.vue', {
    files,
    catch(err) {
        // 'err' 类型是 Array<string | Error>
    }
});
```


#### 5. 文件转换

如果你想在编译前修改文件内容和类型，可以使用 `fileConvertRule` 参数来实现。

```js
defineSFC('App.vue', {
    files,
    fileConvertRule(file) {
        console.log(file.filename); 
        console.log(file.content);
        console.log(file.language); // 'vue' | 'javascript' | 'typescript' | 'json' | 'css' | 'other'
        console.log(file.mimetype); // 仅当 language 为 'other' 时存在
        file.content = "xxx"; // 修改文件内容
        file.language = 'vue'; // 把当前文件当做 vue 文件编译，处理
        // file.mime = 'text/plain'; // 如果文件类型被设置成 'other'，你可以修改 mimetype
    }
});
```

## License

[MIT](LICENSE)
