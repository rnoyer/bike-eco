import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function AccountScreen() {
  const { data } = useAccount();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Mon Compte", back: false })} />
      <AccountInfoList user={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
