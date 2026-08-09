import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useIsAdmin } from "@/lib/data/useIsAdmin";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function BackofficeColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();

  const canManage = useIsAdmin();

  return (
    <ColleagueScreen
      uid={uid}
      canManage={canManage}
      onDeleted={() => router.replace("/(backoffice)/(tabs)/settings")}
    />
  );
}
