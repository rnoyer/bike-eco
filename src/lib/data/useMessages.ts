import { useEffect, useState } from "react";
import type { Message } from "@/lib/firestore/schema";
import { messagesFor } from "./fixtures";

export function useMessages(dossierId: string) {
  const [resolved, setResolved] = useState<{ id: string; data: Message[] } | null>(null);
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      if (active) setResolved({ id: dossierId, data: messagesFor(dossierId) });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [dossierId]);
  const loading = resolved?.id !== dossierId;
  return { data: loading ? [] : resolved!.data, loading };
}
