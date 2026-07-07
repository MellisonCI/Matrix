import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TOOLS, executeTool } from '@/lib/ask-tools'

const SYSTEM_PROMPT = `You are a research assistant for Corporate Insight's Matrix Dashboard, which tracks digital banking capabilities and account products across major US banks. Answer the user's question using only the provided tools -- never answer from general knowledge about what banks typically offer. Look up the real data first, then answer concisely and specifically, citing the firms/features you found. If a search tool returns no good match, try a different keyword before giving up.`

const MAX_TOOL_ITERATIONS = 8

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 500 })
  }

  const { question } = await req.json()
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 })
  }

  const client = new Anthropic()
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        tools: TOOLS,
        messages,
      })

      if (response.stop_reason !== 'tool_use') {
        const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text || ''
        return NextResponse.json({ answer: text })
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        try {
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        } catch (e) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: e instanceof Error ? e.message : String(e),
            is_error: true,
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({ error: 'Ran out of lookups without reaching an answer -- try a more specific question.' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
