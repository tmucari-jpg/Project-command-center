type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export function openAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openAIModel() {
  return process.env.OPENAI_MODEL || "gpt-6-luna";
}

function extractText(data: OpenAIResponse) {
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAIModel(),
      input,
      instructions,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OPENAI_ERROR_${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = extractText(data);
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return text;
}
