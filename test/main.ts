import { createApp, defineAsyncComponent } from 'vue'
import { defineSFC } from '../src';
import options from './files';
createApp(defineAsyncComponent(() => defineSFC('App.vue', options))).mount('#app')