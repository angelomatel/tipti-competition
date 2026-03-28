import mongoose, { Schema, Document } from 'mongoose';

export interface ITournamentSettings {
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}

export type TournamentSettingsDocument = ITournamentSettings & Document;

const TournamentSettingsSchema = new Schema<TournamentSettingsDocument>({
  name:      { type: String, required: true },
  startDate: { type: Date,   required: true },
  endDate:   { type: Date,   required: true },
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date,   default: () => new Date() },
});

export const TournamentSettings = mongoose.model<TournamentSettingsDocument>(
  'TournamentSettings',
  TournamentSettingsSchema,
  'tournament_settings',
);
