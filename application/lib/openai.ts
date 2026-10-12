type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export function openAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openAIModel() {
  return process.env.OPENAI_MODEL || "gpt-6-luna";
}

export function extractText(data: OpenAIResponse) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
    .trim();
}

export async function generateWithOpenAI(input: string, instructions?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");

  const structuredBody = {
    model: openAIModel(),
    input,
    instructions,
    text: {
      format: {
        type: "json_schema",
        name: "pcc_factory_suggestion",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            problem: { type: "string" },
            expected_value: { type: "string" },
            target_user: { type: "string" },
            description: { type: "string" },
            constraints: { type: "string" },
          },
          required: ["title", "problem", "expected_value", "target_user", "description", "constraints"],
        },
      },
    },
  };

  const request = async (body: Record<string, unknown>) =>
    fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await request(structuredBody);

    if (response.ok) {
      const data = (await response.json()) as OpenAIResponse;
      const text = extractText(data);
      if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
      return text;
    }

    lastStatus = response.status;
    lastBody = await response.text();

    if (![500, 502, 503, 504].includes(response.status) || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
  }

  if ([500, 502, 503, 504].includes(lastStatus)) {
    const fallbackResponse = await request({
      model: openAIModel(),
      input,
      instructions: `${instructions ?? ""}\nReturn ONLY valid JSON with keys title, problem, expected_value, target_user, description, constraints. No markdown.`,
    });

    if (fallbackResponse.ok) {
      const data = (await fallbackResponse.json()) as OpenAIResponse;
      const text = extractText(data);
      if (!text) throw new Error("OPENAI_EMPTY_FALLBACK_RESPONSE");
      return text;
    }

    lastStatus = fallbackResponse.status;
    lastBody = await fallbackResponse.text();
  }

  if ([500, 502, 503, 504].includes(lastStatus)) {
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAIModel(),
        messages: [
          ...(instructions ? [{ role: "system", content: instructions }] : []),
          { role: "user", content: input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pcc_factory_suggestion",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                problem: { type: "string" },
                expected_value: { type: "string" },
                target_user: { type: "string" },
                description: { type: "string" },
                constraints: { type: "string" },
              },
              required: ["title", "problem", "expected_value", "target_user", "description", "constraints"],
            },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (chatResponse.ok) {
      const data = (await chatResponse.json()) as ChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("OPENAI_EMPTY_CHAT_FALLBACK_RESPONSE");
      return text;
    }

    lastStatus = chatResponse.status;
    lastBody = await chatResponse.text();
  }

  throw new Error(`OPENAI_ERROR_${lastStatus}: ${lastBody.slice(0, 500)}`);
}
