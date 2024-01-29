import { loadSFCModule } from '../src';
import { createApp, defineAsyncComponent } from 'vue'


const options = {
    files: [
        {
            filename: 'App.vue',
            content: `
<script setup>
import a from './a.png'
import b from './b.png'
</script>

<template>
    <img :src="a">
    <img :src="b">
</template>`
        },
    ],
    async getFile(path) {
        console.log(path)
        return await fetch("/2.png"); // Response
    }
}

const app = createApp({
    components: {
        'sfc-component': defineAsyncComponent(() => loadSFCModule('App.vue', options)),
    },
    template: `<sfc-component></sfc-component>`
});
  
app.mount('#app')