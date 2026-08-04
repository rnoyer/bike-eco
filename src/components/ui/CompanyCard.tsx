import EntityCard from "@/components/ui/EntityCard";

interface Props {
  title: string;
  subtitle: string;
  onManage: () => void;
}

/** A company in a back-office list. Same visual as every other entity card. */
export default function CompanyCard({ title, subtitle, onManage }: Props) {
  return (
    <EntityCard title={title} subtitle={subtitle} actionLabel="Gérer" onAction={onManage} />
  );
}
