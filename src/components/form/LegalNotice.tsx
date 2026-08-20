import { Linking, StyleSheet, Text } from "react-native";

import { LEGAL_URLS } from "@/constants/legal";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";

interface Props {
  /** The primary button's label, quoted in the sentence: "En cliquant sur
   *  Envoyer, …". Keep it in step with `FormLayout`'s `nextLabel`. */
  action: "Envoyer" | "S'inscrire";
}

function openLegal(url: string) {
  // Never gated on `canOpenURL` — see `bike-eco-ui`. The real failure surfaces
  // as a rejection.
  Linking.openURL(url).catch(() =>
    alertDialog("Lien indisponible", "Impossible d'ouvrir ce document."),
  );
}

/**
 * The acceptance notice shown on the last step of the funnels that create an
 * account or send a request. Lives in `FormLayout`'s `footer`, so it sits at the
 * end of the form, directly above Précédent / Envoyer.
 *
 * The links are nested `Text`, not `Pressable`s: they have to flow inline with
 * the sentence, which a wrapped touchable would break onto its own line.
 */
export default function LegalNotice({ action }: Props) {
  return (
    <Text style={styles.notice}>
      En cliquant sur {action}, vous acceptez les{" "}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => openLegal(LEGAL_URLS.cgu)}
      >
        Conditions d&apos;utilisation
      </Text>{" "}
      et la{" "}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => openLegal(LEGAL_URLS.confidentialite)}
      >
        Politique de confidentialité
      </Text>{" "}
      de Bike-eco.
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 13,
    lineHeight: 18,
    color: tokens.colors.muted,
  },
  // Underlined rather than coloured: `brand` is ~2.3:1 on a light surface, so
  // the underline is what marks these as links.
  link: {
    textDecorationLine: "underline",
  },
});
