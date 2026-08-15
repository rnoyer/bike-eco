import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import AnimatedCheck, { CHECK_DRAW_MS } from "@/components/ui/AnimatedCheck";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  message?: string;
  /** Defaults to the time the check takes to draw — a shorter wait redirects
   *  mid-stroke. Both concrete routes pass 1500 ms, to leave the copy readable. */
  delay?: number;
  redirectTo: Href;
}

export default function ConfirmationView({
  title,
  message,
  delay = CHECK_DRAW_MS,
  redirectTo,
}: Props) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(redirectTo), delay);
    return () => clearTimeout(t);
  }, [router, redirectTo, delay]);

  return (
    <View style={styles.container}>
      <AnimatedCheck />
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
    backgroundColor: tokens.colors.surface,
  },
  title: { ...tokens.text.title, textAlign: "center" },
  message: { ...tokens.text.subtitle, textAlign: "center" },
});
