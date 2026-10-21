import { redirect } from "next/navigation";

export default function LegacyOperationalRedirect() {
  redirect("/actions?view=attention");
}
