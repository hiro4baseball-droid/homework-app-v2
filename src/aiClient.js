const GEMINI_MODEL = 'gemini-1.5-flash-latest'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

export function getApiKeys() {
  return {
    gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  }
}

async function urlToBase64(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  const mimeType = blob.type || 'image/jpeg'
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ data: reader.result.split(',')[1], mimeType })
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function callGemini(prompt, images = []) {
  const { gemini } = getApiKeys()
  if (!gemini) throw Object.assign(new Error('Gemini APIキーが設定されていません'), { code: 'NO_KEY' })

  const parts = [{ text: prompt }]
  for (const { data, mimeType } of images) {
    parts.push({ inline_data: { mime_type: mimeType, data } })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${gemini}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  )

  if (res.status === 429) throw Object.assign(new Error('Gemini quota exceeded'), { code: 'QUOTA' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callAnthropic(prompt, images = []) {
  const { anthropic } = getApiKeys()
  if (!anthropic) throw Object.assign(new Error('Anthropic APIキーが設定されていません'), { code: 'NO_KEY' })

  const content = []
  for (const { data, mimeType } of images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data } })
  }
  content.push({ type: 'text', text: prompt })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropic,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.content?.[0]?.text || ''
}

async function callAI(prompt, images = []) {
  try {
    return await callGemini(prompt, images)
  } catch (e) {
    if (e.code === 'QUOTA') {
      console.warn('Gemini quota exceeded, falling back to Anthropic')
      return await callAnthropic(prompt, images)
    }
    throw e
  }
}

export async function analyzeHomeworkPhotos(photoUrls, subject, title) {
  const needsTsubu = ['数学', '理科'].includes(subject)
  const images = await Promise.all(photoUrls.map(urlToBase64))

  const prompt = `あなたは塾の先生のアシスタントです。生徒が提出した宿題の写真を確認してください。

宿題: ${title}（${subject}）

以下を確認し、JSONのみで回答してください（コードブロック不要）：
1. 自学メモ: 自分で調べたことや気づき・感想などのメモが書かれているか
${needsTsubu ? '2. 途中式: 計算過程や解き方の手順が明確に書かれているか' : ''}

合否判定:
${needsTsubu ? '自学メモ と 途中式 の両方がある場合のみ合格。' : '自学メモ があれば合格。'}
写真が不鮮明で判断不能な場合は合格。

{"has_jigaku_memo":true/false,"has_tochushiki":true/false,"pass":true/false,"feedback":"不合格時の具体的なアドバイス（合格は空文字）"}`

  const text = await callAI(prompt, images)
  try {
    const m = text.match(/\{[\s\S]*\}/)
    return JSON.parse(m[0])
  } catch {
    return { pass: true, feedback: '' }
  }
}

export async function generateParentReport(studentName, month, stats) {
  const { submitted, total, tasksDone, homeworkDetails } = stats
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0

  const prompt = `塾の先生アシスタントとして、保護者向け月次レポートを生成してください。

生徒名: ${studentName} / 対象月: ${month}
宿題提出: ${submitted}/${total}件（${rate}%）/ 個人タスク完了: ${tasksDone}件
${homeworkDetails.length > 0 ? `提出した宿題: ${homeworkDetails.join('、')}` : ''}

200字程度・温かく前向きなトーン・保護者が安心できる内容・宛名不要・本文のみ`

  return await callAI(prompt, [])
}
