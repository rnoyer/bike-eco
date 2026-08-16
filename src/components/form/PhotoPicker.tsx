import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Image,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Spinner from "@/components/ui/Spinner";
import { MAX_PHOTOS } from "@/constants/photos";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

interface Props {
  value: string[];
  onChange: (uris: string[]) => void;
  error?: string;
  /** Number of photos still required, for the hint line. */
  min?: number;
  /** Hard cap on the number of photos; mirrors the schema's `.max()`. */
  max?: number;
}

/** Photos per row in the thumbnail grid. */
const COLUMNS = 3;

/** Pick photos from the gallery or camera, with a removable thumbnail grid. */
export default function PhotoPicker({
  value,
  onChange,
  error,
  min = 1,
  max = MAX_PHOTOS,
}: Props) {
  const room = Math.max(0, max - value.length);
  const full = room === 0;

  // The tiles are squares sized from the measured grid width rather than a
  // percentage: with a gap between columns there is no percentage that divides
  // evenly, and `aspectRatio` on a percentage width leaves the last column
  // slightly off. Zero until the first layout, which is why the grid renders
  // nothing on that first pass.
  const [gridWidth, setGridWidth] = useState(0);
  const tileSize = Math.floor(
    (gridWidth - tokens.space.sm * (COLUMNS - 1)) / COLUMNS,
  );

  function measureGrid(e: LayoutChangeEvent) {
    setGridWidth(e.nativeEvent.layout.width);
  }

  // One action for both sources: only one picker can be open at a time, and it
  // covers the permission prompt as well as the launch, which is the part that
  // used to leave the button silent.
  const picking = useAsyncAction(async (source: "gallery" | "camera") => {
    // The buttons are disabled at the cap; this guards the race where the
    // action was already queued when the last photo landed.
    if (full) return;
    if (source === "gallery") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alertDialog("Permission refusée", "L'accès à la galerie est nécessaire.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        // Caps the selection inside the system sheet, so the user never picks
        // photos we would silently drop. Android + iOS 14+ only, hence the
        // `slice` below for the platforms that ignore it.
        selectionLimit: room,
        quality: 0.8,
      });
      if (!result.canceled) {
        onChange([...value, ...result.assets.slice(0, room).map((a) => a.uri)]);
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
          style={[
            styles.mediaBtn,
            picking.pending && styles.mediaBtnBusy,
            full && styles.mediaBtnDisabled,
          ]}
          onPress={() => void picking.run("gallery")}
          disabled={picking.pending || full}
          activeOpacity={0.7}
        >
          {picking.pending ? (
            <Spinner />
          ) : (
            <Text style={styles.mediaBtnLabel}>Galerie</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mediaBtn,
            picking.pending && styles.mediaBtnBusy,
            full && styles.mediaBtnDisabled,
          ]}
          onPress={() => void picking.run("camera")}
          disabled={picking.pending || full}
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
        // A plain wrapping row, not a nested ScrollView: the grid grows with
        // its rows and the form's own ScrollView scrolls it.
        <View style={styles.grid} onLayout={measureGrid}>
          {tileSize > 0 &&
            value.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={[styles.photoWrap, { width: tileSize }]}
              >
                <Image
                  source={{ uri }}
                  style={[styles.photo, { height: tileSize }]}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(index)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la photo ${index + 1}`}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
        </View>
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={[styles.hint, remaining === 0 && styles.hintComplete]}>
          {remaining > 0
            ? `Encore ${remaining} photo${remaining > 1 ? "s" : ""} requise${remaining > 1 ? "s" : ""}`
            : full
              ? `${max} photos maximum atteint`
              : `${value.length} photo${value.length > 1 ? "s" : ""} ajoutée${value.length > 1 ? "s" : ""}`}
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
  mediaBtnDisabled: { opacity: 0.4 },
  mediaBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.primary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space.sm,
  },
  photoWrap: {
    position: "relative",
  },
  photo: {
    width: "100%",
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
