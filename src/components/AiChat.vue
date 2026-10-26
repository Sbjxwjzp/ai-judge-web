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
const attachments = ref<{ id: number; dataUrl: string }[]>([])
let attachSeq = 1
const listRef = ref<HTMLDivElement | null>(null)

const WELCOME = '你好，我是 AI 刁钻评委助手。可以问我关于比赛评审、答辩准备、项目改进的问题。'

/** 粘贴图片：压缩到 1024px / JPEG 0.85，防止消息过大 */
function compressImage(file: File, maxSize = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, maxSize / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(String(reader.result))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('图片解析失败'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        if (attachments.value.length >= 4) {
          return
        }
        compressImage(file)
          .then((dataUrl) => {
            attachments.value.push({ id: attachSeq++, dataUrl })
            scrollBottom()
          })
          .catch(() => {
            /* 图片处理失败则忽略 */
          })
      }
      e.preventDefault()
      break
    }
  }
}

function removeAttachment(id: number) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

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
  if ((!text && !attachments.value.length) || busy.value) return
  const withImages = attachments.value.map((a) => a.dataUrl)
  messages.value.push({ role: 'user', content: text || '（发送了一张图片）', images: withImages })
  attachments.value = []
  input.value = ''
  busy.value = true
  streaming.value = ''
  scrollBottom()

  const res = await chatAgentReply(messages.value, sessionStore.session?.project || null, (t) => {
    streaming.value += t
    scrollBottom()
  })

  busy.value = false
  if (res.text) {
    messages.value.push({ role: 'assistant', content: res.text })
  } else if (res.visionWarn) {
    messages.value.push({ role: 'assistant', content: res.visionWarn })
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
      <!-- 图片附件预览 -->
      <div v-if="attachments.length" class="attach-row">
        <div v-for="a in attachments" :key="a.id" class="attach-item">
          <img :src="a.dataUrl" alt="图片附件" />
          <button class="attach-del" @click="removeAttachment(a.id)" title="移除图片">✕</button>
        </div>
      </div>
      <textarea
        v-model="input"
        rows="2"
        placeholder="问点什么…（Enter 发送，Shift+Enter 换行，Ctrl+V 可直接粘贴图片）"
        @keydown="onKeydown"
        @paste="onPaste"
      ></textarea>
      <div class="btn-row" style="margin-top: 8px">
        <button class="btn primary sm" :disabled="busy || (!input.trim() && !attachments.length)" @click="send">
          {{ busy ? '生成中…' : '发送' }}
        </button>
        <span class="dim" style="font-size: 11.5px">对话自动检索赛题知识库，回答有依据</span>
      </div>
    </div>
  </div>
</template>
