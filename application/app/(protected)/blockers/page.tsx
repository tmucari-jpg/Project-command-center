import { redirect } from "next/navigation";

export default function BlockersPage() {
  redirect("/actions?view=blocked");
}
