#!/usr/bin/env bash
# LLM 连通性探针：从 .env 读配置，走代理调 DeepSeek API 验证 key 有效
cd "$(dirname "$0")/.." || exit 1
KEY=$(grep '^VITE_LLM_API_KEY=' .env | cut -d= -f2)
BASE=$(grep '^VITE_LLM_BASE_URL=' .env | cut -d= -f2)
MODEL=$(grep '^VITE_LLM_MODEL=' .env | cut -d= -f2)
echo "== 配置 =="
echo "BASE=$BASE  MODEL=$MODEL  KEY前缀=${KEY:0:5}…"
echo "== 调用 =="
curl -s --max-time 20 -x http://127.0.0.1:7897 -X POST "$BASE/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"只回复两个字：你好\"}],\"max_tokens\":10}" \
  | python -c "import sys,json; d=json.load(sys.stdin); c=d.get('choices'); print('HTTP 200 OK · 回复:', c[0]['message']['content'] if c else d)"
