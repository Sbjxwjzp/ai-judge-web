<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import type { Report } from '@/types/engine'

const router = useRouter()
const sessionStore = useSessionStore()

const rep = computed<Report | null>(() => sessionStore.report())

const today = new Date().toLocaleDateString('zh-CN')

function qcode(i: number): string {
  return 'Q_' + (i < 10 ? '0' + i : i)
}

function doPrint() {
  window.print()
}

function go(view: string) {
  router.push('/' + view)
}
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div v-if="!rep" class="card">
        <h3>还没有可用的报告</h3>
        <p>完成一次质询后，这里会生成风险总结与改进建议。</p>
        <div class="btn-row">
          <button class="btn primary" @click="go('home')">回到首页</button>
          <button class="btn ghost" @click="go('library')">去项目库</button>
        </div>
      </div>

      <template v-else>
        <!-- 打印头（仅导出 PDF 时显示） -->
        <div class="print-head print-only">
          <h1>{{ rep.project?.name }} · 模拟评审报告</h1>
          <div class="meta">
            应用场景：{{ rep.scene }}<br />
            共 {{ rep.counts.rounds }} 轮问答（主线 {{ rep.counts.questions }} · 追问 {{ rep.counts.followUps }}）· 生成日期：{{ today }}
          </div>
          <div class="disc">{{ rep.disclaimer }}</div>
        </div>

        <div class="report-head">
          <div>
            <div class="k-label">模拟评审报告 · 应用场景 {{ rep.scene }}</div>
            <h2 style="margin: 6px 0 4px; font-size: 26px">{{ rep.project?.name }}</h2>
            <div class="dim" style="font-size: 13px">
              共 {{ rep.counts.rounds }} 轮问答（主线 {{ rep.counts.questions }} · 追问 {{ rep.counts.followUps }}）· 模拟回答 {{ rep.counts.mock }} · 手动回答 {{ rep.counts.manual }}
            </div>
          </div>
          <div class="btn-row">
            <button class="btn primary" @click="doPrint">打印 / 导出 PDF</button>
            <button class="btn ghost" @click="go('review')">返回质询现场</button>
            <button class="btn gray" @click="sessionStore.restart()">重新质询</button>
          </div>
        </div>

        <div class="card glow">
          <div class="sec-title">结论</div>
          <p>{{ rep.conclusion }}</p>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="sec-title">模拟评审维度（非官方评分）</div>
          <div class="score-hero">
            <div v-for="d in rep.dims" :key="d.name" class="s">
              <div class="v">{{ d.score }}</div>
              <div class="l">{{ d.name }}</div>
            </div>
            <div class="s">
              <div class="v">{{ rep.avg }}</div>
              <div class="l">综合（证据充分度）</div>
            </div>
          </div>
          <div class="note" style="margin-top: 12px">
            该分数只反映本次质询中"回答覆盖了多少可核对证据"，用于定位薄弱环节；它不是任何比赛的官方评分。
          </div>
        </div>

        <div class="grid-2" style="margin-top: 16px">
          <div class="card">
            <div class="sec-title">风险总结（按优先级）</div>
            <div v-if="rep.risks.length" class="rlist">
              <div v-for="(r, i) in rep.risks" :key="r.key" class="rrow">
                <div class="idx">{{ i + 1 }}</div>
                <div style="flex: 1">
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 4px">
                    <span class="sev" :class="r.sev"></span>
                    <span class="tag" :class="r.cls || 'blue'">{{ r.name }}</span>
                    <b style="font-size: 14px">{{ r.title }}</b>
                    <span class="dim" style="font-size: 12px">
                      来自《{{ r.topic }}》{{ r.count > 1 ? ' · 出现 ' + r.count + ' 次' : '' }}
                    </span>
                  </div>
                  <div class="ibody" style="font-size: 13.4px; color: var(--txt-2)">{{ r.detail }}</div>
                  <div v-if="r.asks && r.asks.length" class="iblock">
                    <div class="k">评委可能继续追问</div>
                    <ul>
                      <li v-for="(a, idx) in r.asks" :key="idx">{{ a }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <p v-else>本次质询没有记录到风险点。</p>
          </div>

          <div class="card">
            <div class="sec-title">改进建议</div>
            <div class="advice">
              <div class="ahead"><span class="tag red">答辩前必须补</span></div>
              <ul>
                <li v-for="a in rep.advice.must" :key="a">{{ a }}</li>
              </ul>
            </div>
            <div class="advice">
              <div class="ahead"><span class="tag orange">建议补</span></div>
              <ul>
                <li v-for="a in (rep.advice.should.length ? rep.advice.should : ['把已经讲清的结论配上依据，形成固定的表达结构。'])" :key="a">{{ a }}</li>
              </ul>
            </div>
            <div class="advice">
              <div class="ahead"><span class="tag green">加分项</span></div>
              <ul>
                <li v-for="a in rep.advice.nice" :key="a">{{ a }}</li>
              </ul>
            </div>
            <template v-if="rep.visionAdvice.length">
              <div class="hr"></div>
              <div class="sec-title">视觉专项改进清单</div>
              <ul style="padding-left: 20px">
                <li v-for="a in rep.visionAdvice" :key="a" style="margin: 5px 0; font-size: 13.6px; color: #cfdcec">
                  {{ a }}
                </li>
              </ul>
            </template>
          </div>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="sec-title">建议补充的答辩材料</div>
          <div class="suggest-chips">
            <span v-for="m in (rep.material.length ? rep.material : ['暂时没有需要补充的材料'])" :key="m" class="c">+ {{ m }}</span>
          </div>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="sec-title">质询回合一览</div>
          <div v-for="r in rep.rounds" :key="r.no" class="rrow" style="margin-bottom: 8px">
            <div class="idx">{{ qcode(r.no) }}</div>
            <div style="flex: 1">
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 4px">
                <b style="font-size: 14px">{{ r.q.topic }}</b>
                <span class="tag blue">{{ r.q.dim }}</span>
                <span v-if="r.q.isFollowUp" class="tag orange">追问</span>
                <span :class="r.isMock ? 'tag violet' : 'tag green'">
                  {{ r.isMock ? '模拟回答' : '手动回答' }}
                </span>
                <span class="tag" :class="r.critique.criticalCount ? 'red' : 'green'">{{ r.critique.verdict }}</span>
              </div>
              <div style="font-size: 13.2px; color: var(--txt-2)">问题：{{ r.q.text }}</div>
              <div style="font-size: 13.2px; color: var(--txt-3); margin-top: 5px">
                回答：{{ r.answer.slice(0, 120) }}{{ r.answer.length > 120 ? '…' : '' }}
              </div>
              <div v-if="r.critique.issues.length" style="margin-top: 5px; display: flex; gap: 6px; flex-wrap: wrap">
                <span v-for="i in r.critique.issues" :key="i.title" class="tag" :class="i.cls || 'blue'">{{ i.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="sec-title">这份报告是什么 / 不是什么</div>
          <div class="grid-2">
            <div>
              <h3>它是</h3>
              <ul style="color: var(--txt-2); padding-left: 20px; font-size: 13.6px; line-height: 1.9">
                <li>正式比赛前的一次压力测试，用来暴露没想清楚的地方</li>
                <li>一份可以被逐条核对的待办清单</li>
                <li>一套针对你项目资料生成的追问链</li>
              </ul>
            </div>
            <div>
              <h3>它不是</h3>
              <ul style="color: var(--txt-2); padding-left: 20px; font-size: 13.6px; line-height: 1.9">
                <li>不是比赛的官方评审，也不是官方评分系统</li>
                <li>不会替你虚构任何实验数据或测试结果</li>
                <li>不替代真实评委的判断</li>
              </ul>
            </div>
          </div>
          <div class="note" style="margin-top: 12px">{{ rep.disclaimer }}</div>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="sec-title">系统做了什么</div>
          <div class="flowline">
            <template v-for="(t, i) in ['项目是什么', '为什么需要AI', 'AI如何分析项目', 'AI如何提出问题', 'AI如何根据回答追问', 'AI如何发现漏洞', 'AI给出改进方向']" :key="t">
              <span class="f">{{ t }}</span>
              <span v-if="i < 6" class="a">→</span>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
