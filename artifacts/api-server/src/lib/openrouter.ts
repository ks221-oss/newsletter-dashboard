// Thin client for OpenRouter's OpenAI-compatible chat completions API.
// Docs: https://openrouter.ai/docs/api-reference/chat-completion

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

// Same model the dashboard used when it called Anthropic directly.
// Override with OPENROUTER_MODEL (any id from https://openrouter.ai/models).
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export function getOpenRouterKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || undefined;
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

interface ChatOptions {
  apiKey: string;
  system?: string;
  user: string;
  maxTokens: number;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; code?: number | string };
}

export async function chatCompletion({ apiKey, system, user, maxTokens, timeoutMs = 180_000 }: ChatOptions): Promise<string> {
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: user },
  ];

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional attribution headers shown in the OpenRouter dashboard.
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://together.fund",
      "X-Title": "Newsletter Dashboard",
    },
    body: JSON.stringify({ model: getOpenRouterModel(), max_tokens: maxTokens, messages }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let data: ChatCompletionResponse;
  try {
    data = JSON.parse(text) as ChatCompletionResponse;
  } catch {
    throw new Error(`OpenRouter returned ${res.status} with a non-JSON body: ${text.slice(0, 200)}`);
  }

  // OpenRouter can report errors with a 200 status, so check the body too.
  if (!res.ok || data.error) {
    throw new Error(`OpenRouter error ${data.error?.code ?? res.status}: ${data.error?.message ?? text.slice(0, 200)}`);
  }

  return data.choices?.[0]?.message?.content ?? "";
}
