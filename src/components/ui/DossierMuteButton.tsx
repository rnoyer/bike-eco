import bellOffIcon from "@/assets/images/icons/bell-off.svg";
import bellRingIcon from "@/assets/images/icons/bell-ring.svg";
import IconButton from "@/components/ui/IconButton";
import { useDossierMute } from "@/lib/data/useDossierMute";

/**
 * Subscription toggle over the dossier carousel. Bell-ring = subscribed (the
 * default), bell-off = muted.
 */
export default function DossierMuteButton({ dossierId }: { dossierId: string }) {
  const { muted, toggle, ready } = useDossierMute(dossierId);
  return (
    <IconButton
      icon={muted ? bellOffIcon : bellRingIcon}
      accessibilityLabel={
        muted
          ? "Réactiver les notifications de ce dossier"
          : "Désactiver les notifications de ce dossier"
      }
      onPress={toggle}
      // Until the snapshot lands the icon is a guess; tapping it would write
      // the wrong state.
      disabled={!ready}
    />
  );
}
