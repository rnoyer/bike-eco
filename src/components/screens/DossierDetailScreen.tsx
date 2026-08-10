import DossierMuteButton from "@/components/ui/DossierMuteButton";
import InfoCard from "@/components/ui/InfoCard";
import InfoCollapsibleRow from "@/components/ui/InfoCollapsibleRow";
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
  hasMateriel,
  isOui,
  kilometres,
  ouiNon,
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
  // status / prix validé / région re-renders this with no extra wiring.
  return (
    <InfoCard title="Informations Dossier">
      <InfoRows
        rows={[
          ["Date de soumission", submittedAt(dossier.createdAt)],
          ["Statut", statusLabel(status)],
          ["Prix validé", euros(dossier.validatedPrice)],
          ["Région", regionLabel(dossier.region)],
        ]}
      />
    </InfoCard>
  );
}

function VehicleCard({ dossier }: { dossier: Dossier }) {
  const { vehicle, keys, condition, papers, pricing } = dossier;
  return (
    <InfoCard title="Informations véhicule">
      <InfoRows
        rows={[
          // The number a reader looks for first, so it leads the card.
          ["Prix souhaité", euros(pricing.prix)],
          ["Marque", vehicle.marque],
          // The B2B funnel — the only source of dossiers — collects model and
          // displacement in one "Modèle et Cylindrée" field, so they are one
          // row and `vehicle.cylindree` is always null and never rendered.
          ["Modèle et Cylindrée", vehicle.modele],
          // `InfoRows` dashes empty values itself; `dash()` here is what turns a
          // non-string field into the `[label, value]` pair's string.
          ["Année", dash(vehicle.annee)],
          ["Kilométrage", kilometres(vehicle.kilometrage)],
        ]}
      />
      <InfoCollapsibleRow
        label="Électrique"
        value={vehicle.electrique}
        rows={
          isOui(vehicle.electrique)
            ? [
                // `materiel` stores the funnel's checkbox labels; `hasMateriel`
                // owns that coupling so this stays readable.
                [
                  "Batterie présente",
                  ouiNon(hasMateriel(vehicle.materiel, "batterie")),
                ],
                [
                  "Chargeur présent",
                  ouiNon(hasMateriel(vehicle.materiel, "chargeur")),
                ],
              ]
            : null
        }
      />
      <InfoRows rows={[["État", dash(condition.etat)]]} />
      {/* Free text, and only ever filled for this one état — `etat` is typed
          `EtatVehicule | null`, so a typo in the literal fails to compile. */}
      {condition.etat === "En Panne" ? (
        <InfoComment label="Nature de la panne" text={condition.naturePanne} />
      ) : null}
      <InfoCollapsibleRow
        label="Carte grise"
        value={papers.carteGrise}
        rows={
          isOui(papers.carteGrise)
            ? [["À votre nom", dash(papers.carteGriseAVotreNom)]]
            : null
        }
      />
      <InfoCollapsibleRow
        label="Contrôle technique"
        value={papers.controleTechnique}
        rows={
          isOui(papers.controleTechnique)
            ? [
                ["Moins de 6 mois", dash(papers.ctMoins6Mois)],
                ["Résultat obtenu", dash(papers.resultatCT)],
              ]
            : null
        }
      />
      <InfoRows
        rows={[
          ["Certificat de non-gage", dash(papers.certificatNonGage)],
          ["Carnet d'entretien", dash(papers.carnetEntretien)],
          ["Facture d'entretien", dash(papers.factureEntretien)],
        ]}
      />
      <InfoCollapsibleRow
        label="Clés de contact"
        value={keys.aClesContact}
        rows={
          isOui(keys.aClesContact)
            ? [
                // `dash(0)` is "0", not "—": zero keys of a colour is an answer.
                ["Clé noire", dash(keys.cleNoire)],
                ["Clé marron", dash(keys.cleMarron)],
                ["Clé rouge", dash(keys.cleRouge)],
              ]
            : null
        }
      />
      <InfoCollapsibleRow
        label="Télécommande ou Bip"
        value={keys.aTelecommande}
        rows={
          isOui(keys.aTelecommande)
            ? [["Nombre", dash(keys.telecommande)]]
            : null
        }
      />
      {/* `vehicle.accessoires` holds the funnel's step-2 "Commentaires (Ex. État
          de la moto)". The B2B funnel collects no accessories at all, so the row
          is labelled for what the field actually contains. */}
      <InfoComment label="Commentaires véhicule" text={vehicle.accessoires} />
      <InfoComment
        label="Commentaires complémentaire"
        text={pricing.commentaires}
      />
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

function LoadedDossier({
  id,
  dossier,
  role,
}: {
  id: string;
  dossier: Dossier;
  role: UserRole;
}) {
  // Projected once here: the badge over the carousel and the "Statut" row must
  // never disagree about what this role is shown.
  const status = viewerStatus(dossier.status, role);
  return (
    <>
      <PhotoCarousel
        photos={dossier.photos}
        status={status}
        topLeft={<DossierMuteButton dossierId={id} />}
      />
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
  /** Drives card order and the status projection (`viewerStatus`): the back
   *  office reads the vehicle first, a b2b user follows up on their own
   *  submission's status first — and never sees `a_traiter`. */
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
        <LoadedDossier id={id} dossier={data} role={role} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { ...tokens.text.title },
});
