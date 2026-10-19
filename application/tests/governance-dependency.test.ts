import { describe, expect, it } from "vitest";
import {
  governanceDependencyBlocksProgress,
  governanceDependencyOwner,
} from "@/lib/governance-dependency";

describe("governance dependencies", () => {
  it("keeps decisions with the project owner", () => {
    expect(governanceDependencyOwner("decision", true)).toBe("project_owner");
  });

  it("assigns resolvable information to PCC", () => {
    expect(governanceDependencyOwner("information", true)).toBe("pcc");
    expect(governanceDependencyOwner("validation", true)).toBe("pcc");
  });

  it("assigns unresolved human-only information to owner", () => {
    expect(governanceDependencyOwner("confirmation", false)).toBe("project_owner");
  });

  it("blocks only while an explicit blocking dependency remains unresolved", () => {
    expect(governanceDependencyBlocksProgress("pending", true)).toBe(true);
    expect(governanceDependencyBlocksProgress("resolving", true)).toBe(true);
    expect(governanceDependencyBlocksProgress("resolved", true)).toBe(false);
    expect(governanceDependencyBlocksProgress("confirmed", true)).toBe(false);
  });
});
