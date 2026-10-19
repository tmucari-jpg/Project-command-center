import { dependencyOwner, type DependencyKind, type DependencyOwner } from "@/lib/autofill-policy";

export type GovernanceDependencyStatus = "pending" | "resolving" | "resolved" | "confirmed";

export function governanceDependencyOwner(
  kind: DependencyKind,
  canPccResolve: boolean,
): DependencyOwner {
  return dependencyOwner(kind, canPccResolve);
}

export function governanceDependencyBlocksProgress(
  status: GovernanceDependencyStatus,
  blocksProgress: boolean,
) {
  return blocksProgress && !["resolved", "confirmed"].includes(status);
}
