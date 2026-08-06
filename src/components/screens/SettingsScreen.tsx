import SettingsList from "@/components/form/SettingsList";
import { useAccount } from "@/lib/data/useAccount";
import { useUser } from "@/lib/data/useUser";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
  onManageColleagues: () => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
  onManageColleagues,
}: Props) {
  const { data: session } = useAccount();
  // Live rather than the AuthProvider snapshot taken at sign-in, so a
  // promotion/demotion reaches this gate without an app restart. Falls back
  // to the session's value while the live read is loading, so nothing
  // flickers into a more-permissive state.
  const { data: viewer, loading: viewerLoading } = useUser(session?.id ?? "");
  const canInvite = viewerLoading
    ? session?.isAdmin === true
    : viewer?.isAdmin === true;

  return (
    <ScrollView>
      <SettingsList
        role={role}
        canInvite={canInvite}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
        onManageColleagues={onManageColleagues}
      />
    </ScrollView>
  );
}
