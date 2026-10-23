/* ============================================================
   本地 RAG 检索器（浏览器端，零依赖）
   - 中文 2-gram + 英文单词切词，词频打分
   - 完全本地运行：项目内容与知识库不外传，隐私安全
   - 检索结果注入 LLM Prompt，实现检索增强生成
   ============================================================ */
import { KB_CHUNKS, type KBChunk } from '@/data/kb/contest'

/** 切词：英文单词原样小写；中文连续片段切成 2-gram */
export function tokenize(text: string): string[] {
  const parts = text.match(/[a-zA-Z0-9+#]+|[\u4e00-\u9fa5]{2,}/g) || []
  const grams: string[] = []
  for (const p of parts) {
    if (/[a-zA-Z0-9+#]/.test(p)) {
      grams.push(p.toLowerCase())
    } else {
      for (let i = 0; i < p.length - 1; i++) grams.push(p.slice(i, i + 2))
    }
  }
  return grams
}

function termFreq(content: string, terms: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of terms) {
    let count = 0
    let idx = 0
    while ((idx = content.indexOf(t, idx)) >= 0) {
      count++
      idx += t.length
    }
    if (count > 0) map.set(t, count)
  }
  return map
}

export interface SearchHit {
  chunk: KBChunk
  score: number
}

/**
 * 检索知识库：返回与 query 最相关的 topK 片段。
 * 关键词预定义命中额外加权（提升"评分标准/AI深度"等主题词召回）。
 */
export function searchKB(query: string, topK = 3): SearchHit[] {
  const terms = tokenize(query)
  if (!terms.length) return []

  const hits: SearchHit[] = []
  for (const chunk of KB_CHUNKS) {
    const tf = termFreq(chunk.content.toLowerCase(), terms)
    let score = 0
    for (const [t, c] of tf) score += c
    /* 预定义关键词命中加权 */
    const kw = chunk.keywords.filter((k) => query.toLowerCase().includes(k.toLowerCase())).length
    score += kw * 5
    if (score > 0) hits.push({ chunk, score })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, topK)
}

/** 把检索结果格式化为 Prompt 可注入的上下文文本 */
export function formatKBContext(hits: SearchHit[]): string {
  if (!hits.length) return ''
  return (
    '【赛题与评分标准参考（检索自官方赛题知识库）】\n' +
    hits
      .map((h, i) => `${i + 1}. [${h.chunk.title}] ${h.chunk.content}`)
      .join('\n\n')
  )
}
