<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useSessionStore } from '@/stores/session'
import type { Project } from '@/types/engine'

const router = useRouter()
const projectsStore = useProjectsStore()
const sessionStore = useSessionStore()

const tab = ref<'sample' | 'custom'>('sample')

onMounted(() => {
  projectsStore.load()
})

function go(view: string) {
  router.push('/' + view)
}

function start(p: Project) {
  sessionStore.start(p)
  router.push('/review')
}

function edit(p: Project) {
  router.push('/input?edit=' + encodeURIComponent(p.id))
}

function remove(p: Project) {
  if (confirm('删除项目「' + p.name + '」？此操作不可撤销。')) {
    projectsStore.remove(p.id)
  }
}
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div class="sec-title">项目库 · 先点示例快速体验，再输入自己的项目</div>
      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'sample' }" @click="tab = 'sample'">
          示例项目<span class="n">1</span>
        </button>
        <button class="tab" :class="{ on: tab === 'custom' }" @click="tab = 'custom'">
          我的项目<span class="n">{{ projectsStore.custom.length }}</span>
        </button>
        <button class="btn ghost sm" style="margin-left: auto" @click="go('input')">
          + 添加我的项目
        </button>
      </div>

      <template v-if="tab === 'sample'">
        <div class="note blue" style="margin-bottom: 14px">
          示例项目用于快速体验：它模拟的是一个真实竞赛类项目的资料，其中所有指标都是<b>设计指标</b>，不是已完成的测试数据。
        </div>
        <div class="plist">
          <div class="card pcard">
            <div class="head">
              <h3>{{ projectsStore.sample.name }}</h3>
              <span class="tag blue">示例项目</span>
            </div>
            <div class="desc">{{ projectsStore.sample.brief }}</div>
            <div class="meta">
              <span v-for="t in (projectsStore.sample.tags || []).slice(0, 5)" :key="t" class="tag">{{ t }}</span>
            </div>
            <div class="btn-row">
              <button class="btn primary sm" @click="start(projectsStore.sample)">开始 AI 质询</button>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="projectsStore.custom.length" class="plist">
          <div v-for="p in projectsStore.custom" :key="p.id" class="card pcard">
            <div class="head">
              <h3>{{ p.name }}</h3>
              <span class="tag violet">我的项目</span>
            </div>
            <div class="desc">{{ p.brief || '（未填写简介）' }}</div>
            <div class="meta">
              <span v-for="t in (p.tags || []).slice(0, 5)" :key="t" class="tag">{{ t }}</span>
            </div>
            <div class="btn-row">
              <button class="btn primary sm" @click="start(p)">开始 AI 质询</button>
              <button class="btn gray sm" @click="edit(p)">编辑</button>
              <button class="btn gray sm" @click="remove(p)">删除</button>
            </div>
          </div>
        </div>
        <div v-else class="card">
          <h3>还没有你的项目</h3>
          <p>点击「输入我的项目」，填入项目名称、简介、技术方案与目前进展。填得越具体，AI 质询越有针对性。</p>
          <button class="btn primary" @click="go('input')">现在输入</button>
        </div>
      </template>
    </div>
  </div>
</template>
