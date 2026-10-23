<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { ICAN_SCENE, REVIEW_DIMS, SAMPLE_PROJECT } from '@/data/core'

const router = useRouter()
const sessionStore = useSessionStore()

function go(view: string) {
  router.push('/' + view)
}

function quickStart() {
  sessionStore.start(SAMPLE_PROJECT)
  router.push('/review')
}
</script>

<template>
  <div class="page">
    <div class="wrap">
      <section class="hero">
        <div class="eyebrow">应用场景 · {{ ICAN_SCENE }}</div>
        <h2>AI刁钻评委</h2>
        <p class="oneliner">让你的项目先接受一次 AI 压力测试，再去面对真正的评委。</p>
        <p class="sub">
          面向大学生创新创业项目的 AI 智能评审与压力测试智能体。通过连续质询，提前发现项目中的技术漏洞、数据漏洞、逻辑漏洞、创新性不足、商业化与展示问题。
        </p>
        <div class="hero-actions">
          <button class="btn primary" @click="quickStart">快速体验（车载平衡滚球运动控制系统）</button>
          <button class="btn ghost" @click="go('input')">输入我的项目</button>
          <button class="btn gray" @click="go('library')">项目库</button>
        </div>
        <p class="dim" style="margin-top: 14px; font-size: 13px">
          不需要提前阅读资料：点"快速体验"就能在 1～3 分钟内看到一次完整的 AI 质询与追问。
        </p>
      </section>

      <div class="grid-3" style="margin-top: 8px">
        <div class="card glow">
          <div class="step-num">STEP 01 · 项目输入</div>
          <h3>选择示例或输入自己的项目</h3>
          <p>
            内置示例项目「车载平衡滚球运动控制系统」（视觉方案：Sipeed MaixCAM Pro）；你也可以直接填入自己的项目名称、简介、技术方案、进展与已有数据。
          </p>
        </div>
        <div class="card glow">
          <div class="step-num">STEP 02 · AI 连续质询</div>
          <h3>不是随机提问，而是追问链</h3>
          <p>
            AI 依据项目资料动态出题：回答完整就继续往下压一层，回答有漏洞就针对漏洞追问，形成"基础问题 → 技术追问 → 异常场景 → 数据验证 → 改进建议"的链条。
          </p>
        </div>
        <div class="card glow">
          <div class="step-num">STEP 03 · 锐评与风险总结</div>
          <h3>给出为什么、会追问什么、该补什么</h3>
          <p>
            每轮给出 AI 锐评：发现的问题、证据不足、逻辑漏洞、关键参数缺失、技术风险、数据风险；最后汇总为风险清单、模拟评审维度与改进建议。
          </p>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 16px">
        <div class="card">
          <h3>AI 会从哪些维度质询</h3>
          <p class="muted" style="font-size: 13.6px">
            项目背景 · 创新性 · 技术实现 · AI 能力 · 数据与验证 · 异常情况 · 实用价值 · 商业化
          </p>
          <div class="hr"></div>
          <div class="sec-title">模拟评审维度（与 iCAN AI 应用创新挑战赛评审维度对应）</div>
          <div class="btn-row">
            <span v-for="d in REVIEW_DIMS" :key="d" class="tag blue">{{ d }}</span>
          </div>
          <div class="note" style="margin-top: 14px">
            本系统是<b>模拟评审</b>：它不代表任何比赛的官方评审，也不是官方评分系统。比赛只是它的应用场景之一。
          </div>
        </div>
        <div class="card">
          <h3>关于数据的红线</h3>
          <p>AI刁钻评委不会替你虚构数据：</p>
          <ul style="color: var(--txt-2); font-size: 13.6px; line-height: 1.9; padding-left: 20px; margin: 6px 0">
            <li>不虚构实验结果、样本量、识别率、误差、用户量、合作方</li>
            <li>项目资料里没有的量化结果，AI 只会指出来并要求你补充</li>
            <li>缺少数据时，正确答法是说"目标 / 设计指标 / 计划测试 / 需要验证"</li>
          </ul>
          <div class="note blue">
            默认演示项目的资料中，所有指标均为<b>设计指标与待验证项</b>，不是已完成的测试结果。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
