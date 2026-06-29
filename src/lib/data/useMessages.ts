import { useEffect, useState } from "react";
import type { Message } from "@/lib/firestore/schema";
import { messagesFor } from "./fixtures";

export function useMessages(dossierId: string) {
  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setData(messagesFor(dossierId));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [dossierId]);
  return { data, loading };
}
