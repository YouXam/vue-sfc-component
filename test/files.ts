export const files = {
    'App.vue': `
<template>
    <div>
        <h1>{{ msg }}</h1>
        <button @click="msg = msg.split('').reverse().join('')">
            Reverse
        </button>

        <img :src="Home" style="max-height: 100px; display: block;"/>
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
import('./home.svg').then(({ default: src }) => Home.value = src)
</script>

<style scoped>
h1 {
    color: red;
}
</style>`,
    'main.css': `
@import url('./files/part.css') screen and (min-width: 500px);
h1 {
    text-decoration: underline;
}`,
    'files/part.css': `
h1 {
    text-align: center;
}`
}
