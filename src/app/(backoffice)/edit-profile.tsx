import EditProfileFieldScreen from "@/components/screens/EditProfileFieldScreen";
import { useRouter } from "expo-router";

const ACCOUNT = "/(backoffice)/(tabs)/account" as const;

export default function BackofficeEditProfile() {
  const router = useRouter();
  return (
    <EditProfileFieldScreen
      accountHref={ACCOUNT}
      onCancel={() => router.replace(ACCOUNT)}
    />
  );
}
