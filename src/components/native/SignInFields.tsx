import { Button, Column, Host, Text, TextInput, useNativeState } from "@expo/ui";

const LABEL = { fontSize: 14, fontWeight: "600", color: "#111" } as const;

interface Props {
  onSubmit: (email: string, password: string) => void;
  onForgotPassword: () => void;
}

export default function SignInFields({ onSubmit, onForgotPassword }: Props) {
  const email = useNativeState("");
  const password = useNativeState("");
  // A non-scrolling Column (not FieldGroup): this form is embedded in a card
  // inside the screen's RN ScrollView, and a native scroller would be measured
  // with infinite height and crash on Android.
  return (
    <Host matchContents>
      <Column spacing={12}>
        <Text textStyle={LABEL}>Adresse email *</Text>
        <TextInput
          value={email}
          placeholder="Votre email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Text textStyle={LABEL}>Mot de passe *</Text>
        <TextInput value={password} placeholder="Mot de passe" secureTextEntry />
        <Button variant="text" label="Mot de passe oublié" onPress={onForgotPassword} />
        <Button label="Login" onPress={() => onSubmit(email.value, password.value)} />
      </Column>
    </Host>
  );
}
