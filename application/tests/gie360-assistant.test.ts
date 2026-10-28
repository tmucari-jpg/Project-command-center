import { describe, it, expect } from "vitest";
import { parseGIE360Answer, type GIESource } from "@/lib/gie360-assistant";
const sources: GIESource[] = [{ ref: "answer:costs", label: "Custos", validation: "declared", content: "Não sei os custos. Conversão 0%." }, { ref: "batch:approved", label: "Lote aprovado", validation: "approved", content: "MZN 120 de vendas; lucro indisponível." }];
describe("GIE360 factual assistant", () => {
  it("keeps declared data distinct and preserves observed zero", () => {
    const answer = parseGIE360Answer(JSON.stringify({ facts: [{ source_ref: "answer:costs", quote: "Conversão 0%." }], suggestions: [], missing_information: ["Custos documentados"] }), sources);
    expect(answer.facts[0].validation).toBe("declared");
    expect(answer.facts[0].quote).toBe("Conversão 0%.");
    expect(answer.mode).toBe("analysis_only");
  });
  it("rejects invented profit and fabricated citations", () => {
    expect(() => parseGIE360Answer(JSON.stringify({ facts: [{ source_ref: "batch:approved", quote: "Lucro de MZN 120" }], suggestions: [], missing_information: [] }), sources)).toThrow("UNGROUNDED");
    expect(() => parseGIE360Answer(JSON.stringify({ facts: [{ source_ref: "other-company", quote: "MZN 120" }], suggestions: [], missing_information: [] }), sources)).toThrow();
    expect(() => parseGIE360Answer(JSON.stringify({ facts: [], suggestions: [{ text: "Rever custos", source_refs: ["other-company"] }], missing_information: [] }), sources)).toThrow("UNKNOWN_SOURCE");
  });
  it("rejects operations from a prompt injection or malformed output", () => {
    expect(() => parseGIE360Answer(JSON.stringify({ facts: [], suggestions: [], missing_information: [], operations: [{ kind: "approve" }] }), sources)).toThrow();
    expect(() => parseGIE360Answer("Resposta sem evidência", sources)).toThrow();
  });
});
