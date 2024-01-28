
import { loadSFCModule, File } from '../src';
import { createApp, defineAsyncComponent } from 'vue'

const files = [
    {
        filename: 'main.md',
        // filename: 'App.vue',
        content: `
    <template>
        <div>
            <h1>{{ msg }}</h1>
            <button @click="reverse">Reverse</button>
        </div>
    </template>

    <script setup lang="ts">
    import { text } from './files/a.ts'
    import { ref, Ref, inject  } from 'vue'

    const msg: Ref<string> = ref(text())
    const reverse = () => {
        msg.value = msg.value.split('').reverse().join('')
    }
    </script>

    <style scoped>
    h1 {
        color: red;
    }
    </style>
    `
    },
    {
        filename: 'files/a.ts',
        content: `
        export function text() {
            import('../b').then(({ text2 }) => {
                console.log(text2())
            })
            return "Hello World!"
        }
        `
    },
    {
        filename: 'b.ts',
        content: `export function text2() {
            return "Real text!!!"
        }`
    }
]

function loadModule() {
    return loadSFCModule('main.md', {
        files,
        fileConvertRule(file: File) {
            if (file.filename.endsWith('.md')) {
                file.language = 'vue'
            }
        }
    })
}


const app = createApp({
    components: {
      'my-component': defineAsyncComponent(loadModule),
    },
    template: `
    <my-component></my-component>
    `
  });
  

app.provide('test', () => {
    console.log('test')
})

app.mount('#app')