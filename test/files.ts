export const files = {
    'md/App.vue': `
<template>
    <div>
        <h1>{{ msg }}</h1>
        <button @click="msg = msg.split('').reverse().join('')">
            Reverse
        </button>

        <img :src="Home" style="max-height: 100px; display: block;"/>

        <pre><code>{{ JSON.stringify(config, null, 2) }}</code></pre>
    </div>
</template>

<script setup lang="ts">
import './main.css'
import { ref } from 'vue'

import moment from 'https://esm.sh/moment'
import lodash from 'https://esm.sh/lodash'

console.log(moment, lodash)
const msg = ref("Hello World!")
const Home = ref('')
import('./' + 'home.svg').then(({ default: src }) => Home.value = src)
import('vue').then(vue => console.log(vue.ref))
</script>

<style scoped>
h1 {
    color: red;
}
</style>`
}
