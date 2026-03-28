import mongoose, { Schema } from 'mongoose';
import type { MatchRecordDocument } from '@/types/Player';

const MatchRecordSchema = new Schema<MatchRecordDocument>({
  puuid:       { type: String, required: true },
  matchId:     { type: String, required: true },
  placement:   { type: Number, required: true },
  playedAt:    { type: Date, required: true },
  capturedAt:  { type: Date, default: () => new Date() },
});

MatchRecordSchema.index({ puuid: 1, matchId: 1 }, { unique: true });

export const MatchRecord = mongoose.model<MatchRecordDocument>('MatchRecord', MatchRecordSchema, 'match_records');
