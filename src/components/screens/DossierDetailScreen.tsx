import InfoCard from "@/components/ui/InfoCard";
import InfoComment from "@/components/ui/InfoComment";
import InfoContactRow from "@/components/ui/InfoContactRow";
import InfoRows from "@/components/ui/InfoRows";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import ScreenMessage from "@/components/ui/ScreenMessage";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { useDossier } from "@/lib/data/useDossier";
import type { Dossier, DossierStatus, UserRole } from "@/lib/firestore/schema";
import {
  dash,
  euros,
  kilometres,
  regionLabel,
  statusLabel,
  submittedAt,
  viewerStatus,
} from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { ScrollView, StyleSheet, Text } from "react-native";

function DossierCard({
  dossier,
  status,
}: {
  dossier: Dossier;
  /** The viewer's status, already projected by role — not `dossier.status`. */
  status: DossierStatus;
}) {
  // Straight off the live `useDossier` snapshot, so a back-office update to
  // status / prix négocié / région re-renders this with no extra wiring.
  return (
    <InfoCard title="Informations Dossier">
      <InfoRows
        rows={[
          ["Date de soumission", submittedAt(dossier.createdAt)],
          ["Statut", statusLabel(status)],
          ["Prix négocié", euros(dossier.negotiatedPrice)],
          ["Région", regionLabel(dossier.region)],
        ]}
      />
    </InfoCard>
  );
}

function VehicleCard({ dossier }: { dossier: Dossier }) {
  const { vehicle, condition, papers, pricing } = dossier;
  return (
    <InfoCard title="Informations véhicule">
      <InfoRows
        rows={[
          ["Marque", vehicle.marque],
          // The B2B funnel — the only source of dossiers — collects model and
          // displacement in one "Modèle et Cylindrée" field, so they are one row.
          ["Modèle et Cylindrée", vehicle.modele],
          // `InfoRows` dashes empty values itself; `dash()` here is what turns a
          // non-string field into the `[label, value]` pair's string.
          ["Année", dash(vehicle.annee)],
          ["Kilométrage", kilometres(vehicle.kilometrage)],
          ["Électrique", vehicle.electrique],
        ]}
      />
      <InfoComment label="Accessoires" text={vehicle.accessoires} />
      <InfoRows
        rows={[
          ["État", dash(condition.etat)],
          ["Carte grise", dash(papers.carteGrise)],
          ["Contrôle technique", dash(papers.controleTechnique)],
          ["Prix souhaité", euros(pricing.prix)],
        ]}
      />
      <InfoComment label="Commentaires" text={pricing.commentaires} />
    </InfoCard>
  );
}

function SellerCard({ dossier }: { dossier: Dossier }) {
  const { submitter } = dossier;
  // Read from the denormalized `submitter`, never from `users/{uid}`: a deleted
  // colleague's user doc is removed while their dossiers are kept, so this copy
  // is the only value guaranteed to still exist.
  return (
    <InfoCard title="Informations vendeur">
      <InfoRows
        rows={[
          ["Entreprise", submitter.companyName],
          ["Nom", submitter.nom],
          ["Prénom", submitter.prenom],
        ]}
      />
      <InfoContactRow kind="phone" value={submitter.telephone} />
      <InfoContactRow kind="email" value={submitter.email} />
    </InfoCard>
  );
}

function LoadedDossier({ dossier, role }: { dossier: Dossier; role: UserRole }) {
  // Projected once here: the badge over the carousel and the "Statut" row must
  // never disagree about what this role is shown.
  const status = viewerStatus(dossier.status, role);
  return (
    <>
      <PhotoCarousel photos={dossier.photos} status={status} />
      <SectionWrapper>
        <Text style={styles.heading}>
          {dossier.vehicle.marque} {dossier.vehicle.modele}
        </Text>
        {role === "b2b" ? (
          <DossierCard dossier={dossier} status={status} />
        ) : null}
        <VehicleCard dossier={dossier} />
        <SellerCard dossier={dossier} />
        {role === "backoffice" ? (
          <DossierCard dossier={dossier} status={status} />
        ) : null}
      </SectionWrapper>
    </>
  );
}

export default function DossierDetailScreen({
  id,
  role,
}: {
  id: string;
  /** Drives card order only: the back office reads the vehicle first, a b2b
   *  user follows up on their own submission's status first. */
  role: UserRole;
}) {
  const { data, loading, error } = useDossier(id);
  return (
    <ScrollView>
      {loading ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Dossier introuvable." />
      ) : (
        <LoadedDossier dossier={data} role={role} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { ...tokens.text.title },
});
