import { describe, expect, it } from "vitest";
import { parseFactorySuggestion } from "@/lib/factory-ai";
import { extractText } from "@/lib/openai";

describe("Factory AI helpers", () => {
  it("parses plain JSON suggestions", () => {
    const parsed = parseFactorySuggestion('{"title":"Workshop","problem":"Baixa adopção"}');
    expect(parsed?.title).toBe("Workshop");
    expect(parsed?.problem).toBe("Baixa adopção");
  });

  it("parses fenced JSON suggestions", () => {
    const parsed = parseFactorySuggestion("```json\n{\\\"title\\\":\\\"Workshop\\\"}\n```");
    expect(parsed?.title).toBe("Workshop");
  });

  it("rejects invalid JSON", () => {
    expect(parseFactorySuggestion("not-json")).toBeNull();
  });

  it("extracts text from Responses API output items", () => {
    const text = extractText({
      output: [
        {
          content: [
            { type: "output_text", text: '{"title":"Workshop"}' },
          ],
        },
      ],
    });
    expect(text).toContain("Workshop");
  });
});
