import { supabase } from "@/lib/supabase";

import {
  type AuditLogRow,
  ensureSupabaseConfigured,
  toAuditLog,
  withLatency,
} from "@/services/shared";

export const auditService = {
  getAll() {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) {
          throw error;
        }

        return ((data ?? []) as AuditLogRow[]).map(toAuditLog);
      })(),
    );
  },
};
