/* ============================================================
   项目库 Store（示例项目 + 用户自定义项目）
   localStorage key 与原版一致：aij_custom_projects_v1
   ============================================================ */
import { defineStore } from 'pinia'
import { SAMPLE_PROJECT } from '@/data/core'
import type { Project } from '@/types/engine'

const LS_KEY = 'aij_custom_projects_v1'

let idSeq = 1
function genId(): string {
  return 'p' + Date.now().toString(36) + '_' + idSeq++
}

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    custom: [] as Project[]
  }),

  getters: {
    /** 示例项目（只读引用） */
    sample(): Project {
      return SAMPLE_PROJECT
    },
    /** 通过 id 找项目：先查示例，再查自定义 */
    byId: (state) => {
      return (id: string): Project | null => {
        if (id === SAMPLE_PROJECT.id) return SAMPLE_PROJECT
        return state.custom.find((p) => p.id === id) || null
      }
    }
  },

  actions: {
    load() {
      try {
        const raw = localStorage.getItem(LS_KEY)
        const arr = raw ? JSON.parse(raw) : []
        this.custom = Array.isArray(arr) ? arr : []
      } catch {
        this.custom = []
      }
    },
    save() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.custom))
      } catch {
        /* 存储不可用时静默 */
      }
    },
    /** 新增自定义项目，返回带 id 的完整对象 */
    add(data: Omit<Project, 'id' | 'kind' | 'updated'>): Project {
      const p: Project = { ...data, id: genId(), kind: 'custom', updated: '我的项目' }
      this.custom.push(p)
      this.save()
      return p
    },
    update(p: Project) {
      const i = this.custom.findIndex((x) => x.id === p.id)
      if (i >= 0) {
        this.custom[i] = p
        this.save()
      }
    },
    remove(id: string) {
      this.custom = this.custom.filter((x) => x.id !== id)
      this.save()
    }
  }
})
