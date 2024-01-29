<template>
  <div>
    <div class="sfc">
      <sfc></sfc>
    </div>
  </div>
</template>

<script setup>
import { defineSFC } from '../src';
import { defineAsyncComponent } from 'vue'
import options from './files';
const sfc = defineAsyncComponent(() => defineSFC('App.vue', options))

</script>

<style scoped>
:root {
  --color: red;
}
.sfc {
  border: 1px solid black;
  padding: 5px;
}
</style>
