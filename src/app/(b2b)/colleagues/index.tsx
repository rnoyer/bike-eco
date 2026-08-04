import ColleaguesScreen from "@/components/screens/ColleaguesScreen";
import { useRouter } from "expo-router";

export default function B2bColleagues() {
  const router = useRouter();
  return <ColleaguesScreen onManage={(uid) => router.push(`/(b2b)/colleagues/${uid}`)} />;
}
