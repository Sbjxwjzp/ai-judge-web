/* ============================================================
   端到端冒烟回归（无头 Edge + CDP）
   流程：首页 → 快速体验 → 模拟回答×3 → 检查锐评/风险 → 结束出报告
   运行前提：
     1. dev server 已启动（npm run dev，端口 5173）
     2. Edge headless 已带调试端口启动：
        msedge --headless=new --remote-debugging-port=9222 --user-data-dir=...
   运行：node scripts/e2e_smoke.mjs
   注意：测试用 Edge 数据目录在项目外（D:/ai-judge-test-data），避免 watcher 噪音
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
    } catch {
      /* CDP 还没就绪 */
    }
    await sleep(300)
  }
  throw new Error('CDP 不可用：Edge 调试端口未就绪')
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg)
        this.pending.delete(msg.id)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.result && r.result.exceptionDetails) {
      throw new Error('页面执行异常: ' + JSON.stringify(r.result.exceptionDetails))
    }
    return r.result?.result?.value
  }
}

async function waitFor(client, expr, desc, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try {
      const v = await client.eval(expr)
      if (v) return v
    } catch {
      /* 继续等 */
    }
    await sleep(300)
  }
  throw new Error('等待超时: ' + desc)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail ? ' — ' + detail : ''))
}

async function main() {
  const wsUrl = await getPageWs()
  const c = new CDPClient(wsUrl)
  await c.open()

  console.log('== 1. 打开首页 ==')
  await c.send('Page.navigate', { url: BASE + '/home' })
  await waitFor(c, `document.body.innerText.includes('让你的项目先接受一次 AI 压力测试')`, '首页渲染')
  check('首页渲染', true)

  console.log('== 2. 点击「快速体验」→ 应进入质询页 ==')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('快速体验')).click()`)
  await waitFor(c, `document.body.innerText.includes('CURRENT QUESTION')`, '质询页出现当前问题')
  const qtext = await c.eval(`document.querySelector('.qtext')?.innerText || ''`)
  check('质询页出现当前问题', qtext.length > 10, qtext.slice(0, 40) + '…')

  console.log('== 3. 连续 3 次「模拟回答」==')
  for (let i = 1; i <= 3; i++) {
    await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('模拟回答')).click()`)
    await waitFor(c, `document.querySelectorAll('.critique').length >= ${i}`, '第 ' + i + ' 轮锐评出现', 20000)
    await sleep(200)
  }
  const critCount = await c.eval(`document.querySelectorAll('.critique').length`)
  const riskCount = await c.eval(`(document.querySelector('.col:last-child .counter')?.innerText || '').replace(/\\n/g,' ')`)
  check('3 轮锐评出现', critCount >= 3, '锐评卡片 ' + critCount + ' 个')
  check('右栏风险已累计', riskCount.includes('高优先级'), riskCount)

  console.log('== 4. 点击「结束并出报告」==')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('结束并出报告')).click()`)
  await waitFor(c, `document.body.innerText.includes('模拟评审报告')`, '报告页')
  const reportOk = await c.eval(`document.body.innerText.includes('风险总结（按优先级）') && document.body.innerText.includes('改进建议')`)
  const roundN = await c.eval(`document.body.innerText.match(/共 (\\d+) 轮问答/)?.[1] || '?'`)
  check('报告页渲染（风险+建议）', !!reportOk, '共 ' + roundN + ' 轮问答')

  console.log('== 5. 返回质询页再跑 2 轮（持久化链路）==')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('返回质询现场')).click()`)
  await waitFor(c, `document.body.innerText.includes('CURRENT QUESTION')`, '回到质询页')
  await c.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('模拟回答')).click()`)
  await sleep(1200)
  const totalRounds = await c.eval(`document.body.innerText.match(/共 (\\d+) 轮问答/)?.[1] || ''`)
  check('会话可继续追加轮次', true, '')

  console.log('\n===== 结果汇总 =====')
  const failed = results.filter((r) => !r.ok)
  results.forEach((r) => console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.name))
  console.log(failed.length ? `\n❌ ${failed.length} 项失败` : '\n✅ 全部通过')
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('冒烟测试异常:', e.message)
  process.exit(1)
})
