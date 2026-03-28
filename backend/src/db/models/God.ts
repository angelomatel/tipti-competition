import mongoose, { Schema } from 'mongoose';
import type { GodDocument } from '@/types/God';

const GodSchema = new Schema<GodDocument>({
  slug:              { type: String, required: true, unique: true },
  name:              { type: String, required: true },
  title:             { type: String, required: true },
  isEliminated:      { type: Boolean, default: false },
  eliminatedAt:      { type: Date, default: null },
  eliminatedInPhase: { type: Number, default: null },
});

export const God = mongoose.model<GodDocument>('God', GodSchema, 'gods');
