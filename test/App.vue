<template>
    <h1>Other</h1>
    <input type="checkbox" v-model="show">
    <sfc v-if="show"/>
</template>

<script setup>
import { defineSFC } from '../src';
import { defineAsyncComponent, ref } from 'vue';
import options from './files';

const show = ref(false);
const sfc = defineAsyncComponent(() => defineSFC('App.vue', options))
</script>