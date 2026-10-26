<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

onMounted(() => {
  settings.load()
})

const PRESETS: { name: string; baseUrl: string; model: string }[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
]

function applyPreset(p: (typeof PRESETS)[number]) {
  settings.baseUrl = p.baseUrl
  settings.model = p.model
}
</script>

<template>
  <div class="page">
    <div class="wrap" style="max-width: 860px">
      <div class="sec-title">AI 服务设置 · 支持任意 OpenAI 兼容接口</div>

      <div class="card glow">
        <div class="note blue" style="margin-bottom: 16px">
          在这里配置大模型 API，即可启用 <b>AI 深度锐评 / AI 深度评审报告</b>。
          配置仅保存在<b>当前浏览器</b>（localStorage），不会上传任何服务器，也不会进入代码仓库。
          不配置时应用自动使用<b>纯本地规则引擎</b>，功能完整可用。
        </div>

        <div class="form-grid">
          <div class="field">
            <label>Base URL<span>接口地址</span></label>
            <input v-model="settings.baseUrl" placeholder="https://api.deepseek.com/v1" />
          </div>
          <div class="field">
            <label>Model<span>模型名</span></label>
            <input v-model="settings.model" placeholder="deepseek-chat" />
          </div>
          <div class="field full">
            <label>API Key<span>密钥</span></label>
            <input v-model="settings.apiKey" type="password" placeholder="sk-…" autocomplete="off" />
          </div>
        </div>

        <div class="sec-title" style="margin-top: 18px">常用预设</div>
        <div class="btn-row">
          <button v-for="p in PRESETS" :key="p.name" class="btn ghost sm" @click="applyPreset(p)">
            {{ p.name }}
          </button>
        </div>

        <div class="btn-row" style="margin-top: 18px">
          <button class="btn primary" @click="settings.save()">
            {{ settings.saved ? '✅ 已保存' : '保存配置' }}
          </button>
          <button class="btn warn" :disabled="settings.testing" @click="settings.test()">
            {{ settings.testing ? '测试中…' : '测试连接' }}
          </button>
          <button class="btn gray" @click="settings.clear()">恢复默认（用 .env）</button>
        </div>

        <div v-if="settings.testResult" class="note" :class="settings.testOk === false ? '' : 'blue'"
             style="margin-top: 14px">
          {{ settings.testResult }}
        </div>
      </div>

      <div class="card" style="margin-top: 16px">
        <h3>安全说明</h3>
        <ul style="color: var(--txt-2); font-size: 13.6px; line-height: 1.9; padding-left: 20px; margin: 6px 0">
          <li>API Key 仅保存在当前浏览器的 localStorage 中，刷新页面不丢失；清除浏览器数据即清除</li>
          <li>密钥不会出现在代码、Git 仓库、技术文档或任何网络请求 URL 中</li>
          <li>使用公共电脑演示后，建议点击「恢复默认」清除本机保存的密钥</li>
          <li>锐评请求由浏览器直接调用你填写的接口地址，不经过第三方服务器</li>
        </ul>
      </div>
    </div>
  </div>
</template>
