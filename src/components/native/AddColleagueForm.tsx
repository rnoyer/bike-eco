import { Button, FieldGroup, Host, TextInput, useNativeState } from "@expo/ui";

export default function AddColleagueForm({
  onSubmit,
}: {
  onSubmit: (email: string) => void;
}) {
  const email = useNativeState("");
  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Adresse email de l'invité *">
          <TextInput
            value={email}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </FieldGroup.Section>
        <Button label="Envoyer l'invitation" onPress={() => onSubmit(email.value)} />
      </FieldGroup>
    </Host>
  );
}
