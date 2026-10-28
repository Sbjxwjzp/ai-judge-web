/* ============================================================
   分段录制驱动：按 JSON 指令序列控制浏览器（CDP）
   用法：node scripts/record/drive.mjs <steps.json>
   指令格式：
     {"action":"wait","ms":2000}                       等待
     {"action":"click","text":"快速体验"}               按按钮文字点击
     {"action":"clickSel","sel":".ai-chat-fab"}         按选择器点击
     {"action":"type","sel":"...","text":"..."}         输入文本（触发 v-model）
     {"action":"waitFor","expr":"...","timeout":15000}  等表达式为真
     {"action":"eval","expr":"..."}                     任意求值
     {"action":"goto","url":"http://localhost:5173/home"}
     {"action":"log","msg":"..."}
   ============================================================ */
import { readFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9222'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPageWs() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(CDP + '/json/list')
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error('CDP 不可用（页面未打开 localhost:5173）')
}

class Client {
  constructor(ws) {
    this.ws = new WebSocket(ws)
    this.id = 0
    this.pending = new Map()
  }
  async open() {
    await new Promise((res, rej) => {
      this.ws.onopen = res
      this.ws.onerror = rej
    })
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)(m)
        this.pending.delete(m.id)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res) => {
      this.pending.set(id, res)
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    return r.result?.result?.value
  }
}

const stepsFile = process.argv[2]
if (!stepsFile) {
  console.error('用法: node scripts/record/drive.mjs <steps.json>')
  process.exit(1)
}
const steps = JSON.parse(readFileSync(stepsFile, 'utf-8'))

const client = new Client(await getPageWs())
await client.open()
console.log('[drive] 已连接，共', steps.length, '步')

for (let i = 0; i < steps.length; i++) {
  const s = steps[i]
  try {
    switch (s.action) {
      case 'wait':
        await sleep(s.ms || 1000)
        break
      case 'click': {
        const ok = await client.eval(`(() => {
          const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(s.text)}))
          if (!btn) return false
          btn.click()
          return true
        })()`)
        if (!ok) console.warn('[drive] 未找到按钮:', s.text)
        break
      }
      case 'clickSel': {
        const ok = await client.eval(`(() => {
          const el = document.querySelector(${JSON.stringify(s.sel)})
          if (!el) return false
          el.click()
          return true
        })()`)
        if (!ok) console.warn('[drive] 未找到元素:', s.sel)
        break
      }
      case 'type': {
        await client.eval(`(() => {
          const el = document.querySelector(${JSON.stringify(s.sel)})
          if (!el) return false
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          if (setter) setter.call(el, ${JSON.stringify(s.text)})
          else el.value = ${JSON.stringify(s.text)}
          el.dispatchEvent(new Event('input', { bubbles: true }))
          return true
        })()`)
        break
      }
      case 'waitFor': {
        const t0 = Date.now()
        const timeout = s.timeout || 15000
        let ok = false
        while (Date.now() - t0 < timeout) {
          try {
            if (await client.eval(s.expr)) {
              ok = true
              break
            }
          } catch {
            /* continue */
          }
          await sleep(300)
        }
        if (!ok) console.warn('[drive] waitFor 超时:', s.expr)
        break
      }
      case 'eval':
        await client.eval(s.expr)
        break
      case 'scroll':
        /* 平滑滚动（正数向下） */
        await client.eval(`window.scrollBy({ top: ${Number(s.y) || 400}, behavior: 'smooth' })`)
        break
      case 'goto':
        await client.send('Page.navigate', { url: s.url })
        break
      case 'log':
        console.log('[drive] ' + s.msg)
        break
      default:
        console.warn('[drive] 未知指令:', s.action)
    }
  } catch (e) {
    console.error('[drive] 步骤', i + 1, '失败:', e instanceof Error ? e.message : e)
  }
}
console.log('[drive] 全部执行完毕')
process.exit(0)
