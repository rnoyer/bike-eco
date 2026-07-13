import FormConfirmation from "@/components/form/FormConfirmation";

interface Props {
  onDone: () => void;
}

/** Terminal screen shown after the b2c funnel is submitted (spec step 10). */
export default function SubmissionConfirmation({ onDone }: Props) {
  return (
    <FormConfirmation
      title="Demande envoyée !"
      message="Un email récapitulatif va vous parvenir. Vous serez recontacté très prochainement par notre équipe."
      buttonLabel="Retour à l'accueil"
      onDone={onDone}
    />
  );
}
