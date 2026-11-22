import type { StyleSpecification } from 'maplibre-gl';

const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron';

const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    voyager: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    {
      id: 'voyager-tiles',
      type: 'raster',
      source: 'voyager',
    },
  ],
};

interface GenericLayer {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/**
 * Loads OpenFreeMap vector style and applies a clean, modern shadcn-inspired
 * light neutral palette with Latin/English-preferred labels when available.
 */
export async function getWarmJapanMapStyle(): Promise<StyleSpecification> {
  try {
    const res = await fetch(OPENFREEMAP_POSITRON, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return RASTER_FALLBACK_STYLE;

    const style = (await res.json()) as StyleSpecification & {
      layers: GenericLayer[];
    };

    const cleanLayers = style.layers.map((layer) => {
      const paint: Record<string, unknown> = { ...(layer.paint ?? {}) };

      if (layer.id === 'background') {
        paint['background-color'] = '#FAF8F5';
      } else if (layer.id === 'water') {
        paint['fill-color'] = '#DCE8EF';
      } else if (layer.id === 'waterway') {
        paint['line-color'] = '#CEE0EA';
      } else if (layer.id === 'park') {
        paint['fill-color'] = '#E4ECE2';
        paint['fill-opacity'] = 0.85;
      } else if (layer.id === 'landcover_wood') {
        paint['fill-color'] = '#DCE7DA';
        paint['fill-opacity'] = 0.65;
      } else if (layer.id === 'landuse_residential') {
        paint['fill-color'] = '#F3F2EE';
      } else if (layer.id === 'building') {
        paint['fill-color'] = '#EAE8E3';
        paint['fill-outline-color'] = '#DFDCD6';
      } else if (layer.id.includes('motorway_inner')) {
        paint['line-color'] = '#EBBCA8';
      } else if (layer.id.includes('motorway_casing')) {
        paint['line-color'] = '#D99B84';
      } else if (layer.id.includes('major_inner')) {
        paint['line-color'] = '#F2D6C8';
      } else if (layer.id.includes('major_casing')) {
        paint['line-color'] = '#E4C4B4';
      } else if (layer.id === 'highway_minor' || layer.id === 'highway_path') {
        paint['line-color'] = '#ECEAE5';
      } else if (layer.id.startsWith('railway')) {
        paint['line-color'] = '#CBD5E1';
      } else if (layer.id.startsWith('boundary_')) {
        paint['line-color'] = '#D4D4D8';
      } else if (layer.id.startsWith('label_')) {
        paint['text-color'] = '#27272A';
        paint['text-halo-color'] = '#FFFFFF';
        paint['text-halo-width'] = 1.6;
      } else if (
        layer.id.startsWith('water_name') ||
        layer.id === 'waterway_line_label'
      ) {
        paint['text-color'] = '#64748B';
        paint['text-halo-color'] = '#E2EDF3';
      }

      return { ...layer, paint };
    });

    return {
      ...style,
      layers: cleanLayers as StyleSpecification['layers'],
    };
  } catch {
    return RASTER_FALLBACK_STYLE;
  }
}
