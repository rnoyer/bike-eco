import { ScrollView, StyleSheet } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { tokens } from "@/theme/tokens";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AccountInfoList user={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
