import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function BackofficeDossierTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="bicycle" md="two_wheeler" />
        <NativeTabs.Trigger.Label>Dossier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="envelope.fill" md="mail" />
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="management">
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder_open" />
        <NativeTabs.Trigger.Label>Statut dossier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
