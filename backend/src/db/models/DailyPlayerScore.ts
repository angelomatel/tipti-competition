import mongoose, { Schema } from 'mongoose';
import type { DailyPlayerScoreDocument } from '@/types/God';

const DailyPlayerScoreSchema = new Schema<DailyPlayerScoreDocument>({
  playerId:   { type: String, required: true },
  puuid:      { type: String, required: true },
  godSlug:    { type: String, required: true },
  day:        { type: String, required: true },
  rawLpGain:  { type: Number, required: true },
  matchCount: { type: Number, required: true },
  placements: { type: [Number], required: true },
  createdAt:  { type: Date, default: () => new Date() },
});

DailyPlayerScoreSchema.index({ playerId: 1, day: 1 }, { unique: true });
DailyPlayerScoreSchema.index({ godSlug: 1, day: 1 });

export const DailyPlayerScore = mongoose.model<DailyPlayerScoreDocument>(
  'DailyPlayerScore',
  DailyPlayerScoreSchema,
  'daily_player_scores',
);
