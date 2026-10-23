import { Schema, model } from 'mongoose';

interface CounterAttrs {
  _id: string;
  n: number;
}

/** Contadores globales simples (hoy, solo el de visitantes). */
const schema = new Schema<CounterAttrs>({
  _id: { type: String, required: true },
  n: { type: Number, required: true, default: 0 },
});

export const Counter = model<CounterAttrs>('Counter', schema);
