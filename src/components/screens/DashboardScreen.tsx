import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import DossierCard from "@/components/ui/DossierCard";
import DossiersSection from "@/components/ui/DossiersSection";
import type { WithId } from "@/lib/data/fixtures";
import { useDossiers } from "@/lib/data/useDossiers";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { Dossier, UserRole } from "@/lib/firestore/schema";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

interface Props {
  role: UserRole;
  onOpenDossier: (id: string) => void;
  onSell?: () => void;
}

export default function DashboardScreen({ role, onOpenDossier, onSell }: Props) {
  const { region } = useRegionFilter();
  const filter = role === "backoffice" ? region : undefined;
  const aTraiter = useDossiers(["a_traiter"], filter);
  const enCours = useDossiers(["en_cours"], filter);
  const closed = useDossiers(["cloture"], filter);

  if (role === "backoffice") {
    const card = (d: WithId<Dossier>) => (
      <DossierCard
        key={d.id}
        thumbnailUrl={d.thumbnailUrl}
        title={`${d.submitter.companyName} - ${d.submitter.prenom} ${d.submitter.nom}`}
        subtitle={`${d.vehicle.marque} ${d.vehicle.modele}`}
        onPress={() => onOpenDossier(d.id)}
      />
    );
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Stack.Screen options={headerOptions({ title: "Dashboard", back: false })} />
        <DossiersSection
          title="Dossiers à traiter"
          dossiers={aTraiter.data}
          loading={aTraiter.loading}
          emptyMessage="Vous n'avez pas de dossier à traiter pour le moment."
          renderCard={card}
        />
        <DossiersSection
          title="Dossiers en cours"
          dossiers={enCours.data}
          loading={enCours.loading}
          emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
          renderCard={card}
        />
        <DossiersSection
          title="Dossiers clos"
          dossiers={closed.data}
          loading={closed.loading}
          emptyMessage="Vous n'avez pas de dossier clos pour le moment."
          renderCard={card}
        />
      </ScrollView>
    );
  }

  const ongoing = [...aTraiter.data, ...enCours.data].sort(
    (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()
  );
  const card = (d: WithId<Dossier>) => (
    <DossierCard
      key={d.id}
      thumbnailUrl={d.thumbnailUrl}
      title={`${d.vehicle.marque} ${d.vehicle.modele}`}
      subtitle={`${d.vehicle.cylindree ?? "—"} cc`}
      onPress={() => onOpenDossier(d.id)}
    />
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Dashboard", back: false })} />
      <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onSell}>
        <Text style={styles.ctaText}>Vendre une moto</Text>
      </TouchableOpacity>
      <DossiersSection
        title="Dossiers en cours"
        dossiers={ongoing}
        loading={aTraiter.loading || enCours.loading}
        emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
        renderCard={card}
      />
      <DossiersSection
        title="Dossiers clos"
        dossiers={closed.data}
        loading={closed.loading}
        emptyMessage="Vous n'avez pas de dossier clos pour le moment."
        renderCard={card}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
  cta: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: tokens.colors.primaryText, fontSize: 16, fontWeight: "700" },
});
