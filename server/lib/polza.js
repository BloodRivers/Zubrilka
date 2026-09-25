const POLZA_BASE = process.env.POLZA_BASE_URL || "https://api.polza.ai";
const POLZA_KEY = process.env.POLZA_API_KEY;
const POLZA_MODEL = process.env.POLZA_MODEL || "anthropic/claude-sonnet-4.5";

export function parseModelJson(content) {
  return JSON.parse(
    String(content || "")
      .replace(/^```(json)?\s*|\s*```$/g, "")
      .trim(),
  );
}

export async function callPolza({ system, messages, imageDataUrl, maxTokens = 2000 }) {
  if (!POLZA_KEY) throw new Error("POLZA_API_KEY not set");

  const body = {
    model: POLZA_MODEL,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }],
  };

  if (imageDataUrl) {
    body.messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageDataUrl } },
        { type: "text", text: String(messages || "") },
      ],
    });
  } else {
    body.messages.push(...messages);
  }

  const res = await fetch(`${POLZA_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${POLZA_KEY}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polza API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const usage = json.usage || { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 };
  return { content: json.choices?.[0]?.message?.content || "", usage };
}
