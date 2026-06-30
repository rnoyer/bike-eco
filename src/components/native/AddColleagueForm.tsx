import { Button, Column, Host, Text, TextInput, useNativeState } from "@expo/ui";

const LABEL = { fontSize: 14, fontWeight: "600", color: "#111" } as const;

export default function AddColleagueForm({
  onSubmit,
}: {
  onSubmit: (email: string) => void;
}) {
  const email = useNativeState("");
  // A non-scrolling Column (not FieldGroup): the screen's RN ScrollView owns
  // scrolling; a native scroller here would crash on Android (infinite height).
  return (
    <Host matchContents>
      <Column spacing={12}>
        <Text textStyle={LABEL}>Adresse email de l&apos;invité *</Text>
        <TextInput
          value={email}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Button label="Envoyer l'invitation" onPress={() => onSubmit(email.value)} />
      </Column>
    </Host>
  );
}
