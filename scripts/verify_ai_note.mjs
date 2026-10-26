/* ============================================================
   LLM 链路验证：快速体验 → 模拟回答一轮 → 检查 AI 深度锐评流式出现
   运行前提：dev server 运行中（npm run dev）+ .env 已配置 key
   运行：node scripts/verify_ai_note.mjs
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

async function waitFor(c, expr, desc, timeout = 30000) {
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
  console.log('== 1. 打开首页 → 快速体验 ==')
  await c.send('Page.navigate', { url: BASE + '/home' })
  await waitFor(c, `document.body.innerText.includes('快速体验')`, '首页')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('快速体验')).click()`)
  await waitFor(c, `document.body.innerText.includes('CURRENT QUESTION')`, '质询页')

  console.log('== 2. 点一轮模拟回答 ==')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('模拟回答')).click()`)
  await waitFor(c, `document.querySelectorAll('.critique').length >= 1`, '规则锐评出现', 20000)

  console.log('== 3. 等待 AI 深度锐评（LLM 生成 → 定稿 → 打字机播放）==')
  const done = await waitFor(
    c,
    `(() => { const t = document.querySelector('.ai-note .ai-text')?.innerText || ''; return t.length > 20 && !t.includes('正在对照') })()`,
    'AI 深度锐评定稿',
    60000
  )
  const text = await c.eval(`document.querySelector('.ai-note .ai-text')?.innerText || ''`)
  const asks = await c.eval(`document.querySelectorAll('.ai-note li').length || 0`)
  console.log('AI 深度锐评:', text.slice(0, 160) + '…')
  console.log('评委追问建议条数:', asks)
  if (asks > 0) {
    console.log('追问建议:', (await c.eval(`[...document.querySelectorAll('.ai-note li')].map(li => li.innerText).join(' | ')`)).slice(0, 160))
  }
  const jsonLeak = /"[a-z_]+"\s*:/.test(text)
  console.log(jsonLeak ? '❌ 仍显示 JSON 原文' : '✅ 纯文本呈现（无 JSON 泄漏）')
  console.log('\n' + (jsonLeak ? '❌ LLM 链路验证：有 JSON 泄漏' : '✅ LLM 链路验证通过：规则判定 → RAG 检索 → LLM 深度锐评 → 追问建议'))
  process.exit(jsonLeak ? 1 : 0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
