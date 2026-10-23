<script setup lang="ts">
import { onMounted } from 'vue'
import TopBar from '@/components/TopBar.vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

onMounted(() => {
  /* 刷新页面后恢复未完成的质询会话 */
  sessionStore.loadPersisted()
})
</script>

<template>
  <TopBar />
  <RouterView />
  <footer>
    AI刁钻评委 · 面向大学生创新创业项目的 AI 智能评审与压力测试智能体 ·
    模拟评审工具，不代表任何比赛的官方评审或官方评分
  </footer>
  <div v-if="sessionStore.toast" class="toast show">{{ sessionStore.toast }}</div>
</template>
