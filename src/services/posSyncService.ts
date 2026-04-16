import { supabase } from "@/lib/supabase";
import type { PosSyncLog } from "@/types";

import { ensureSupabaseConfigured, withLatency } from "@/services/shared";

type PosSyncLogRow = {
  id: string;
  source: string | null;
  event_id: string | null;
  event_type: string | null;
  order_external_id: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: PosSyncLog["status"] | null;
  error_message: string | null;
  customer_id: string | null;
  transaction_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

function toPosSyncLog(row: PosSyncLogRow): PosSyncLog {
  return {
    id: row.id,
    source: row.source ?? "pos",
    event_id: row.event_id ?? "",
    event_type: row.event_type ?? "order.created",
    order_external_id: row.order_external_id,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    status: row.status ?? "received",
    error_message: row.error_message,
    customer_id: row.customer_id,
    transaction_id: row.transaction_id,
    processed_at: row.processed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const posSyncService = {
  getLogs(limit = 100) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("pos_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          throw error;
        }

        return ((data ?? []) as PosSyncLogRow[]).map(toPosSyncLog);
      })(),
    );
  },
};
