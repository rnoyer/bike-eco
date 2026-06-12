import React from 'react';
import FormField from './FormField';

export interface Step7Data {
  prix: string;
  commentaires: string;
}

interface Props {
  data: Step7Data;
  onChange: <K extends keyof Step7Data>(field: K, value: Step7Data[K]) => void;
}

export default function Step7({ data, onChange }: Props) {
  return (
    <>
      <FormField
        label="Prix souhaité"
        placeholder="€"
        value={data.prix}
        onChangeText={(v) => onChange('prix', v.replace(/\D/g, ''))}
        keyboardType="numeric"
        suffix="€"
        returnKeyType="next"
      />
      <FormField
        label="Commentaires"
        placeholder="Informations complémentaires"
        value={data.commentaires}
        onChangeText={(v) => onChange('commentaires', v)}
        multiline
        returnKeyType="done"
      />
    </>
  );
}
