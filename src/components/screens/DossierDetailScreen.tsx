import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import DossierInfoList from "@/components/native/DossierInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import Section from "@/components/ui/Section";
import { useDossier } from "@/lib/data/useDossier";
import { tokens } from "@/theme/tokens";

export default function DossierDetailScreen({ id }: { id: string }) {
  const { data, loading } = useDossier(id);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <View style={styles.list}>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <Section title="Informations">
              <DossierInfoList dossier={data} />
            </Section>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: tokens.space.xl },
  spinner: { paddingVertical: 48 },
  list: { padding: tokens.space.lg, gap: tokens.space.md },
  heading: { ...tokens.text.title },
});
