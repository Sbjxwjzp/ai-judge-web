<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { REVIEW_DIMS } from '@/data/core'

const sessionStore = useSessionStore()

const sorted = computed(() => {
  const s = sessionStore.session
  if (!s) return []
  const order: Record<string, number> = { h: 0, m: 1, l: 2 }
  return s.risks
    .slice()
    .sort((a, b) => order[a.sev] - order[b.sev] || b.count - a.count)
    .slice(0, 12)
})

const crit = computed(() => {
  const s = sessionStore.session
  return s ? s.risks.filter((r) => r.sev === 'h').length : 0
})
const mid = computed(() => {
  const s = sessionStore.session
  return s ? s.risks.filter((r) => r.sev === 'm').length : 0
})
</script>

<template>
  <div class="card">
    <div class="sec-title">项目风险（实时累计）</div>
    <div class="counter" style="margin-bottom: 12px">
      <div class="c red">
        <div class="n">{{ crit }}</div>
        <div class="l">高优先级</div>
      </div>
      <div class="c orange">
        <div class="n">{{ mid }}</div>
        <div class="l">待补充</div>
      </div>
      <div class="c cyan">
        <div class="n">{{ sessionStore.session?.risks.length ?? 0 }}</div>
        <div class="l">问题总数</div>
      </div>
    </div>
    <template v-if="sorted.length">
      <div v-for="r in sorted" :key="r.key" class="risk">
        <div class="rhead">
          <span class="sev" :class="r.sev"></span>
          <span class="rname">{{ r.title }}</span>
        </div>
        <div class="rbody">
          <span class="tag" :class="r.cls || 'blue'" style="margin-right: 6px">{{ r.name }}</span>
          {{ r.topic }}{{ r.count > 1 ? ' · 出现 ' + r.count + ' 次' : '' }}
        </div>
      </div>
    </template>
    <div v-else class="dim" style="font-size: 13px">
      还没有风险记录，回答第一个问题后这里会实时更新。
    </div>
  </div>

  <div class="card">
    <div class="sec-title">模拟评审维度</div>
    <div v-for="d in REVIEW_DIMS" :key="d" class="dimrow">
      <div class="dtop">
        <span class="n">{{ d }}</span>
        <span class="s">{{ sessionStore.session?.dims[d]?.score ?? 62 }}</span>
      </div>
      <div class="bar">
        <i
          :class="(sessionStore.session?.dims[d]?.score ?? 62) < 55 ? 'orange' : ''"
          :style="{ width: (sessionStore.session?.dims[d]?.score ?? 62) + '%' }"
        ></i>
      </div>
    </div>
    <div class="note" style="margin-top: 12px; font-size: 12.6px">
      这些分数是<b>模拟评审维度</b>的证据充分度，用来定位薄弱环节，<b>不是比赛官方评分</b>。
    </div>
  </div>
</template>
