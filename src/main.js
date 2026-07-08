import { createApp } from 'vue'
import { Quasar, Notify, Dialog, Loading } from 'quasar'
import quasarLang from 'quasar/lang/en-US'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import './css/app.scss'
import App from './App.vue'
import router from './router/index'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const app = createApp(App)
const pinia = createPinia()

app.use(Quasar, {
  plugins: { Notify, Dialog, Loading },
  lang: quasarLang,
  config: {
    notify: { position: 'top-right', timeout: 3000 },
    dark: 'auto'
  }
})
app.use(pinia)
app.use(router)
app.use(VueQueryPlugin)
app.component('VChart', VChart)
app.mount('#q-app')
