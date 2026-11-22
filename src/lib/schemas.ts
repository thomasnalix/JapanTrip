import { z } from 'zod';

export const AuthorSchema = z.enum(['Nell', 'Thomas']);
export type Author = z.infer<typeof AuthorSchema>;

export const CategorySchema = z.enum([
  'restaurant',
  'cafe',
  'temple',
  'nature',
  'shopping',
  'hotel',
  'transport',
  'experience',
  'other',
]);
export type Category = z.infer<typeof CategorySchema>;

export interface CategoryMeta {
  id: Category;
  label: string;
  color: string;
  softBg: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    color: '#C83228',
    softBg: '#FEF2F2',
  },
  cafe: {
    id: 'cafe',
    label: 'Café & Bar',
    color: '#9A5B25',
    softBg: '#FEF7EE',
  },
  temple: {
    id: 'temple',
    label: 'Temple & Culture',
    color: '#B91C1C',
    softBg: '#FEE2E2',
  },
  nature: {
    id: 'nature',
    label: 'Nature & Vue',
    color: '#2F6F4E',
    softBg: '#ECFDF5',
  },
  shopping: {
    id: 'shopping',
    label: 'Shopping',
    color: '#9D3B7A',
    softBg: '#FDF2F8',
  },
  hotel: {
    id: 'hotel',
    label: 'Hébergement',
    color: '#2563EB',
    softBg: '#EFF6FF',
  },
  transport: {
    id: 'transport',
    label: 'Transport',
    color: '#475569',
    softBg: '#F1F5F9',
  },
  experience: {
    id: 'experience',
    label: 'Expérience',
    color: '#C27803',
    softBg: '#FFFBEB',
  },
  other: {
    id: 'other',
    label: 'Autre',
    color: '#52525B',
    softBg: '#F4F4F5',
  },
};

export const CATEGORIES = Object.values(CATEGORY_META);

export const ActivityLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(1000),
});
export type ActivityLink = z.infer<typeof ActivityLinkSchema>;

export const HistoryEntrySchema = z.object({
  author: AuthorSchema,
  action: z.enum(['created', 'updated']),
  at: z.string(),
  summary: z.string().max(120).optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const MAX_ACTIVITY_LINKS = 10;
export const MAX_ACTIVITY_PHOTOS = 6;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1200).default(''),
  address: z.string().max(300).optional(),
  lat: z.number().min(20).max(48),
  lng: z.number().min(120).max(150),
  category: CategorySchema,
  rating: z.number().min(0).max(5).default(0),
  note: z.string().max(4000).default(''),
  links: z.array(ActivityLinkSchema).max(MAX_ACTIVITY_LINKS).default([]),
  photos: z.array(z.string().min(1)).max(MAX_ACTIVITY_PHOTOS).default([]),
  price: z.string().max(80).optional(),
  idealPeriod: z.string().max(120).optional(),
  idealStartDate: z.string().optional(),
  idealEndDate: z.string().optional(),
  createdBy: AuthorSchema,
  createdAt: z.string(),
  updatedBy: AuthorSchema,
  updatedAt: z.string(),
  history: z.array(HistoryEntrySchema).max(15).default([]),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const TripStepTypeSchema = z.enum([
  'flight',
  'train',
  'ferry',
  'bus',
  'stay',
  'milestone',
]);
export type TripStepType = z.infer<typeof TripStepTypeSchema>;

export interface StepTypeMeta {
  id: TripStepType;
  label: string;
  color: string;
  hasRoute: boolean;
}

export const STEP_TYPE_META: Record<TripStepType, StepTypeMeta> = {
  flight: {
    id: 'flight',
    label: 'Avion interne',
    color: '#C83228',
    hasRoute: true,
  },
  train: {
    id: 'train',
    label: 'Train / Shinkansen',
    color: '#0F172A',
    hasRoute: true,
  },
  ferry: {
    id: 'ferry',
    label: 'Ferry',
    color: '#0369A1',
    hasRoute: true,
  },
  bus: {
    id: 'bus',
    label: 'Bus',
    color: '#9A5B25',
    hasRoute: true,
  },
  stay: {
    id: 'stay',
    label: 'Ville / Hébergement',
    color: '#2F6F4E',
    hasRoute: false,
  },
  milestone: {
    id: 'milestone',
    label: 'Étape clé',
    color: '#C27803',
    hasRoute: false,
  },
};

export const STEP_TYPES = Object.values(STEP_TYPE_META);

export const TripStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  type: TripStepTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fromName: z.string().trim().min(1).max(120),
  fromLat: z.number().min(20).max(48),
  fromLng: z.number().min(120).max(150),
  toName: z.string().max(120).optional(),
  toLat: z.number().min(20).max(48).optional(),
  toLng: z.number().min(120).max(150).optional(),
  bookingRef: z.string().max(120).optional(),
  price: z.string().max(80).optional(),
  note: z.string().max(2000).default(''),
  booked: z.boolean().default(false),
  createdBy: AuthorSchema,
  createdAt: z.string(),
  updatedBy: AuthorSchema,
  updatedAt: z.string(),
});
export type TripStep = z.infer<typeof TripStepSchema>;

export const TripSettingsSchema = z.object({
  tripTitle: z.string().trim().min(1).max(80).default('Japon'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type TripSettings = z.infer<typeof TripSettingsSchema>;

export const TripDataSchema = z.object({
  version: z.number().int().min(1).default(1),
  updatedAt: z.string(),
  settings: TripSettingsSchema,
  activities: z.array(ActivitySchema).default([]),
  tripSteps: z.array(TripStepSchema).default([]),
});
export type TripData = z.infer<typeof TripDataSchema>;

export const TripMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('upsert_activity'),
    activity: ActivitySchema,
  }),
  z.object({
    action: z.literal('delete_activity'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('upsert_step'),
    step: TripStepSchema,
  }),
  z.object({
    action: z.literal('delete_step'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('update_settings'),
    settings: TripSettingsSchema,
  }),
  z.object({
    action: z.literal('replace_all'),
    data: TripDataSchema,
  }),
]);
export type TripMutation = z.infer<typeof TripMutationSchema>;

export const SearchPlaceResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  suggestedCategory: CategorySchema,
});
export type SearchPlaceResult = z.infer<typeof SearchPlaceResultSchema>;

export const WeatherLayerTypeSchema = z.enum([
  'temperature',
  'momiji',
  'snow',
  'precipitation',
]);
export type WeatherLayerType = z.infer<typeof WeatherLayerTypeSchema>;

export interface ClimateStationValue {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  tempMeanC: number;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  snowfallCm: number;
  momijiScore: number; // 0-100
  momijiPhase: 'vert' | 'debut' | 'pic' | 'fin';
}

export interface ClimateDaySnapshot {
  date: string;
  source: 'forecast' | 'archive' | 'normals';
  referenceYear: number;
  stations: ClimateStationValue[];
}

export function createDefaultTripData(): TripData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      tripTitle: 'Japon',
      startDate: '2026-11-01',
      endDate: '2026-11-22',
    },
    activities: [],
    tripSteps: [],
  };
}
