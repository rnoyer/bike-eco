import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams } from "expo-router";

/** A company's user, seen from the back-office: information only. Managing a
 *  company's users is that company's admin's job, not Bike-eco's. */
export default function BackofficeUserDetail() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <ColleagueScreen uid={uid} canManage={false} />;
}
