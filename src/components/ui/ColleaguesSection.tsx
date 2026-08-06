import ColleagueCard from "@/components/ui/ColleagueCard";
import Section from "@/components/ui/Section";
import { useColleagues } from "@/lib/data/useColleagues";

interface Props {
  /** Only an admin viewer gets the per-card "Gérer" button. */
  canManage: boolean;
  /** Opens the management page. Only ever called for an admin viewer. */
  onManage: (uid: string) => void;
}

/** "Mes collaborateurs" as rendered inside Paramètres: the signed-in user's
 *  company (b2b) or the Bike-eco team (back-office), minus themselves. Fetches
 *  its own list, like the other per-section lists. */
export default function ColleaguesSection({ canManage, onManage }: Props) {
  const { data, loading, error } = useColleagues();

  return (
    <Section
      title="Mes collaborateurs"
      loading={loading}
      error={error}
      emptyMessage="Aucun collaborateur pour le moment."
    >
      {data.map((u) => (
        <ColleagueCard
          key={u.id}
          user={u}
          actionLabel={canManage ? "Gérer" : undefined}
          onAction={canManage ? () => onManage(u.id) : undefined}
        />
      ))}
    </Section>
  );
}
