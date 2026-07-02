import { useState } from "react";
import type { UserRole, AppUser } from "@/lib/firestore/schema";
import { MOCK_USERS, type WithId } from "./fixtures";

/** Stubbed session. `setRole` flips identity so both groups are previewable. */
export function useSession() {
  const [role, setRole] = useState<UserRole>("b2b");
  const user = MOCK_USERS.find((u) => u.role === role) as WithId<AppUser>;
  return { role, user, setRole };
}
