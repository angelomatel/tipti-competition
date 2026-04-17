import mongoose, { Schema } from 'mongoose';
import type { LpSnapshotDocument } from '@/types/Player';

const LpSnapshotSchema = new Schema<LpSnapshotDocument>({
  puuid:          { type: String, required: true },
  tier:           { type: String, required: true },
  rank:           { type: String, default: '' },
  leaguePoints:   { type: Number, required: true },
  wins:           { type: Number, required: true },
  losses:         { type: Number, required: true },
  capturedAt:     { type: Date, default: () => new Date() },
});

LpSnapshotSchema.index({ puuid: 1, capturedAt: 1 });
LpSnapshotSchema.index({ puuid: 1, capturedAt: -1 });

export const LpSnapshot = mongoose.model<LpSnapshotDocument>('LpSnapshot', LpSnapshotSchema, 'lp_snapshots');
