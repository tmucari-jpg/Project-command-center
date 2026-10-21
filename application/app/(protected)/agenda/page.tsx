import { redirect } from "next/navigation";

export default function AgendaPage() {
  redirect("/actions?view=today");
}
