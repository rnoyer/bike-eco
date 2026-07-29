import * as ImagePicker from "expo-image-picker";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Spinner from "@/components/ui/Spinner";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

interface Props {
  value: string[];
  onChange: (uris: string[]) => void;
  error?: string;
  /** Number of photos still required, for the hint line. */
  min?: number;
}

/** Pick photos from the gallery or camera, with a removable thumbnail strip. */
export default function PhotoPicker({ value, onChange, error, min = 1 }: Props) {
  // One action for both sources: only one picker can be open at a time, and it
  // covers the permission prompt as well as the launch, which is the part that
  // used to leave the button silent.
  const picking = useAsyncAction(async (source: "gallery" | "camera") => {
    if (source === "gallery") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alertDialog("Permission refusée", "L'accès à la galerie est nécessaire.");
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
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alertDialog("Permission refusée", "L'accès à la caméra est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      onChange([...value, result.assets[0].uri]);
    }
    // Without this a picker that throws stops the spinner and does nothing
    // else — silently, which is the symptom this whole change exists to remove.
  }, { onError: (message) => alertDialog("Photos", message) });

  function confirmDelete(index: number) {
    confirmDialog({
      title: "Supprimer la photo",
      message: "Voulez-vous supprimer cette photo ?",
      confirmLabel: "Supprimer",
      destructive: true,
      onConfirm: () => onChange(value.filter((_, i) => i !== index)),
    });
  }

  const remaining = Math.max(0, min - value.length);

  return (
    <View style={styles.container}>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.mediaBtn, picking.pending && styles.mediaBtnBusy]}
          onPress={() => void picking.run("gallery")}
          disabled={picking.pending}
          activeOpacity={0.7}
        >
          {picking.pending ? (
            <Spinner />
          ) : (
            <Text style={styles.mediaBtnLabel}>Galerie</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mediaBtn, picking.pending && styles.mediaBtnBusy]}
          onPress={() => void picking.run("camera")}
          disabled={picking.pending}
          activeOpacity={0.7}
        >
          {picking.pending ? (
            <Spinner />
          ) : (
            <Text style={styles.mediaBtnLabel}>Appareil Photo</Text>
          )}
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
    gap: tokens.space.md,
  },
  mediaBtn: {
    flex: 1,
    height: 72,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBtnBusy: { opacity: 0.7 },
  mediaBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.primary,
  },
  carousel: {
    gap: tokens.space.md,
    paddingVertical: 2,
  },
  photoWrap: {
    position: "relative",
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.divider,
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
    color: tokens.colors.primaryText,
    fontSize: 11,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    color: tokens.colors.muted,
    textAlign: "center",
  },
  hintComplete: {
    color: tokens.colors.success,
  },
  error: {
    fontSize: 12,
    color: tokens.colors.danger,
    textAlign: "center",
  },
});
