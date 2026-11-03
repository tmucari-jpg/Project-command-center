import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Never remap client identities to a PCC workspace owner. */
export async function requireGIE360User() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/gie360/login");
  return { supabase, user };
}
