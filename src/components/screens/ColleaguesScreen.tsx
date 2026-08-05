import ColleagueCard from "@/components/ui/ColleagueCard";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAccount } from "@/lib/data/useAccount";
import { useColleagues } from "@/lib/data/useColleagues";
import { useUser } from "@/lib/data/useUser";
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
  // Live rather than the AuthProvider snapshot taken at sign-in, so a
  // promotion/demotion reaches this gate without an app restart. Falls back
  // to the session's value while the live read is loading, so nothing
  // flickers into a more-permissive state.
  const { data: viewer, loading: viewerLoading } = useUser(session?.id ?? "");
  const canManage = viewerLoading
    ? session?.isAdmin === true
    : viewer?.isAdmin === true;

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
