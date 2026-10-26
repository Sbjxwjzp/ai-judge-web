/* 检查 .env 配置状态（不打印 key 明文，只打印状态） */
import { readFileSync } from 'node:fs'

const raw = readFileSync(new URL('../.env', import.meta.url), 'utf-8')
const get = (k) => {
  const m = raw.split('\n').find((l) => l.startsWith(k + '='))
  return m ? m.slice(k.length + 1).trim() : ''
}

const key = get('VITE_LLM_API_KEY')
const filled = key.length > 0 && !/[\u4e00-\u9fa5]/.test(key)
console.log('KEY=' + (filled ? '已填（' + key.slice(0, 5) + '…' + key.slice(-3) + '）' : '未填/占位'))
console.log('BASE_URL=' + get('VITE_LLM_BASE_URL'))
console.log('MODEL=' + get('VITE_LLM_MODEL'))
console.log('ENABLED=' + get('VITE_LLM_ENABLED'))
console.log('状态=' + (filled ? '可启用 LLM' : '需填写 key'))
