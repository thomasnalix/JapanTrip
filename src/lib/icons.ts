import {
  faBagShopping,
  faBed,
  faBus,
  faCloudRain,
  faCompass,
  faFlag,
  faGear,
  faHotTubPerson,
  faHotel,
  faLeaf,
  faLocationDot,
  faMap,
  faMountainSun,
  faMugSaucer,
  faPlane,
  faShip,
  faSnowflake,
  faTemperatureHalf,
  faToriiGate,
  faTrain,
  faTrainSubway,
  faUser,
  faUtensils,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { Category, TripStepType, WeatherLayerType } from './schemas';

export const CATEGORY_ICONS: Record<Category, IconDefinition> = {
  restaurant: faUtensils,
  cafe: faMugSaucer,
  temple: faToriiGate,
  nature: faMountainSun,
  shopping: faBagShopping,
  hotel: faBed,
  transport: faTrainSubway,
  experience: faHotTubPerson,
  other: faLocationDot,
};

export const STEP_ICONS: Record<TripStepType, IconDefinition> = {
  flight: faPlane,
  train: faTrain,
  ferry: faShip,
  bus: faBus,
  stay: faHotel,
  milestone: faFlag,
};

export const LAYER_ICONS: Record<WeatherLayerType, IconDefinition> = {
  temperature: faTemperatureHalf,
  momiji: faLeaf,
  snow: faSnowflake,
  precipitation: faCloudRain,
};

export const UI_ICONS = {
  map: faMap,
  compass: faCompass,
  settings: faGear,
  user: faUser,
};

/** Extract SVG viewBox + path string from a Font Awesome IconDefinition for MapLibre HTML markers. */
export function getFaSvgParts(icon: IconDefinition): {
  width: number;
  height: number;
  path: string;
} {
  const [width, height, , , svgPathData] = icon.icon;
  const path = Array.isArray(svgPathData) ? svgPathData[0] : svgPathData;
  return { width, height, path };
}
