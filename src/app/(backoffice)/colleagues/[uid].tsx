import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useAccount } from "@/lib/data/useAccount";
import { useUser } from "@/lib/data/useUser";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function BackofficeColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();

  // Live rather than the AuthProvider snapshot taken at sign-in, so a
  // demotion revokes the management UI without an app restart. Falls back
  // to the session's value while the live read is loading, so nothing
  // flickers into a more-permissive state.
  const { data: session } = useAccount();
  const { data: viewer, loading: viewerLoading } = useUser(session?.id ?? "");
  const canManage = viewerLoading
    ? session?.isAdmin === true
    : viewer?.isAdmin === true;

  return (
    <ColleagueScreen
      uid={uid}
      canManage={canManage}
      onDeleted={() => router.replace("/(backoffice)/(tabs)/settings")}
    />
  );
}
