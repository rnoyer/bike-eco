import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
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
  },
  email: {
    label: "Email",
    icon: mailIcon,
    href: (value: string) => `mailto:${value.trim()}`,
    a11y: (value: string) => `Écrire à ${value}`,
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
  const { label, icon, href, a11y } = CONTACT[kind];
  const url = value ? href(value) : null;

  // Checked rather than assumed: a simulator, or a tablet with no dialer or
  // mail client, returns false — and the button would then be a dead tap. The
  // row degrades to plain text instead.
  const [canOpen, setCanOpen] = useState(false);
  useEffect(() => {
    if (!url) return;
    let active = true;
    Linking.canOpenURL(url)
      .then((ok) => {
        if (active) setCanOpen(ok);
      })
      .catch(() => {
        if (active) setCanOpen(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label} :</Text>
      <Text style={styles.value}>{dash(value)}</Text>
      {url && canOpen ? (
        <Pressable
          onPress={() => void Linking.openURL(url)}
          hitSlop={12}
          accessibilityRole="button"
          // Icon-only, so without this the button is unreachable by a screen
          // reader.
          accessibilityLabel={a11y(value!)}
          style={styles.button}
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
  button: { paddingLeft: tokens.space.sm },
  icon: { width: 22, height: 22 },
});
