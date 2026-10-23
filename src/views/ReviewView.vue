<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import ProjectPanel from '@/components/ProjectPanel.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import AnswerBox from '@/components/AnswerBox.vue'
import CritiqueCard from '@/components/CritiqueCard.vue'
import RiskPanel from '@/components/RiskPanel.vue'

const router = useRouter()
const sessionStore = useSessionStore()

const latest = computed(() => {
  const s = sessionStore.session
  if (!s || !s.rounds.length) return null
  return s.rounds[s.rounds.length - 1]
})

const history = computed(() => {
  const s = sessionStore.session
  if (!s) return []
  const hasLatest = s.rounds.length > 0
  return s.rounds.slice(0, s.rounds.length - (hasLatest ? 1 : 0)).reverse()
})

/** 当前主线题序号（不含追问） */
const qn = computed(() => {
  const s = sessionStore.session
  if (!s) return 0
  return s.rounds.filter((r) => !r.q.isFollowUp).length + 1
})

function go(view: string) {
  router.push('/' + view)
}
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div v-if="!sessionStore.session" class="card">
        <h3>没有进行中的质询</h3>
        <p>先从示例项目快速体验，或输入你自己的项目开始一次 AI 压力测试。</p>
        <div class="btn-row">
          <button class="btn primary" @click="go('home')">回到首页</button>
          <button class="btn ghost" @click="go('library')">去项目库</button>
        </div>
      </div>

      <div v-else class="review-grid">
        <!-- 左栏：项目信息 + 进度 + 追问链 -->
        <div class="col">
          <ProjectPanel />
        </div>

        <!-- 中栏：当前问题 + 回答 + 锐评 + 往轮 -->
        <div class="col center">
          <template v-if="sessionStore.currentQuestion">
            <QuestionCard :question="sessionStore.currentQuestion" :no="qn" />
            <div v-if="sessionStore.pending" class="card">
              <div class="loading">
                <span class="spinner"></span>
                AI 正在分析这个回答：识别证据 → 定位漏洞 → 决定是深入追问还是针对缺口追问…
              </div>
            </div>
            <AnswerBox v-else />
          </template>
          <div v-else class="qcard fade-in">
            <div class="qhead">
              <span class="qcode">质询结束</span>
              <span class="tag green">已完成 {{ sessionStore.session.rounds.length }} 轮</span>
            </div>
            <p class="qtext">本项目的主线质询已经跑完。现在可以生成风险总结与改进建议。</p>
            <div class="btn-row">
              <button class="btn primary" @click="go('report')">生成风险报告 →</button>
              <button class="btn ghost" @click="sessionStore.restart()">重新开始质询</button>
            </div>
          </div>

          <CritiqueCard v-if="latest && !sessionStore.pending" :round="latest" />

          <div v-if="history.length" class="card">
            <div class="sec-title">往轮记录（{{ history.length }}）· 点击展开</div>
            <details v-for="r in history" :key="r.no" class="histitem">
              <summary>
                <span class="mono">Q_{{ r.no < 10 ? '0' + r.no : r.no }}</span>
                <b>{{ r.q.topic }}</b>
                <span v-if="r.q.isFollowUp" class="tag orange">追问</span>
                <span class="tag" :class="r.critique.criticalCount ? 'red' : 'green'">{{ r.critique.verdict }}</span>
                <span class="dim">{{ r.critique.issues.length }} 个待处理点</span>
              </summary>
              <CritiqueCard :round="r" />
            </details>
          </div>

          <div class="note blue">
            演示提示：连续点几次「模拟回答」，就能看到 AI 如何连续追问；任意时刻点右上角「结束并出报告」即可查看风险总结与改进建议。
          </div>
        </div>

        <!-- 右栏：风险 + 维度 -->
        <div class="col">
          <RiskPanel />
        </div>
      </div>
    </div>
  </div>
</template>
