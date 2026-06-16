import React from 'react';
import FormField from './FormField';

export interface Step2Data {
  marque: string;
  modele: string;
  cylindree: string;
  annee: string;
  kilometrage: string;
  accessoires: string;
}

interface Props {
  data: Step2Data;
  onChange: <K extends keyof Step2Data>(field: K, value: Step2Data[K]) => void;
}

export default function Step2({ data, onChange }: Props) {
  return (
    <>
      <FormField
        label="Marque"
        placeholder="Marque du véhicule"
        value={data.marque}
        onChangeText={(v) => onChange('marque', v)}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <FormField
        label="Modèle"
        placeholder="Modèle du véhicule"
        value={data.modele}
        onChangeText={(v) => onChange('modele', v)}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <FormField
        label="Cylindrée"
        placeholder="Cylindrée du véhicule en CC"
        value={data.cylindree}
        onChangeText={(v) => onChange('cylindree', v.replace(/\D/g, ''))}
        keyboardType="numeric"
        suffix="cc"
        returnKeyType="next"
      />
      <FormField
        label="Année"
        placeholder="Année de mise en service"
        value={data.annee}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 4);
          onChange('annee', digits);
        }}
        keyboardType="numeric"
        maxLength={4}
        returnKeyType="next"
      />
      <FormField
        label="Kilométrage"
        placeholder="Kilométrage du véhicule"
        value={data.kilometrage}
        onChangeText={(v) => onChange('kilometrage', v.replace(/\D/g, ''))}
        keyboardType="numeric"
        suffix="km"
        returnKeyType="next"
      />
      <FormField
        label="Accessoires"
        placeholder="Listez ici les éventuels accessoires"
        value={data.accessoires}
        onChangeText={(v) => onChange('accessoires', v)}
        multiline
        returnKeyType="done"
      />
    </>
  );
}
