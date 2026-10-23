<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const navItems = [
  { view: 'home', label: '首页' },
  { view: 'library', label: '项目库' },
  { view: 'input', label: '输入我的项目' }
]

function go(view: string) {
  router.push('/' + view)
}

const isOn = (view: string) => route.name === view

const chipText = computed(() => {
  const pg = sessionStore.progress
  if (!pg || !sessionStore.session) return ''
  const cur = pg.done + (sessionStore.session.finished ? 0 : 1)
  return 'SESSION ACTIVE · 第 ' + cur + '/' + pg.total + ' 问'
})
</script>

<template>
  <header class="topbar">
    <div class="wrap">
      <div class="brand" @click="go('home')">
        <div class="logo">AJ</div>
        <div>
          <h1>AI刁钻评委</h1>
          <small>AI PICKY JUDGE · 压力测试智能体</small>
        </div>
      </div>
      <nav>
        <button
          v-for="n in navItems"
          :key="n.view"
          class="nav-btn"
          :class="{ on: isOn(n.view) }"
          @click="go(n.view)"
        >
          {{ n.label }}
        </button>
        <button
          v-if="sessionStore.isActive"
          class="nav-btn"
          :class="{ on: isOn('review') }"
          @click="go('review')"
        >
          质询中
        </button>
        <button v-if="sessionStore.isActive" class="nav-btn" @click="go('report')">
          结束并出报告
        </button>
        <template v-if="sessionStore.isActive">
          <span class="chip"><span class="dot"></span>{{ chipText }}</span>
          <span class="chip warn"><span class="dot"></span>模拟评审 · 非官方评分</span>
        </template>
        <span v-else class="chip"><span class="dot"></span>AI REVIEW ENGINE READY</span>
      </nav>
    </div>
  </header>
</template>
