"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function gie360ClientLogin(formData: FormData) {
  const email=String(formData.get("email") ?? "").trim();
  const password=String(formData.get("password") ?? "");
  const next=String(formData.get("next") ?? "/gie-client");

  // Only GIE project destinations are accepted. Never let a link into the
  // external client login redirect the user to PCC administrative routes.
  const permitted=/^\/gie-client\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(next);
  const destination=permitted ? next : "/gie-client";
  const errorDestination="/gie-login?next="+encodeURIComponent(destination)+"&error=1";

  if (!/^\S+@\S+\.\S+$/.test(email) || password.length<8) redirect(errorDestination);
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if (error || !data.user) redirect(errorDestination);

  const {data:memberships,error:membershipError}=await supabase
    .from("gie360_memberships").select("organization_id")
    .eq("client_user_id",data.user.id).limit(1);
  if (membershipError || !memberships?.length) {
    await supabase.auth.signOut();
    redirect("/gie-login?error=access");
  }

  redirect(destination);
}
