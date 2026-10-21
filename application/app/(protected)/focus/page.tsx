import { redirect } from "next/navigation";

export default function FocusPage() {
  redirect("/actions?view=attention");
}
