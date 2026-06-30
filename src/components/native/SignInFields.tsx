import { Button, FieldGroup, Host, TextInput, useNativeState } from "@expo/ui";

interface Props {
  onSubmit: (email: string, password: string) => void;
  onForgotPassword: () => void;
}

export default function SignInFields({ onSubmit, onForgotPassword }: Props) {
  const email = useNativeState("");
  const password = useNativeState("");
  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Adresse email *">
          <TextInput
            value={email}
            placeholder="Votre email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </FieldGroup.Section>
        <FieldGroup.Section title="Mot de passe *">
          <TextInput value={password} placeholder="Mot de passe" secureTextEntry />
        </FieldGroup.Section>
        <Button variant="text" label="Mot de passe oublié" onPress={onForgotPassword} />
        <Button label="Login" onPress={() => onSubmit(email.value, password.value)} />
      </FieldGroup>
    </Host>
  );
}
