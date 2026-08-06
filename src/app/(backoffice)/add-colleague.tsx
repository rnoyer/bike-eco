import AddColleagueScreen from "@/components/screens/AddColleagueScreen";
import { useRouter } from "expo-router";

export default function BackofficeAddColleague() {
  const router = useRouter();
  return (
    <AddColleagueScreen
      onSent={() => router.replace("/(backoffice)/invite-sent")}
    />
  );
}
