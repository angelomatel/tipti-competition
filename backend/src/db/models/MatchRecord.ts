import mongoose, { Schema } from 'mongoose';
import type { MatchRecordDocument } from '@/types/Player';

const MatchRecordSchema = new Schema<MatchRecordDocument>({
  puuid:       { type: String, required: true },
  matchId:     { type: String, required: true },
  placement:   { type: Number, required: true },
  playedAt:    { type: Date, required: true },
  capturedAt:      { type: Date, default: () => new Date() },
  notifiedAt:      { type: Date, default: null },
  buffProcessed:   { type: Boolean, default: false },
});

MatchRecordSchema.index({ puuid: 1, matchId: 1 }, { unique: true });
MatchRecordSchema.index({ buffProcessed: 1, puuid: 1 });

export const MatchRecord = mongoose.model<MatchRecordDocument>('MatchRecord', MatchRecordSchema, 'match_records');
