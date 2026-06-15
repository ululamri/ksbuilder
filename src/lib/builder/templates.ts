import { createBlock } from './catalog';
import type { BuilderBlock } from './types';

export type BuilderTemplate = {
  id: string;
  name: string;
  description: string;
  color: string;
  create: () => BuilderBlock[];
};

function withData(type: Parameters<typeof createBlock>[0], data: Record<string, string>) {
  const block = createBlock(type);
  block.data = { ...block.data, ...data };
  return block;
}

export const templates: BuilderTemplate[] = [
  {
    id: 'course-launch', name: 'Peluncuran kursus', description: 'Hero, manfaat, statistik, dan CTA.', color: '#315c42',
    create: () => [
      withData('hero', { eyebrow: 'KELAS BARU', title: 'Web3 dari nol sampai siap praktik', body: 'Jalur belajar bertahap dengan bahasa yang mudah dipahami.', button: 'Lihat kurikulum' }),
      withData('stats', { value1: '6', label1: 'Level', value2: '24', label2: 'Lesson', value3: '8', label3: 'Praktik' }),
      withData('feature', { kicker: '01', title: 'Belajar terarah', body: 'Ikuti urutan yang dirancang untuk membangun pemahaman secara bertahap.' }),
      withData('cta', { title: 'Mulai perjalananmu', body: 'Buat akun gratis dan simpan seluruh progres belajar.', button: 'Mulai sekarang' })
    ]
  },
  {
    id: 'community', name: 'Komunitas', description: 'Landing komunitas dan kegiatan.', color: '#6b4f8c',
    create: () => [
      withData('hero', { eyebrow: 'KOMUNITAS', title: 'Bertumbuh bersama builder Indonesia', body: 'Temukan teman belajar, mentor, dan workshop yang relevan.', button: 'Gabung komunitas' }),
      createBlock('gallery'),
      withData('quote', { quote: 'Komunitas membuat proses belajar terasa lebih dekat dan berkelanjutan.', author: 'Spark Community', role: 'Belajar bersama' }),
      createBlock('cta')
    ]
  },
  {
    id: 'simple-page', name: 'Halaman informasi', description: 'Layout bersih untuk halaman statis.', color: '#3b668f',
    create: () => [createBlock('hero'), createBlock('text'), createBlock('divider'), createBlock('text'), createBlock('cta')]
  }
];
