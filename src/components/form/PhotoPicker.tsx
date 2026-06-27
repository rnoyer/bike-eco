import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  value: string[];
  onChange: (uris: string[]) => void;
  error?: string;
  /** Number of photos still required, for the hint line. */
  min?: number;
}

/** Pick photos from the gallery or camera, with a removable thumbnail strip. */
export default function PhotoPicker({ value, onChange, error, min = 1 }: Props) {
  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      onChange([...value, ...result.assets.map((a) => a.uri)]);
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      onChange([...value, result.assets[0].uri]);
    }
  }

  function confirmDelete(index: number) {
    Alert.alert("Supprimer la photo", "Voulez-vous supprimer cette photo ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => onChange(value.filter((_, i) => i !== index)),
      },
    ]);
  }

  const remaining = Math.max(0, min - value.length);

  return (
    <View style={styles.container}>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.mediaBtn}
          onPress={pickFromGallery}
          activeOpacity={0.7}
        >
          <Text style={styles.mediaBtnLabel}>Galerie</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mediaBtn}
          onPress={pickFromCamera}
          activeOpacity={0.7}
        >
          <Text style={styles.mediaBtnLabel}>Appareil Photo</Text>
        </TouchableOpacity>
      </View>

      {value.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {value.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(index)}
                hitSlop={6}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={[styles.hint, remaining === 0 && styles.hintComplete]}>
          {remaining === 0
            ? `${value.length} photo${value.length > 1 ? "s" : ""} ajoutée${value.length > 1 ? "s" : ""}`
            : `Encore ${remaining} photo${remaining > 1 ? "s" : ""} requise${remaining > 1 ? "s" : ""}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  mediaBtn: {
    flex: 1,
    height: 72,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  carousel: {
    gap: 12,
    paddingVertical: 2,
  },
  photoWrap: {
    position: "relative",
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  deleteBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    color: "#71727A",
    textAlign: "center",
  },
  hintComplete: {
    color: "#22C55E",
  },
  error: {
    fontSize: 12,
    color: "#EF4444",
    textAlign: "center",
  },
});
