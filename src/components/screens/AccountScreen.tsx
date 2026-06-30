import { ScrollView, StyleSheet } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { tokens } from "@/theme/tokens";

export default function AccountScreen() {
  const { data } = useAccount();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AccountInfoList user={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
