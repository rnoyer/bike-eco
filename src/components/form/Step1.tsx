import React from 'react';
import FormField from './FormField';
import Dropdown from './Dropdown';
import { DEPARTMENTS } from '@/constants/departments';

export interface Step1Data {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  departement: string | null;
  ville: string;
}

export interface Step1Errors {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  departement?: string;
  ville?: string;
}

interface Props {
  data: Step1Data;
  errors: Step1Errors;
  onChange: <K extends keyof Step1Data>(field: K, value: Step1Data[K]) => void;
}

export default function Step1({ data, errors, onChange }: Props) {
  return (
    <>
      <FormField
        label="Nom"
        placeholder="Votre nom"
        value={data.nom}
        onChangeText={(v) => onChange('nom', v)}
        error={errors.nom}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <FormField
        label="Prénom"
        placeholder="Votre prénom"
        value={data.prenom}
        onChangeText={(v) => onChange('prenom', v)}
        error={errors.prenom}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <FormField
        label="Adresse email"
        placeholder="Votre email"
        value={data.email}
        onChangeText={(v) => onChange('email', v)}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
      />
      <FormField
        label="Téléphone"
        placeholder="Votre numéro de téléphone"
        value={data.telephone}
        onChangeText={(v) => onChange('telephone', v.replace(/\D/g, '').slice(0, 10))}
        error={errors.telephone}
        keyboardType="phone-pad"
      />
      <Dropdown
        label="Département"
        placeholder="Département"
        options={DEPARTMENTS}
        value={data.departement}
        onChange={(v) => onChange('departement', v)}
        error={errors.departement}
        searchable
      />
      <FormField
        label="Ville"
        placeholder="Ville"
        value={data.ville}
        onChangeText={(v) => onChange('ville', v)}
        error={errors.ville}
        autoCapitalize="words"
        returnKeyType="done"
      />
    </>
  );
}
