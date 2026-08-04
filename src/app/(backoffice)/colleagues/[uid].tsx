import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function BackofficeColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  return (
    <ColleagueScreen
      uid={uid}
      canManage
      onDeleted={() => router.replace("/(backoffice)/colleagues")}
    />
  );
}
