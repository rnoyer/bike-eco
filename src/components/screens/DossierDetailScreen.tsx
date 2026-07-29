import DossierInfoList from "@/components/native/DossierInfoList";
import UserInfoList from "@/components/native/UserInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { useDossier } from "@/lib/data/useDossier";
import { tokens } from "@/theme/tokens";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function DossierDetailScreen({ id }: { id: string }) {
  const { data, loading, error } = useDossier(id);
  return (
    <ScrollView>
      {loading ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Dossier introuvable." />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <SectionWrapper>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <Section title="Informations véhicule">
              <DossierInfoList dossier={data} />
            </Section>
            <Section title="Informations vendeur">
              <UserInfoList dossier={data} />
            </Section>
          </SectionWrapper>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { ...tokens.text.title },
});
