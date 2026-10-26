/* ============================================================
   设置 Store — LLM API 配置（应用内，localStorage 持久化）
   优先级：应用内配置 > 环境变量（.env）
   支持任意 OpenAI 兼容接口：DeepSeek / 智谱 / 通义 / Moonshot / 自定义
   ============================================================ */
import { defineStore } from 'pinia'
import { getLLMConfig, LLM_CONFIG_LS_KEY } from '@/services/llm'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    apiKey: '',
    baseUrl: '',
    model: '',
    testing: false,
    testOk: null as boolean | null,
    testResult: '',
    saved: false
  }),

  actions: {
    /** 从当前生效配置（localStorage 优先，回退 .env）载入表单 */
    load() {
      const c = getLLMConfig()
      this.apiKey = c.apiKey
      this.baseUrl = c.baseUrl
      this.model = c.model
    },

    /** 保存到 localStorage（key 仅存本浏览器，不进任何服务器/仓库） */
    save() {
      try {
        localStorage.setItem(
          LLM_CONFIG_LS_KEY,
          JSON.stringify({
            apiKey: this.apiKey.trim(),
            baseUrl: this.baseUrl.trim(),
            model: this.model.trim()
          })
        )
        this.saved = true
        setTimeout(() => (this.saved = false), 2500)
      } catch {
        this.testResult = '保存失败：浏览器存储不可用'
        this.testOk = false
      }
    },

    /** 清除应用内配置，回退环境变量 */
    clear() {
      try {
        localStorage.removeItem(LLM_CONFIG_LS_KEY)
      } catch {
        /* ignore */
      }
      this.load()
    },

    /** 连接测试：直接调用 chat/completions 验证 key + 地址 + 模型 */
    async test() {
      this.testing = true
      this.testOk = null
      this.testResult = ''
      const base = this.baseUrl.trim().replace(/\/+$/, '')
      const model = this.model.trim() || 'deepseek-chat'
      try {
        const res = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.apiKey.trim()
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
          })
        })
        if (res.ok) {
          this.testOk = true
          this.testResult = '连接成功：' + model + ' 正常响应'
        } else {
          const txt = await res.text().catch(() => '')
          this.testOk = false
          this.testResult = '连接失败（HTTP ' + res.status + '）：' + txt.slice(0, 150)
        }
      } catch (e) {
        this.testOk = false
        this.testResult =
          '连接失败：' +
          (e instanceof Error ? e.message : String(e)) +
          '（若提示网络/CORS，请确认地址可访问、接口支持浏览器直连）'
      }
      this.testing = false
    }
  }
})
