<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { chatAgentReply, type ChatMsg } from '@/services/chatAgent'

const sessionStore = useSessionStore()

const open = ref(false)
const messages = ref<ChatMsg[]>([])
const input = ref('')
const busy = ref(false)
const streaming = ref('')
const copiedIndex = ref(-1)
const listRef = ref<HTMLDivElement | null>(null)

const WELCOME = '你好，我是 AI 刁钻评委助手。可以问我关于比赛评审、答辩准备、项目改进的问题。'

async function copyRaw(text: string, index?: number) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 旧浏览器回退：隐藏 textarea + execCommand */
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignore */
    }
    ta.remove()
  }
  if (index !== undefined) {
    copiedIndex.value = index
    setTimeout(() => {
      if (copiedIndex.value === index) copiedIndex.value = -1
    }, 2000)
  }
}

function copyMsg(content: string, index: number) {
  copyRaw(content, index)
}

function copyAll() {
  const text = messages.value
    .map((m) => (m.role === 'user' ? '我：' : 'AI：') + m.content)
    .join('\n\n')
  copyRaw(text)
}

function scrollBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

function toggle() {
  open.value = !open.value
  if (open.value && !messages.value.length) {
    messages.value.push({ role: 'assistant', content: WELCOME })
  }
  scrollBottom()
}

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  busy.value = true
  streaming.value = ''
  scrollBottom()

  const reply = await chatAgentReply(messages.value, sessionStore.session?.project || null, (t) => {
    streaming.value += t
    scrollBottom()
  })

  busy.value = false
  if (reply) {
    messages.value.push({ role: 'assistant', content: reply })
  } else {
    messages.value.push({
      role: 'assistant',
      content: '（AI 服务未启用或调用失败。请在「设置」页配置 API Key，或检查网络后重试。）'
    })
  }
  streaming.value = ''
  scrollBottom()
}

function clearChat() {
  messages.value = []
  streaming.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <!-- 悬浮按钮 -->
  <button class="ai-chat-fab" :class="{ on: open }" @click="toggle" title="AI 对话助手">
    <span v-if="!open">💬</span>
    <span v-else>✕</span>
  </button>

  <!-- 对话面板 -->
  <div v-if="open" class="ai-chat-panel fade-in">
    <div class="ai-chat-head">
      <div>
        <div class="t">AI 对话助手</div>
        <div class="s">智能体模式 · 可问评审/答辩/项目问题</div>
      </div>
      <div class="btn-row" style="gap: 6px">
        <button class="btn gray sm" title="复制全部对话" @click="copyAll()">复制对话</button>
        <button class="btn gray sm" @click="clearChat">清空</button>
        <button class="btn gray sm" @click="toggle">收起</button>
      </div>
    </div>

    <div ref="listRef" class="ai-chat-body">
      <div v-for="(m, i) in messages" :key="i" class="chat-msg" :class="m.role">
        <button
          v-if="m.role === 'assistant'"
          class="chat-copy"
          :class="{ done: copiedIndex === i }"
          :title="copiedIndex === i ? '已复制' : '复制这条回复'"
          @click="copyMsg(m.content, i)"
        >
          {{ copiedIndex === i ? '✓' : '⧉' }}
        </button>
        <div class="bubble">{{ m.content }}</div>
      </div>
      <div v-if="busy" class="chat-msg assistant">
        <div class="bubble streaming">{{ streaming || '正在思考…' }}</div>
      </div>
    </div>

    <div class="ai-chat-foot">
      <textarea
        v-model="input"
        rows="2"
        placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
        @keydown="onKeydown"
      ></textarea>
      <div class="btn-row" style="margin-top: 8px">
        <button class="btn primary sm" :disabled="busy || !input.trim()" @click="send">
          {{ busy ? '生成中…' : '发送' }}
        </button>
        <span class="dim" style="font-size: 11.5px">对话自动检索赛题知识库，回答有依据</span>
      </div>
    </div>
  </div>
</template>
