/* ============================================================
   RAG 检索单测：验证知识库召回质量
   运行：npx tsx scripts/rag_demo.ts
   ============================================================ */
import { searchKB, formatKBContext, tokenize } from '../src/services/rag'

console.log('== 切词 ==')
console.log('「评分标准 AI技术深度」→', tokenize('评分标准 AI技术深度').join(' '))

const cases: [string, string[]][] = [
  ['评分标准 AI技术深度 大模型集成', ['kb-score-01', 'kb-score-02']],
  ['演示视频 MP4 1080p 提交要求', ['kb-submit-01']],
  ['RAG 检索增强 知识库问答', ['kb-dir-02']],
  ['前端框架 Vue React 技术栈', ['kb-tech-01']],
  ['不得虚构实验数据 评审', ['kb-redline-01']],
  ['技术创新点 应用创新点 文档', ['kb-submit-02']]
]

let pass = 0
for (const [q, expect] of cases) {
  const hits = searchKB(q, 3)
  const ids = hits.map((h) => h.chunk.id)
  const ok = expect.some((e) => ids.includes(e))
  console.log(
    (ok ? '  ✅ ' : '  ❌ ') +
      '「' +
      q +
      '」 → ' +
      ids.join(', ') +
      (ok ? '' : '  期望含 ' + expect.join(','))
  )
  if (ok) pass++
}

console.log(
  '\n' + (pass === cases.length ? '✅ RAG 检索全部通过' : `❌ ${cases.length - pass} 项未命中`)
)

/* 展示一段格式化上下文 */
console.log('\n== 示例上下文注入 ==')
console.log(formatKBContext(searchKB('评分标准 AI技术深度 大模型集成', 2)).slice(0, 300) + '…')

process.exit(pass === cases.length ? 0 : 1)
