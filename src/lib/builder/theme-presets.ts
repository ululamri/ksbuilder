import type { BuilderProject } from './types';

export type BuilderTheme = NonNullable<BuilderProject['theme']>;

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  theme: BuilderTheme;
};

export const themePresets: ThemePreset[] = [
  {
    id: 'spark-classic',
    name: 'Spark Classic',
    description: 'Kontras tinggi untuk landing dan onboarding.',
    theme: {
      primary: '#17211b',
      accent: '#d9ff62',
      surface: '#ffffff',
      text: '#17211b',
      font: 'modern',
      buttonRadius: 'pill',
      contentWidth: 'standard',
      sectionGap: 'normal',
      surfaceStyle: 'flat'
    }
  },
  {
    id: 'learn-clean',
    name: 'Learn Clean',
    description: 'Lebih ringan untuk halaman edukasi panjang.',
    theme: {
      primary: '#23483a',
      accent: '#a7e8bd',
      surface: '#f7faf6',
      text: '#18231d',
      font: 'friendly',
      buttonRadius: 'soft',
      contentWidth: 'compact',
      sectionGap: 'relaxed',
      surfaceStyle: 'tinted'
    }
  },
  {
    id: 'lab-focus',
    name: 'Lab Focus',
    description: 'Lebih tegas untuk halaman lab dan workflow teknis.',
    theme: {
      primary: '#111827',
      accent: '#67e8f9',
      surface: '#f8fafc',
      text: '#111827',
      font: 'modern',
      buttonRadius: 'square',
      contentWidth: 'wide',
      sectionGap: 'tight',
      surfaceStyle: 'contrast'
    }
  }
];
