<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { getLLMConfig, LLM_CONFIG_LS_KEY } from '@/services/llm'

const settings = useSettingsStore()

onMounted(() => {
  settings.load()
})

/** 当前生效配置状态 */
const status = computed(() => {
  const c = getLLMConfig()
  const fromLocal = (() => {
    try {
      return !!localStorage.getItem(LLM_CONFIG_LS_KEY)
    } catch {
      return false
    }
  })()
  if (c.enabled) {
    return {
      mode: 'on' as const,
      text: 'AI 深度增强已启用',
      source: fromLocal ? '应用内配置（本浏览器）' : '环境变量（.env）',
      model: c.model,
      cls: 'green'
    }
  }
  return {
    mode: 'off' as const,
    text: '纯规则引擎模式（未配置 API Key）',
    source: '',
    model: '',
    cls: 'orange'
  }
})

const PRESETS: { name: string; baseUrl: string; model: string; note?: string }[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', note: 'glm-4-flash 有免费额度' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', note: '需海外网络' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat', note: '需海外网络' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', note: '需海外网络' },
  { name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', note: '本机跑模型，无需 key' }
]

function applyPreset(p: (typeof PRESETS)[number]) {
  settings.baseUrl = p.baseUrl
  settings.model = p.model
}

/** 测试失败时的常见原因诊断 */
const DIAGNOSIS: { when: RegExp; reason: string }[] = [
  { when: /401|403|invalid api key|unauthorized/i, reason: 'API Key 无效或无权限 → 检查 key 是否复制完整、是否有额度' },
  { when: /404|model not found|not exist/i, reason: '地址或模型名错误 → 检查 Base URL 末尾是 /v1、模型名是否匹配平台' },
  { when: /429|rate limit/i, reason: '请求太频繁或额度用尽 → 稍后再试，或检查账户余额' },
  { when: /cors|failed to fetch|network/i, reason: '浏览器直连被拦（CORS/网络）→ 该平台可能不支持浏览器直连；可尝试别的平台，或用 .env + 本地运行' },
  { when: /timeout|timed out/i, reason: '连接超时 → 检查网络/代理，或换个网络环境' }
]

const diagHints = computed(() => {
  if (settings.testOk !== false || !settings.testResult) return []
  return DIAGNOSIS.filter((d) => d.when.test(settings.testResult)).map((d) => d.reason)
})

const HELP: { platform: string; site: string; note: string }[] = [
  { platform: 'DeepSeek', site: 'platform.deepseek.com', note: '注册送额度，国内直连，性价比高' },
  { platform: '智谱 GLM', site: 'open.bigmodel.cn', note: 'glm-4-flash 免费额度，国内直连' },
  { platform: '通义千问', site: 'bailian.console.aliyun.com', note: '阿里云百炼，新用户免费额度' },
  { platform: 'Moonshot', site: 'platform.moonshot.cn', note: '国内直连' },
  { platform: 'Ollama 本地', site: 'ollama.com', note: '本机免费跑模型（qwen2.5:7b 等），无需 key 无网络依赖' }
]
</script>

<template>
  <div class="page">
    <div class="wrap" style="max-width: 880px">
      <div class="sec-title">AI 服务设置 · 支持任意 OpenAI 兼容接口</div>

      <!-- 当前状态 -->
      <div class="card" style="margin-bottom: 16px">
        <div class="sec-title">当前状态</div>
        <div class="btn-row">
          <span class="tag" :class="status.cls">{{ status.text }}</span>
          <span v-if="status.mode === 'on'" class="tag">{{ status.model }}</span>
          <span v-if="status.source" class="tag">{{ status.source }}</span>
        </div>
        <p class="dim" style="font-size: 12.8px; margin-top: 10px">
          配置优先级：应用内配置（本浏览器） > 环境变量（.env）。修改后保存即生效，下一轮质询就会使用新配置。
        </p>
      </div>

      <!-- 配置表单 -->
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
            <label>API Key<span>密钥（Ollama 本地可留空）</span></label>
            <input v-model="settings.apiKey" type="password" placeholder="sk-…" autocomplete="off" />
          </div>
        </div>

        <div class="sec-title" style="margin-top: 18px">常用预设（一键填入）</div>
        <div class="btn-row">
          <button v-for="p in PRESETS" :key="p.name" class="btn ghost sm" @click="applyPreset(p)" :title="p.note">
            {{ p.name }}{{ p.note ? ' *' : '' }}
          </button>
        </div>
        <p class="dim" style="font-size: 12px; margin-top: 8px">* 标注的预设需要海外网络，其余国内直连可用。</p>

        <div class="btn-row" style="margin-top: 18px">
          <button class="btn primary" @click="settings.save()">
            {{ settings.saved ? '✅ 已保存，下一轮质询生效' : '保存配置' }}
          </button>
          <button class="btn warn" :disabled="settings.testing" @click="settings.test()">
            {{ settings.testing ? '测试中…' : '测试连接' }}
          </button>
          <button class="btn gray" @click="settings.clear()">恢复默认（用 .env）</button>
        </div>

        <div v-if="settings.testResult" class="note" :class="settings.testOk === false ? '' : 'blue'" style="margin-top: 14px">
          {{ settings.testResult }}
        </div>
        <div v-if="diagHints.length" class="card pad-sm" style="margin-top: 10px; background: rgba(245, 158, 11, 0.06)">
          <div class="k" style="font-family: var(--mono); font-size: 10.5px; color: var(--txt-3); letter-spacing: 1px; margin-bottom: 5px">
            可能的原因与对策
          </div>
          <ul style="margin: 0; padding-left: 17px; font-size: 13px; color: #e7cfa0; line-height: 1.8">
            <li v-for="h in diagHints" :key="h">{{ h }}</li>
          </ul>
        </div>
      </div>

      <!-- 帮助 -->
      <div class="card" style="margin-top: 16px">
        <h3>去哪里申请 Key</h3>
        <table>
          <tr><th>平台</th><th>申请入口</th><th>说明</th></tr>
          <tr v-for="h in HELP" :key="h.platform">
            <td><b style="color: #eaf3ff">{{ h.platform }}</b></td>
            <td>{{ h.site }}</td>
            <td>{{ h.note }}</td>
          </tr>
        </table>
      </div>

      <!-- 安全说明 -->
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
