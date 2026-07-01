import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  message?: string;
  delay?: number;
  redirectTo: Href;
}

export default function ConfirmationView({
  title,
  message,
  delay = 500,
  redirectTo,
}: Props) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(redirectTo), delay);
    return () => clearTimeout(t);
  }, [router, redirectTo, delay]);

  return (
    <View style={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space.lg,
    gap: tokens.space.md,
    backgroundColor: tokens.colors.bg,
  },
  check: {
    fontSize: 56,
    color: tokens.colors.success,
    fontWeight: "bold",
  },
  title: { ...tokens.text.title, textAlign: "center" },
  message: { ...tokens.text.subtitle, textAlign: "center" },
});
