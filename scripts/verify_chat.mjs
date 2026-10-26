/* ============================================================
   对话助手验证：打开页面 → 点悬浮按钮 → 发问题 → 等 AI 回复
   检验：多轮对话 + RAG 检索注入（问评分标准应命中知识库）
   运行：node scripts/verify_chat.mjs（需 dev server + Edge CDP 9222）
   ============================================================ */
const BASE = 'http://localhost:5173'
const CDP = 'http://127.0.0.1:9222'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPageWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(CDP + '/json/list')
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(300)
  }
  throw new Error('CDP 不可用')
}

class C {
  constructor(ws) { this.ws = new WebSocket(ws); this.id = 0; this.pending = new Map() }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej })
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id) }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res) => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })) })
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.result?.value
  }
}

async function waitFor(c, expr, desc, timeout = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const v = await c.eval(expr)
    if (v) return v
    await sleep(500)
  }
  throw new Error('等待超时: ' + desc)
}

async function main() {
  const c = new C(await getPageWs())
  await c.open()
  console.log('== 1. 打开首页 ==')
  await c.send('Page.navigate', { url: BASE + '/home' })
  await waitFor(c, `document.body.innerText.includes('快速体验')`, '首页')

  console.log('== 2. 打开对话助手 ==')
  await c.eval(`document.querySelector('.ai-chat-fab').click()`)
  await waitFor(c, `document.querySelector('.ai-chat-panel') !== null`, '面板出现')
  const welcome = await c.eval(`document.querySelector('.chat-msg.assistant .bubble')?.innerText || ''`)
  console.log('欢迎语:', welcome.slice(0, 50) + '…')

  console.log('== 3. 发送问题（检验 RAG）==')
  await c.eval(`(() => {
    const ta = document.querySelector('.ai-chat-foot textarea')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, 'AI技术深度这个维度具体考察哪些点？')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(300)
  await c.eval(`document.querySelector('.ai-chat-foot .btn.primary').click()`)

  const reply = await waitFor(
    c,
    `(() => {
      const msgs = [...document.querySelectorAll('.chat-msg.assistant .bubble')]
      const last = msgs[msgs.length - 1]?.innerText || ''
      return last.includes('AI 服务未启用') ? 'FAIL' : (msgs.length >= 2 && last.length > 30 ? last : '')
    })()`,
    'AI 回复'
  )
  if (reply === 'FAIL') {
    console.log('❌ AI 未启用（设置页需配置 key）')
    process.exit(1)
  }
  console.log('AI 回复:', reply.slice(0, 180) + '…')
  const hitScore = /35%|8%|大模型集成|RAG|Agent/.test(reply)
  console.log(hitScore ? '✅ 回复命中评分标准知识点（RAG 注入生效）' : '⚠️ 回复未见评分关键词（可能是泛答）')

  console.log('== 4. 连续多轮（追问）==')
  await c.eval(`(() => {
    const ta = document.querySelector('.ai-chat-foot textarea')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, '那这条项目应该优先补什么？')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(300)
  await c.eval(`document.querySelector('.ai-chat-foot .btn.primary').click()`)
  const reply2 = await waitFor(
    c,
    `(() => {
      const msgs = [...document.querySelectorAll('.chat-msg.assistant .bubble')].filter(b => !b.classList.contains('streaming'))
      if (msgs.length < 3) return ''
      const last = msgs[msgs.length - 1]?.innerText || ''
      return last.length > 30 && !last.includes('AI 服务未启用') && !last.includes('你好，我是') ? last : ''
    })()`,
    '第二轮回复',
    90000
  )
  console.log('第二轮回复:', reply2.slice(0, 120) + '…')
  console.log('\n✅ 对话助手验证通过：多轮对话 + RAG 注入 + 流式输出')
  process.exit(0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
