import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import DossierInfoList from "@/components/native/DossierInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useDossier } from "@/lib/data/useDossier";
import { tokens } from "@/theme/tokens";

export default function DossierDetailScreen({ id }: { id: string }) {
  const { data, loading } = useDossier(id);
  return (
    <ScrollView>
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <SectionWrapper>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <Section title="Informations">
              <DossierInfoList dossier={data} />
            </Section>
          </SectionWrapper>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  spinner: { paddingVertical: 48 },
  heading: { ...tokens.text.title },
});
