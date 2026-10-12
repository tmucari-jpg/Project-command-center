import { displayLabel } from "@/lib/display-label";

const tone: Record<string, string> = {
  active: "bg-[#E8F3EF] text-[#146453] ring-[#146453]/20",
  on_track: "bg-[#E8F3EF] text-[#146453] ring-[#146453]/20",
  completed: "bg-[#E8F3EF] text-[#146453] ring-[#146453]/20",
  resolved: "bg-[#E8F3EF] text-[#146453] ring-[#146453]/20",

  at_risk: "bg-[#FBF3E4] text-[#8A611C] ring-[#C99439]/28",
  investigating: "bg-[#FBF3E4] text-[#8A611C] ring-[#C99439]/28",

  pending: "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]",
  draft: "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]",
  idea: "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]",
  captured: "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]",
  waiting: "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]",

  delayed: "bg-[#FCECE9] text-[#A33A30] ring-[#C94B3C]/22",
  blocked: "bg-[#FCECE9] text-[#A33A30] ring-[#C94B3C]/22",
  open: "bg-[#FCECE9] text-[#A33A30] ring-[#C94B3C]/22",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        tone[status] ?? "bg-[#F3F6F4] text-[#667085] ring-[#E0E8E3]"
      }`}
    >
      {displayLabel(status)}
    </span>
  );
}
