import React from 'react';
import Dropdown from './Dropdown';
import FormField from './FormField';

export interface Step4Data {
  etat: string | null;
  naturePanne: string;
}

const ETAT_OPTIONS = [
  'En Panne',
  'Accidenté',
  'Fort kilométrage',
  'Refus au Contrôle Technique',
  'Mauvais Etat',
];

interface Props {
  data: Step4Data;
  onChange: <K extends keyof Step4Data>(field: K, value: Step4Data[K]) => void;
}

export default function Step4({ data, onChange }: Props) {
  return (
    <>
      <Dropdown
        label="Dans quel état se trouve votre moto ?"
        placeholder="Etat du véhicule"
        options={ETAT_OPTIONS}
        value={data.etat}
        onChange={(v) => onChange('etat', v)}
      />
      {data.etat === 'En Panne' && (
        <FormField
          label="Connaissez-vous la panne ?"
          placeholder="Nature de la panne"
          value={data.naturePanne}
          onChangeText={(v) => onChange('naturePanne', v)}
          returnKeyType="done"
        />
      )}
    </>
  );
}
