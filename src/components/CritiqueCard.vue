<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { Round } from '@/types/engine'

const props = defineProps<{
  round: Round
}>()

const sessionStore = useSessionStore()

const c = computed(() => props.round.critique)

const verdictTag = computed(() => {
  if (c.value.criticalCount) return 'red'
  if (c.value.midCount) return 'orange'
  return 'green'
})

/** AI 深度锐评：定稿后打字机逐字播放（不显示 LLM 原始 JSON 流） */
const displayText = ref('')
let typeTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => c.value.aiSummary,
  (val) => {
    if (typeTimer) clearInterval(typeTimer)
    if (!val) {
      displayText.value = ''
      return
    }
    displayText.value = ''
    let i = 0
    typeTimer = setInterval(() => {
      i += 2
      displayText.value = val.slice(0, i)
      if (i >= val.length) {
        if (typeTimer) clearInterval(typeTimer)
        typeTimer = null
      }
    }, 16)
  },
  { immediate: true }
)
</script>

<template>
  <div class="critique fade-in">
    <div class="cbar">
      <span class="t">AI 锐评</span>
      <span :class="round.isMock ? 'tag violet' : 'tag green'">
        {{ round.isMock ? '模拟回答' : '手动回答' }}
      </span>
      <span class="tag" :class="verdictTag">{{ c.verdict }}</span>
      <span class="tag">完整度 {{ c.completeness }}%</span>
    </div>

    <!-- LLM 深度锐评（生成中显示占位，定稿后打字机播放；未启用/失败时此区不出现） -->
    <div v-if="c.aiSummary || sessionStore.aiBusy" class="ai-note">
      <div class="ai-head">
        <span class="t">AI 深度锐评</span>
        <span v-if="sessionStore.aiBusy" class="tag blue">生成中…</span>
      </div>
      <p class="ai-text">
        {{ sessionStore.aiBusy ? 'AI 评审官正在对照赛题评分标准组织语言…' : displayText }}
      </p>
      <template v-if="!sessionStore.aiBusy && c.aiAsks && c.aiAsks.length">
        <div class="k" style="margin: 10px 0 4px">评委最可能继续追问</div>
        <ul>
          <li v-for="(a, idx) in c.aiAsks" :key="idx">{{ a }}</li>
        </ul>
      </template>
    </div>

    <div class="issue">
      <div class="ibody" style="color: #bdcfe3">
        本轮问题（{{ round.q.topic }}）：{{ round.q.text }}
      </div>
      <div class="iblock">
        <div class="k">
          你的回答{{ round.isMock ? '（模拟回答 · 系统生成，非真实答辩内容）' : '' }}
        </div>
        <div class="ibody">{{ round.answer }}</div>
      </div>
    </div>

    <div class="issue">
      <div class="ibody" style="color: #e6edf3"><b>分析结论：</b>{{ c.summary }}</div>
    </div>

    <template v-if="c.issues.length">
      <div v-for="i in c.issues" :key="i.title" class="issue">
        <div class="ihead">
          <span class="tag" :class="i.cls || 'blue'">{{ i.name }}</span>
          <span class="sev" :class="i.sev"></span>
          <span class="ititle">{{ i.title }}</span>
        </div>
        <div class="ibody">{{ i.detail }}</div>
        <div v-if="i.why" class="iblock">
          <div class="k">为什么这是一个问题</div>
          <div class="ibody">{{ i.why }}</div>
        </div>
        <div v-if="i.asks && i.asks.length" class="iblock">
          <div class="k">评委可能继续追问</div>
          <ul>
            <li v-for="(a, idx) in i.asks" :key="idx">{{ a }}</li>
          </ul>
        </div>
      </div>
    </template>
    <div v-else class="issue">
      <div class="ititle">本轮没有发现明显缺口</div>
      <div class="ibody">回答覆盖了本问要求的证据点，可以直接进入更深的层次。</div>
    </div>

    <div v-if="c.suggestions && c.suggestions.length" class="issue">
      <div class="iblock">
        <div class="k">建议补充的材料</div>
        <div class="suggest-chips">
          <span v-for="s in c.suggestions" :key="s" class="c">+ {{ s }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
