import React from 'react';
import Dropdown from './Dropdown';

export interface Step5Data {
  carnetEntretien: string | null;
  factureEntretien: string | null;
  controleTechnique: string | null;
  ctMoins6Mois: string | null;
  carteGrise: string | null;
  carteGriseAVotreNom: string | null;
}

const OUI_NON = ['oui', 'non'];

interface Props {
  data: Step5Data;
  onChange: <K extends keyof Step5Data>(field: K, value: Step5Data[K]) => void;
}

export default function Step5({ data, onChange }: Props) {
  return (
    <>
      <Dropdown
        label="Carnet d'entretien"
        options={OUI_NON}
        value={data.carnetEntretien}
        onChange={(v) => onChange('carnetEntretien', v)}
      />
      <Dropdown
        label="Facture d'entretien"
        options={OUI_NON}
        value={data.factureEntretien}
        onChange={(v) => onChange('factureEntretien', v)}
      />
      <Dropdown
        label="Avez-vous le Contrôle Technique ?"
        options={OUI_NON}
        value={data.controleTechnique}
        onChange={(v) => onChange('controleTechnique', v)}
      />
      {data.controleTechnique === 'oui' && (
        <Dropdown
          label="Contrôle technique de moins de 6 mois ?"
          options={OUI_NON}
          value={data.ctMoins6Mois}
          onChange={(v) => onChange('ctMoins6Mois', v)}
        />
      )}
      <Dropdown
        label="Avez-vous la carte grise du véhicule ?"
        options={OUI_NON}
        value={data.carteGrise}
        onChange={(v) => onChange('carteGrise', v)}
      />
      <Dropdown
        label="Est-elle à votre nom ?"
        options={OUI_NON}
        value={data.carteGriseAVotreNom}
        onChange={(v) => onChange('carteGriseAVotreNom', v)}
      />
    </>
  );
}
