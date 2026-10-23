<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { mockOf } from '@/engine'

const sessionStore = useSessionStore()
const inputRef = ref<HTMLTextAreaElement | null>(null)

async function submitManual() {
  await sessionStore.answer(sessionStore.draft, false)
}

async function submitMock() {
  const q = sessionStore.currentQuestion
  const p = sessionStore.session?.project || null
  if (!q) return
  const text = mockOf(q, p)
  if (!text) return
  await sessionStore.answer(text, true)
}

function clearDraft() {
  sessionStore.draft = ''
}

function focusInput() {
  inputRef.value?.focus()
}
</script>

<template>
  <div class="card answer-box">
    <div class="sec-title">我的回答</div>
    <div class="btn-row" style="margin-bottom: 12px">
      <button class="btn primary" @click="focusInput">手动回答</button>
      <button class="btn warn" @click="submitMock">模拟回答（系统生成 · 非真实答辩内容）</button>
      <span class="dim" style="font-size: 12.6px">手动回答用于正式体验，模拟回答用于快速演示</span>
    </div>
    <textarea
      ref="inputRef"
      v-model="sessionStore.draft"
      placeholder="用自己的话回答上面的问题。答不上来的部分可以直接说「这一点还没有做」，AI 会把它记为缺口。"
    ></textarea>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn primary" :disabled="sessionStore.pending" @click="submitManual">
        提交回答并让 AI 分析
      </button>
      <button class="btn gray" :disabled="sessionStore.pending" @click="clearDraft">清空</button>
    </div>
  </div>
</template>
