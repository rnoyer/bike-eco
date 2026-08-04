import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function B2bColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  return (
    <ColleagueScreen
      uid={uid}
      canManage
      onDeleted={() => router.replace("/(b2b)/colleagues")}
    />
  );
}
