/* ============================================================
   会话 Store（质询会话 + 草稿 + 提示）
   持久化策略：存 project + 每轮输入，恢复时用最新引擎重放
   （避免序列化题库里的函数字段；重放结果一致）
   ============================================================ */
import { defineStore } from 'pinia'
import { createSession, submit, buildReport, currentQuestion, progress } from '@/engine'
import { enhanceCritique } from '@/services/aiReview'
import type { Project, Session, SubmitResult } from '@/types/engine'

const LS_KEY = 'aij_session_v1'

interface PersistedRound {
  answer: string
  isMock: boolean
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    session: null as Session | null,
    pending: false,
    draft: '',
    toast: '',
    toastTimer: null as ReturnType<typeof setTimeout> | null,
    /** LLM 深度锐评：流式文本 / 是否生成中 */
    aiStreaming: '',
    aiBusy: false
  }),

  getters: {
    currentQuestion: (s) => (s.session ? currentQuestion(s.session) : null),
    progress: (s) => (s.session ? progress(s.session) : null),
    isActive: (s) => !!s.session,
    isFinished: (s) => !!s.session && s.session.finished
  },

  actions: {
    showToast(msg: string) {
      this.toast = msg
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => {
        this.toast = ''
      }, 2200)
    },

    /** 开始/重新开始一次质询 */
    start(project: Project) {
      this.session = createSession(project)
      this.draft = ''
      this.pending = false
      this.persist()
    },

    /**
     * 提交回答（异步：模拟 AI 分析延迟；W2 换成真实 LLM 流式后改走 services/llm）
     * 返回 Promise<SubmitResult>，调用方 await 后自行刷新
     */
    answer(text: string, isMock: boolean): Promise<SubmitResult> {
      const ss = this.session
      if (!ss) return Promise.resolve({ error: 'no-session' })
      const t = (text || '').trim()
      if (t.replace(/\s/g, '').length < 4) {
        this.showToast('请先写一点内容，再提交。')
        return Promise.resolve({ error: 'too-short' })
      }
      this.pending = true
      if (isMock) this.draft = t
      return new Promise((resolve) => {
        setTimeout(() => {
          const r = submit(ss, t, { isMock: !!isMock })
          this.pending = false
          if (r.error) {
            this.showToast('提交失败：' + r.error)
            this.persist()
            resolve(r)
            return
          }
          this.draft = ''
          this.persist()
          if (ss.finished) this.showToast('质询链已跑完，可以生成风险报告了')
          resolve(r)
          /* 规则判定已返回，异步生成 LLM 深度锐评（失败自动降级） */
          this.runAiEnhance(ss)
        }, isMock ? 900 : 700)
      })
    },

    /** LLM 深度锐评（不阻塞主流程；失败时界面自动显示规则引擎版本） */
    async runAiEnhance(ss: Session) {
      const last = ss.rounds[ss.rounds.length - 1]
      if (!last || last.critique.aiSummary) return
      this.aiBusy = true
      this.aiStreaming = ''
      const en = await enhanceCritique(ss.project, last.q, last.answer, last.critique, (t) => {
        this.aiStreaming += t
      })
      if (en) {
        last.critique.aiSummary = en.summary
        last.critique.aiAsks = en.asks
        this.persist()
      }
      this.aiStreaming = ''
      this.aiBusy = false
    },

    /** 用当前项目重新开始 */
    restart() {
      if (this.session?.project) {
        this.session = createSession(this.session.project)
        this.draft = ''
        this.pending = false
        this.persist()
      }
    },

    /** 结束会话并清空持久化 */
    endSession() {
      this.session = null
      this.draft = ''
      try {
        localStorage.removeItem(LS_KEY)
      } catch {
        /* ignore */
      }
    },

    /** 生成报告（buildReport 是纯函数，直接返回） */
    report() {
      return this.session ? buildReport(this.session) : null
    },

    /* ---------------- 持久化 ---------------- */
    persist() {
      if (!this.session) {
        try {
          localStorage.removeItem(LS_KEY)
        } catch {
          /* ignore */
        }
        return
      }
      const history: PersistedRound[] = this.session.rounds.map((r) => ({
        answer: r.answer,
        isMock: r.isMock
      }))
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ project: this.session.project, history }))
      } catch {
        /* 存储满/不可用时静默 */
      }
    },

    /** 刷新页面后恢复会话（重放历史输入） */
    loadPersisted() {
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return
        const data = JSON.parse(raw)
        if (!data || !data.project) return
        this.session = createSession(data.project)
        this.draft = ''
        this.pending = false
        const history: PersistedRound[] = Array.isArray(data.history) ? data.history : []
        history.forEach((h) => {
          if (!this.session) return
          const r = submit(this.session, h.answer, { isMock: !!h.isMock })
          if (r.error) {
            /* 历史输入异常时停止重放，保留已完成部分 */
            return
          }
        })
      } catch {
        this.session = null
      }
    }
  }
})
