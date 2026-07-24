import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

export default function SectionWrapper({ children }: { children: ReactNode }) {
  return <View style={styles.wrapper}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: { padding: tokens.space.lg, gap: tokens.space.xl },
});
