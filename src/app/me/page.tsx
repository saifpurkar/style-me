"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User, AuthError } from "@supabase/supabase-js";

type UserInfo = {
  user: User | null;
  error: AuthError | null;
};

export default function MePage() {
  const [info, setInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      setInfo({ user, error });
    })();
  }, []);

  return (
    <pre style={{ padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "auto" }}>
      {JSON.stringify(info, null, 2)}
    </pre>
  );
}
