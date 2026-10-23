<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

const ss = computed(() => sessionStore.session)
const pg = computed(() => sessionStore.progress)
const qn = computed(() => {
  const s = ss.value
  if (!s) return 0
  return s.rounds.filter((r) => !r.q.isFollowUp).length
})
const cur = computed(() => sessionStore.currentQuestion)

function qcode(i: number): string {
  return 'Q_' + (i < 10 ? '0' + i : i)
}
</script>

<template>
  <template v-if="ss">
    <div class="card">
      <div class="sec-title">项目基本信息</div>
      <h3 style="font-size: 16px; margin-bottom: 4px">{{ ss.project?.name }}</h3>
      <div class="btn-row" style="margin-bottom: 6px">
        <span class="tag" :class="ss.project?.kind === 'sample' ? 'blue' : 'violet'">
          {{ ss.project?.kind === 'sample' ? '示例项目' : '我的项目' }}
        </span>
        <span v-if="ss.project?.type" class="tag">{{ ss.project.type }}</span>
      </div>
      <div class="kv">
        <div class="k">简介</div>
        <div class="v small">{{ ss.project?.brief || '—' }}</div>
      </div>
      <div class="kv">
        <div class="k">项目背景</div>
        <div class="v small">{{ ss.project?.background || '—' }}</div>
      </div>
      <div class="kv">
        <div class="k">技术方案</div>
        <div class="v small">{{ ss.project?.tech || '—' }}</div>
      </div>
      <div class="kv">
        <div class="k">目前进展</div>
        <div class="v small">{{ ss.project?.progress || '—' }}</div>
      </div>
      <div class="kv">
        <div class="k">已有数据</div>
        <div class="v small">{{ ss.project?.data || '—' }}</div>
      </div>
      <div class="kv">
        <div class="k">我负责的部分</div>
        <div class="v small">{{ ss.project?.role || '—' }}</div>
      </div>
      <div class="hr"></div>
      <div class="sec-title">质询进度</div>
      <div class="counter">
        <div class="c">
          <div class="n">{{ pg?.done ?? 0 }}/{{ pg?.total ?? 0 }}</div>
          <div class="l">主线问题</div>
        </div>
        <div class="c cyan">
          <div class="n">{{ ss.rounds.length }}</div>
          <div class="l">已答轮次</div>
        </div>
        <div class="c red">
          <div class="n">{{ ss.risks.length }}</div>
          <div class="l">发现问题</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">追问链</div>
      <div class="chain">
        <div v-for="r in ss.rounds" :key="r.no" class="node done">
          <div class="pin">{{ r.q.isFollowUp ? '↳' : '✓' }}</div>
          <div class="nbody">
            <div class="ntext">{{ r.q.topic }}</div>
            <div class="nsub">
              {{ r.q.isFollowUp ? '追问 · ' : '' }}{{ r.critique.verdict }} · {{ r.critique.issues.length }} 个待处理点
            </div>
          </div>
        </div>
        <div v-if="cur" class="node now">
          <div class="pin">▶</div>
          <div class="nbody">
            <div class="ntext">{{ cur.topic }}</div>
            <div class="nsub">{{ qcode(qn + 1) }} · {{ cur.dim }}</div>
          </div>
        </div>
        <div v-else class="node">
          <div class="pin">■</div>
          <div class="nbody">
            <div class="ntext">质询结束，可生成报告</div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
