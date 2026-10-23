<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useSessionStore } from '@/stores/session'
import { VISION_KEYWORDS } from '@/engine'
import type { Project } from '@/types/engine'

const route = useRoute()
const router = useRouter()
const projectsStore = useProjectsStore()
const sessionStore = useSessionStore()

const editingId = ref<string | null>(null)
const editing = ref(false)
const errText = ref('')

const form = reactive({
  name: '',
  type: '',
  brief: '',
  background: '',
  tech: '',
  progress: '',
  data: '',
  role: ''
})

onMounted(() => {
  projectsStore.load()
  const q = route.query.edit
  if (q && typeof q === 'string') {
    const p = projectsStore.byId(q)
    if (p) {
      editingId.value = p.id
      editing.value = true
      form.name = p.name || ''
      form.type = p.type || ''
      form.brief = p.brief || ''
      form.background = p.background || ''
      form.tech = p.tech || ''
      form.progress = p.progress || ''
      form.data = p.data || ''
      form.role = p.role || ''
    }
  }
})

const isVision = computed(() => {
  const blob = [form.name, form.brief, form.tech, form.progress, form.background, form.data].join(' ')
  return VISION_KEYWORDS.some((k) => blob.toLowerCase().includes(k.toLowerCase()))
})

function fillSample() {
  form.name = '车载平衡滚球运动控制系统'
  form.type = '竞赛作品'
  form.brief = '小车沿黑色环形路线运动，车载平衡机构通过摆杆使钢球保持在指定位置附近，我负责视觉部分。'
  form.background = '大学生电子设计竞赛类智能车项目，团队分工中我负责视觉部分：让系统能够"看到"钢球的位置。'
  form.tech = '视觉系统采用 Sipeed MaixCAM Pro 视觉模块：采集摆杆区域图像 → 识别钢球 → 获取位置 → 转换坐标 → UART 发送给主控。'
  form.progress = '已完成视觉模块选型与硬件连接、图像采集通路、钢球识别流程搭建；待完成量化评估与鲁棒性验证。'
  form.data = '暂无量化测试记录，均为设计指标与待验证项。'
  form.role = '我负责视觉部分（图像采集与钢球位置检测）'
}

function submitProject() {
  const name = form.name.trim()
  const brief = form.brief.trim()
  if (!name) {
    errText.value = '请填写项目名称'
    return
  }
  if (brief.length < 8) {
    errText.value = '请填写项目简介（至少 8 个字）'
    return
  }
  errText.value = ''

  const data: Omit<Project, 'id' | 'kind' | 'updated'> = {
    name,
    brief,
    type: form.type.trim() || undefined,
    background: form.background.trim(),
    tech: form.tech.trim(),
    progress: form.progress.trim(),
    data: form.data.trim(),
    role: form.role.trim(),
    tags: isVision.value ? ['视觉方案'] : []
  }

  let p: Project | null = null
  if (editing.value && editingId.value) {
    const old = projectsStore.byId(editingId.value)
    if (old) {
      p = { ...old, ...data }
      projectsStore.update(p)
    }
  }
  if (!p) {
    p = projectsStore.add(data)
  }

  if (isVision.value) {
    sessionStore.showToast('检测到视觉相关关键词，已自动追加视觉专项质询题')
  }
  sessionStore.start(p)
  router.push('/review')
}

function back() {
  router.push('/library')
}
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div class="sec-title">{{ editing ? '编辑我的项目' : '输入我的项目' }}</div>
      <div class="card glow">
        <div class="note blue" style="margin-bottom: 16px">
          只填你真实掌握的内容。没有数据就写"暂无量化数据"，AI 会把这一项当成缺口来质询 —— 比虚构一个数字安全得多。
        </div>
        <div class="form-grid">
          <div class="field">
            <label>项目名称<span>必填</span></label>
            <input v-model="form.name" placeholder="例如：车载平衡滚球运动控制系统" />
          </div>
          <div class="field">
            <label>项目类型<span>可选</span></label>
            <input v-model="form.type" placeholder="例如：竞赛作品 / 课程设计 / 创业项目" />
          </div>
          <div class="field full">
            <label>一句话简介<span>必填 · 至少 8 字</span></label>
            <textarea v-model="form.brief" placeholder="一句话说清这个项目做什么"></textarea>
          </div>
          <div class="field full">
            <label>项目背景<span>为什么做它</span></label>
            <textarea v-model="form.background" placeholder="背景、要解决的问题、目标用户"></textarea>
          </div>
          <div class="field full">
            <label>技术方案<span>用了什么技术</span></label>
            <textarea v-model="form.tech" placeholder="例如：视觉模块型号、识别方法、通信方式、控制结构"></textarea>
          </div>
          <div class="field full">
            <label>目前进展<span>做到哪一步</span></label>
            <textarea v-model="form.progress" placeholder="已经完成什么、正在做什么、还没做什么"></textarea>
          </div>
          <div class="field full">
            <label>已有数据 / 测试记录<span>没有就写"暂无"</span></label>
            <textarea v-model="form.data" placeholder="测试条件、样本量、成功与失败情况；没有量化数据请直接说明"></textarea>
          </div>
          <div class="field full">
            <label>我负责的部分<span>可选</span></label>
            <textarea v-model="form.role" placeholder="例如：我负责视觉部分"></textarea>
          </div>
        </div>
        <div v-if="isVision" class="note blue" style="margin-top: 14px">
          检测到<b>视觉 / 摄像头 / 识别</b>等关键词：质询时会自动追加光照、遮挡、标定、延迟等视觉专项题。
        </div>
        <div class="err-text">{{ errText }}</div>
        <div class="btn-row" style="margin-top: 6px">
          <button class="btn primary" @click="submitProject">开始 AI 质询 →</button>
          <button class="btn gray" @click="back">返回项目库</button>
          <button class="btn ghost sm" @click="fillSample">用示例内容查看填写格式</button>
        </div>
      </div>
      <div class="note" style="margin-top: 16px">
        质询全部在你的浏览器本地完成：项目内容不会上传到任何服务器，质询链与锐评规则都在本地运行。
      </div>
    </div>
  </div>
</template>
