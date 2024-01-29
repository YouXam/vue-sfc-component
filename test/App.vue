<template>
  <sfc></sfc>
</template>

<script setup>
import { defineSFC } from '../src';
import { defineAsyncComponent } from 'vue'
import options from './files';
const sfc = defineAsyncComponent(() => defineSFC('App.vue', options))

</script>
