import React from 'react';
import Dropdown from './Dropdown';

export interface Step3Data {
  cleNoire: string | null;
  cleMarron: string | null;
  cleRouge: string | null;
  telecommande: string | null;
}

interface Props {
  data: Step3Data;
  onChange: <K extends keyof Step3Data>(field: K, value: Step3Data[K]) => void;
}

const COUNT_OPTIONS = ['0', '1', '2', '3', '4'];

export default function Step3({ data, onChange }: Props) {
  return (
    <>
      <Dropdown
        label="Clé noire"
        options={COUNT_OPTIONS}
        value={data.cleNoire}
        onChange={(v) => onChange('cleNoire', v)}
      />
      <Dropdown
        label="Clé marron"
        options={COUNT_OPTIONS}
        value={data.cleMarron}
        onChange={(v) => onChange('cleMarron', v)}
      />
      <Dropdown
        label="Clé rouge"
        options={COUNT_OPTIONS}
        value={data.cleRouge}
        onChange={(v) => onChange('cleRouge', v)}
      />
      <Dropdown
        label="Télécommande"
        options={COUNT_OPTIONS}
        value={data.telecommande}
        onChange={(v) => onChange('telecommande', v)}
      />
    </>
  );
}
