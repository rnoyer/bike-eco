import ColleaguesScreen from "@/components/screens/ColleaguesScreen";
import { useRouter } from "expo-router";

export default function BackofficeColleagues() {
  const router = useRouter();
  return (
    <ColleaguesScreen onManage={(uid) => router.push(`/(backoffice)/colleagues/${uid}`)} />
  );
}
