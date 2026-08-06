import DossierCard from "@/components/ui/DossierCard";
import DossiersSection from "@/components/ui/DossiersSection";
import PendingCompaniesBanner from "@/components/ui/PendingCompaniesBanner";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useDossiers } from "@/lib/data/useDossiers";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { WithId } from "@/lib/firestore/collections";
import type { Dossier, UserRole } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

interface Props {
  role: UserRole;
  onOpenDossier: (id: string) => void;
  onSell?: () => void;
  onOpenCompanies?: () => void;
}

export default function DashboardScreen({
  role,
  onOpenDossier,
  onSell,
  onOpenCompanies,
}: Props) {
  const { region, ready } = useRegionFilter();
  const isBackoffice = role === "backoffice";
  const filter = isBackoffice ? region : undefined;
  const aTraiter = useDossiers(["a_traiter"], filter);
  const enCours = useDossiers(["en_cours"], filter);
  const closed = useDossiers(["cloture"], filter);

  // The back-office lists are région-scoped, so they are not settled until the
  // stored région has hydrated: rendering the "Toute la France" result first
  // and re-querying a moment later is a visible flicker. B2B dossiers are
  // company-scoped and ignore the région entirely.
  const hydrating = isBackoffice && !ready;

  if (isBackoffice) {
    const card = (d: WithId<Dossier>) => {
      const vehicle = `${d.vehicle.marque} ${d.vehicle.modele}`;
      return (
        <DossierCard
          key={d.id}
          thumbnailUrl={d.thumbnailUrl}
          title={`${d.submitter.companyName} - ${d.submitter.prenom} ${d.submitter.nom}`}
          subtitle={
            d.validatedPrice !== null
              ? `Prix validé : ${d.validatedPrice} € - ${vehicle}`
              : vehicle
          }
          onPress={() => onOpenDossier(d.id)}
        />
      );
    };
    return (
      <ScrollView>
        <SectionWrapper>
          {onOpenCompanies ? (
            <PendingCompaniesBanner onPress={onOpenCompanies} />
          ) : null}
          <DossiersSection
            title="Dossiers à traiter"
            dossiers={aTraiter.data}
            loading={hydrating || aTraiter.loading}
            error={aTraiter.error}
            emptyMessage="Vous n'avez pas de dossier à traiter pour le moment."
            renderCard={card}
          />
          <DossiersSection
            title="Dossiers en cours"
            dossiers={enCours.data}
            loading={hydrating || enCours.loading}
            error={enCours.error}
            emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
            renderCard={card}
          />
          <DossiersSection
            title="Dossiers clos"
            dossiers={closed.data}
            loading={hydrating || closed.loading}
            error={closed.error}
            emptyMessage="Vous n'avez pas de dossier clos pour le moment."
            renderCard={card}
          />
        </SectionWrapper>
      </ScrollView>
    );
  }

  const ongoing = [...aTraiter.data, ...enCours.data].sort(
    (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis(),
  );
  const card = (d: WithId<Dossier>) => (
    <DossierCard
      key={d.id}
      thumbnailUrl={d.thumbnailUrl}
      title={`${d.vehicle.marque} ${d.vehicle.modele}`}
      subtitle={
        d.validatedPrice !== null
          ? `Prix validé : ${d.validatedPrice} €`
          : undefined
      }
      onPress={() => onOpenDossier(d.id)}
    />
  );
  return (
    <ScrollView>
      <SectionWrapper>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={onSell}
        >
          <Text style={styles.ctaText}>Vendre une moto</Text>
        </TouchableOpacity>
        <DossiersSection
          title="Dossiers en cours"
          dossiers={ongoing}
          loading={aTraiter.loading || enCours.loading}
          error={aTraiter.error ?? enCours.error}
          emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
          renderCard={card}
        />
        <DossiersSection
          title="Dossiers clos"
          dossiers={closed.data}
          loading={closed.loading}
          error={closed.error}
          emptyMessage="Vous n'avez pas de dossier clos pour le moment."
          renderCard={card}
        />
      </SectionWrapper>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cta: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: tokens.colors.primaryText,
    fontSize: 16,
    fontWeight: "700",
  },
});
