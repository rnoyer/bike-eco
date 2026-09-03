import EditProfileFieldScreen from "@/components/screens/EditProfileFieldScreen";
import { useRouter } from "expo-router";

const ACCOUNT = "/(b2b)/(tabs)/account" as const;

export default function B2bEditProfile() {
  const router = useRouter();
  return (
    <EditProfileFieldScreen
      accountHref={ACCOUNT}
      onCancel={() => router.replace(ACCOUNT)}
    />
  );
}
