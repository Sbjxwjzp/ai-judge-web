/* ============================================================
   AI 锐评增强服务
   流程：规则引擎给出判定骨架 → 调用 LLM 生成锐评增强
   失败/未配置 key 时返回 null，界面自动降级为纯规则引擎版本
   ============================================================ */
import { chatStream, extractJson, llmConfig, LLMError } from './llm'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import { searchKB, formatKBContext } from './rag'
import type { Project, Question, Critique } from '@/types/engine'

export interface AIEnhancement {
  summary: string
  asks: string[]
}

/**
 * 生成 AI 锐评增强。
 * @param onToken 流式回调（用于打字机效果），失败时不影响降级
 * @returns 增强结果；LLM 未启用或调用失败时返回 null
 */
export async function enhanceCritique(
  project: Project | null,
  q: Question,
  answer: string,
  critique: Critique,
  onToken?: (token: string) => void
): Promise<AIEnhancement | null> {
  if (!llmConfig.enabled) return null

  /* RAG：以 问题+回答+判定 为 query 检索赛题知识库，注入 Prompt */
  const kbContext = formatKBContext(
    searchKB([q.topic, q.text, answer, critique.verdict].join(' '), 3)
  )

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt() },
    {
      role: 'user' as const,
      content: buildUserPrompt({ project, q, answer, critique, kbContext })
    }
  ]

  try {
    const text = await chatStream(messages, {
      json: true,
      timeoutMs: 45000,
      temperature: 0.35,
      onToken
    })
    const data = extractJson(text) as { summary?: unknown; asks?: unknown }
    const summary = typeof data.summary === 'string' ? data.summary.trim() : ''
    const asks = Array.isArray(data.asks)
      ? data.asks
          .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          .slice(0, 3)
      : []
    if (!summary && !asks.length) return null
    return { summary, asks }
  } catch (e) {
    if (e instanceof LLMError) {
      console.warn('[aiReview] LLM 增强失败，降级为规则引擎：', e.message)
    } else {
      console.warn('[aiReview] LLM 增强异常，降级为规则引擎：', e)
    }
    return null
  }
}
