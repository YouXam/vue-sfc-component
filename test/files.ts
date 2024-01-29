

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

export default {
    files,
    async getFile(path) {
        console.log(path)
        return await fetch("/2.png"); // Response
    }
}
