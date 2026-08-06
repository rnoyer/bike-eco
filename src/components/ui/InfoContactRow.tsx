import { alertDialog } from "@/lib/ui/dialog";
import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import mailIcon from "@/assets/images/icons/mail.svg";
import phoneIcon from "@/assets/images/icons/phone.svg";

type Kind = "phone" | "email";

/** `kind` drives the label, the icon and the URL scheme, so a caller only ever
 *  passes the raw value from the document. */
const CONTACT = {
  phone: {
    label: "Téléphone",
    icon: phoneIcon,
    // The href drops spaces so "06 01 02 03 04" still dials; the *displayed*
    // value keeps its formatting.
    href: (value: string) => `tel:${value.replace(/\s/g, "")}`,
    a11y: (value: string) => `Appeler ${value}`,
    failure: "Aucune application de téléphone n’est disponible sur cet appareil.",
  },
  email: {
    label: "Email",
    icon: mailIcon,
    href: (value: string) => `mailto:${value.trim()}`,
    a11y: (value: string) => `Écrire à ${value}`,
    failure: "Aucune application de messagerie n’est disponible sur cet appareil.",
  },
} as const satisfies Record<Kind, unknown>;

/**
 * The "information avec action button" part of an `InfoCard`: a label/value row
 * whose value is followed by a right-aligned icon button opening the OS dialer
 * or mail client.
 */
export default function InfoContactRow({
  kind,
  value,
}: {
  kind: Kind;
  value: string | null | undefined;
}) {
  const { label, icon, href, a11y, failure } = CONTACT[kind];
  const url = value ? href(value) : null;

  // Deliberately NOT gated on `Linking.canOpenURL`. On Android that check is
  // `Intent.resolveActivity`, which package visibility filters out from API 30
  // up unless the app declares a `<queries>` entry for the scheme — so it
  // answers `false` for `tel:` / `mailto:` and the button vanished on device
  // while showing fine on web. Package visibility does not restrict
  // `startActivity`, so `openURL` itself works: render the button and handle
  // the genuine "nothing can open this" case in the rejection.
  const open = () => {
    if (!url) return;
    Linking.openURL(url).catch(() => alertDialog(label, failure));
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label} :</Text>
      <Text style={styles.value}>{dash(value)}</Text>
      {url ? (
        <Pressable
          onPress={open}
          hitSlop={8}
          accessibilityRole="button"
          // Icon-only, so without this the button is unreachable by a screen
          // reader.
          accessibilityLabel={a11y(value!)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Image
            source={icon}
            style={styles.icon}
            tintColor={tokens.colors.primary}
            contentFit="contain"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  // Takes the slack so the button sits on the right edge, and wraps rather than
  // pushing the button out of the card.
  value: { fontSize: 14, color: tokens.colors.primary, flex: 1 },
  button: {
    padding: tokens.space.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
  },
  pressed: { backgroundColor: tokens.colors.surfaceAlt },
  icon: { width: 22, height: 22 },
});
