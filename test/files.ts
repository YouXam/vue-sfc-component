import lodash from 'lodash'
import * as axios from 'axios';
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

<script setup lang="ts">
import './main.css'
import { ref } from 'vue'
import _ from 'lodash'
console.log(_.camelCase('hello world'))
import axios, {isCancel, AxiosError} from 'axios'
axios('https://jsonplaceholder.typicode.com/todos/1')
    .then(console.log)
    .catch((error: AxiosError) => {
        if (isCancel(error)) {
            console.log('Request canceled', error.message)
        } else {
            console.log(error)
        }
    })
const msg = ref("Hello World!")
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

export default {
    files,
    imports: {
        lodash: {
            default: lodash
        },
        axios,
    }
}
