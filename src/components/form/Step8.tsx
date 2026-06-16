import React, { useMemo } from 'react';
import Dropdown from './Dropdown';
import { isNord, isSud } from '@/constants/departments';

export interface Step8Data {
  modalite: string | null;
}

interface Props {
  data: Step8Data;
  departement: string | null;
  onChange: <K extends keyof Step8Data>(field: K, value: Step8Data[K]) => void;
}

export default function Step8({ data, departement, onChange }: Props) {
  const options = useMemo(() => {
    const opts = ['Enlèvement à domicile'];
    if (departement && isNord(departement)) {
      opts.push('Je dépose la moto au centre de Montargis');
    }
    if (departement && isSud(departement)) {
      opts.push('Je dépose la moto au centre de Vitrolles');
    }
    return opts;
  }, [departement]);

  return (
    <Dropdown
      label="Comment souhaitez-vous faire la reprise du véhicule ?"
      options={options}
      value={data.modalite}
      onChange={(v) => onChange('modalite', v)}
    />
  );
}
