import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollectionClient } from "@/components/collection/CollectionClient";

export default async function CollectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: collection } = await supabase.rpc("get_user_collection", {
    p_user_id: user.id,
  });

  return <CollectionClient initialCollection={collection ?? []} />;
}
