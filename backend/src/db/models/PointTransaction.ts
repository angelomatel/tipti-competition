import mongoose, { Schema } from 'mongoose';
import type { PointTransactionDocument } from '@/types/God';

const PointTransactionSchema = new Schema<PointTransactionDocument>({
  playerId:  { type: String, required: true },
  godSlug:   { type: String, required: true },
  type:      { type: String, required: true, enum: ['match', 'buff', 'penalty', 'god_placement_bonus'] },
  value:     { type: Number, required: true },
  source:    { type: String, required: true },
  matchId:   { type: String, default: null },
  day:       { type: String, required: true },
  phase:     { type: Number, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

PointTransactionSchema.index({ playerId: 1, day: 1 });
PointTransactionSchema.index({ godSlug: 1, day: 1 });
PointTransactionSchema.index({ playerId: 1, type: 1 });
PointTransactionSchema.index({ matchId: 1, type: 1 });

export const PointTransaction = mongoose.model<PointTransactionDocument>(
  'PointTransaction',
  PointTransactionSchema,
  'point_transactions',
);
