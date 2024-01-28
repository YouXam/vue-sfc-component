import { loadSFCModule } from '../src';
import { createApp, defineAsyncComponent } from 'vue'

import * as _ from 'lodash'

const files = [
    {
        filename: 'App.vue',
        content: `
<template>
    <div>
        <h1>Hello World</h1>
        <Button />
        <button>Other Button</button>
    </div>
</template>

<script setup>
import Button from './Button.vue'
</script>

<style scoped>
button {
    color: red;
}
</style>
`
    },
    {
        filename: 'Button.vue',
        content: `
<template>
    <div>
        <button @click="onClick">
            {{ text }}
        </button>
    </div>
</template>

<script setup>
import { ref } from 'vue'
const text = ref('Hello World')
const onClick = () => {
    text.value = text.value.split('').reverse().join('')
}
</script>

<style scoped>
button {
    color: yellow;
}
</style>
`
    },
]

const app = createApp({
    components: {
        'sfc-component': defineAsyncComponent(() => loadSFCModule('App.vue', {
            files,
            imports: {
                'lodash': _,
                'moment': "htts://esm.sh/moment"
            },
            fileConvertRule(file) {
                console.log(file.filename)
                console.log(file.content)
                console.log(file.language) // 'vue' | 'javascript' | 'typescript' | 'json' | 'css' | 'other'
                file.content = "xxx"
                file.language = 'vue' // 当做 vue 处理，这里不能赋值为 'other'
            }
        })),
    },
    template: `<sfc-component></sfc-component>`
});
  
app.mount('#app')