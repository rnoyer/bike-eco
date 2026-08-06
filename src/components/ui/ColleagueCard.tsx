import EntityCard from "@/components/ui/EntityCard";
import { roleLabel } from "@/lib/data/colleagues";
import type { WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";

interface Props {
  user: WithId<AppUser>;
  /** Omit both to render the card without a button (non-admin viewer). */
  actionLabel?: string;
  onAction?: () => void;
}

/** A colleague in a list: "[Nom] [Prénom]" over "Rôle: […]". */
export default function ColleagueCard({ user, actionLabel, onAction }: Props) {
  return (
    <EntityCard
      title={`${user.nom} ${user.prenom}`}
      subtitle={`Rôle: ${roleLabel(user)}`}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
