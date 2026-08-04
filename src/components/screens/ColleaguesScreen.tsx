import ColleagueCard from "@/components/ui/ColleagueCard";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAccount } from "@/lib/data/useAccount";
import { useColleagues } from "@/lib/data/useColleagues";
import { ScrollView } from "react-native";

interface Props {
  /** Opens the management page. Only ever called for an admin viewer. */
  onManage: (uid: string) => void;
}

/** "Mes collaborateurs": the signed-in user's company (or the back-office team),
 *  minus themselves. Only an admin gets the "Gérer" button. */
export default function ColleaguesScreen({ onManage }: Props) {
  const { data: session } = useAccount();
  const { data, loading, error } = useColleagues();
  const canManage = session?.isAdmin === true;

  return (
    <ScrollView>
      <SectionWrapper>
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
      </SectionWrapper>
    </ScrollView>
  );
}
