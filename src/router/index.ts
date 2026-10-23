import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/library', name: 'library', component: () => import('@/views/LibraryView.vue') },
    { path: '/input', name: 'input', component: () => import('@/views/InputView.vue') },
    { path: '/review', name: 'review', component: () => import('@/views/ReviewView.vue') },
    { path: '/report', name: 'report', component: () => import('@/views/ReportView.vue') }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export { router }
