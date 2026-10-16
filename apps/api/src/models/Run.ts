import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  DIFFICULTIES,
  FINAL_BOSSES,
  GAME_VERSIONS,
  ITEM_SOURCES,
  RUN_RESULTS,
  type Difficulty,
  type ItemSource,
  type RunResult,
} from '@isaac-atlas/shared';

export interface RunAttrs {
  /** Normalizada: 8 caracteres en mayúsculas, sin espacio. */
  seed: string;
  gameVersion: (typeof GAME_VERSIONS)[number];
  characterId: number;
  difficulty: Difficulty;
  fullUnlocks: boolean;
  items: { itemId: number; floor: number; source: ItemSource }[];
  trinkets: { trinketId: number; floor: number }[];
  /** Derivado de `items` (piso 1): indexado para "empieza con X". */
  startItems: number[];
  outcome: { result: RunResult; lastFloor?: number; finalBoss?: string };
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const runSchema = new Schema<RunAttrs>(
  {
    seed: { type: String, required: true },
    gameVersion: { type: String, enum: GAME_VERSIONS, required: true },
    characterId: { type: Number, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    fullUnlocks: { type: Boolean, required: true },
    items: {
      type: [
        new Schema(
          {
            itemId: { type: Number, required: true },
            floor: { type: Number, required: true },
            source: { type: String, enum: ITEM_SOURCES, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    trinkets: {
      type: [
        new Schema(
          {
            trinketId: { type: Number, required: true },
            floor: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    startItems: { type: [Number], default: [] },
    outcome: {
      result: { type: String, enum: RUN_RESULTS, required: true },
      lastFloor: Number,
      finalBoss: { type: String, enum: FINAL_BOSSES },
    },
    notes: { type: String, default: '' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

runSchema.index({ author: 1, createdAt: -1 });
runSchema.index({ seed: 1 });
runSchema.index({ characterId: 1, startItems: 1 });
runSchema.index({ 'items.itemId': 1 });
runSchema.index({ createdAt: -1 });

export const Run = model<RunAttrs>('Run', runSchema);
export type RunDocument = HydratedDocument<RunAttrs>;
