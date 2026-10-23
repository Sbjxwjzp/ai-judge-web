/* ============================================================
   引擎单测：完整跑默认演示项目质询链
   验证 buildChain → createSession → submit（含追问）→ buildReport
   运行：npx tsx scripts/engine_demo.ts
   ============================================================ */
import {
  createSession,
  submit,
  buildReport,
  currentQuestion,
  mockOf,
  progress,
  validateProject,
  buildChain
} from '../src/engine/index'
import { SAMPLE_PROJECT } from '../src/data/core'
import type { Question } from '../src/types/engine'

console.log('== 1. 质询链组装 ==')
const chain = buildChain(SAMPLE_PROJECT)
console.log('演示链长度:', chain.length, '| 期望: 11 主线题')
if (chain.length !== 11) {
  console.error('✗ 链长度不符')
  process.exit(1)
}
console.log('链顺序:', chain.map((q) => q.id).join(' → '))

console.log('\n== 2. 会话创建 ==')
const state = createSession(SAMPLE_PROJECT)
console.log('总阶段:', state.totalStages, '| 视觉项目:', state.isVision)
if (!state.isVision) {
  console.error('✗ 演示项目应为视觉项目')
  process.exit(1)
}

console.log('\n== 3. 完整质询链（模拟回答，含追问） ==')
let q: Question | null = currentQuestion(state)
let guard = 0
const verdicts: string[] = []
while (q && guard < 40) {
  guard++
  const answer = mockOf(q, SAMPLE_PROJECT)
  const res = submit(state, answer, { isMock: true })
  if (res.error) {
    console.error('✗ submit 返回错误:', res.error)
    process.exit(1)
  }
  verdicts.push(res.critique ? res.critique.verdict : '')
  if (guard <= 3 || guard % 5 === 0) {
    const p = progress(state)
    console.log(
      `[R${guard}] ${q.id}${q.isFollowUp ? '(追问)' : ''} 判定=${res.critique?.verdict} 完整度=${res.critique?.completeness} 下一步=${res.nextQuestion ? res.nextQuestion.id : '—'}`
    )
  }
  q = currentQuestion(state)
}
console.log('总轮次:', state.rounds.length, '| 完成:', state.finished)

if (!state.finished) {
  console.error('✗ 链未跑完')
  process.exit(1)
}
const qCount = state.rounds.filter((r) => !r.q.isFollowUp).length
const fCount = state.rounds.filter((r) => r.q.isFollowUp).length
console.log('主线题回答数:', qCount, '| 追问数:', fCount, '| 期望追问 ≥ 5')
if (qCount !== 11 || fCount < 5) {
  console.error('✗ 轮次结构异常（期望 11 主线 + 较多追问）')
  process.exit(1)
}

console.log('\n== 4. 报告生成 ==')
const report = buildReport(state)
console.log('风险数:', report.counts.risks, '| 高优先级:', report.counts.critical)
console.log('风险种类分布:', JSON.stringify(report.byKind))
console.log('维度分:', report.dims.map((d) => `${d.name}:${d.score}`).join(' '), '| 平均:', report.avg)
console.log('建议(must):', report.advice.must.length, '条')
console.log('视觉专项建议:', report.visionAdvice.length, '条')
console.log('结论前 100 字:', report.conclusion.slice(0, 100) + '…')
console.log('免责声明:', report.disclaimer)

if (report.counts.risks < 3) {
  console.error('✗ 风险识别过少')
  process.exit(1)
}

console.log('\n== 5. 项目校验 ==')
const bad = validateProject({ id: 'x', name: '', brief: '太短' })
console.log('空项目校验错误:', bad.errors.join(' / '), '| 期望包含名称与简介错误')
if (bad.ok || bad.errors.length !== 2) {
  console.error('✗ 校验逻辑异常')
  process.exit(1)
}
const good = validateProject({ id: 'x', name: '测试项目', brief: '这是一段足够长的项目简介用于测试校验逻辑是否正常' })
console.log('合法项目校验通过:', good.ok)

console.log('\n✅ 引擎单测全部通过')
