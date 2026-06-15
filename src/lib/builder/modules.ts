import { createBlock } from './catalog';
import type { BuilderBlock, BlockType } from './types';

export type ModulePreset = {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'Landing' | 'Learning' | 'Conversion' | 'Media';
  blocks: BuilderBlock[];
};

function cloneBlock(type: BlockType, data?: Record<string, string>): BuilderBlock {
  const block = createBlock(type);
  return {
    ...block,
    data: data ? { ...block.data, ...data } : { ...block.data }
  };
}

function cloneBlocks(blocks: BuilderBlock[]): BuilderBlock[] {
  return blocks.map((block) => ({ ...structuredClone(block), id: crypto.randomUUID() }));
}

const moduleTemplates: Array<Omit<ModulePreset, 'blocks'> & { build: () => BuilderBlock[] }> = [
  {
    id: 'mobile-hero',
    label: 'Hero fokus mobile',
    description: 'Hero ringkas dengan satu CTA dan penjelasan singkat.',
    icon: 'HM',
    category: 'Landing',
    build: () => [
      cloneBlock('hero', { eyebrow: 'SIAP TAMPIL DI MOBILE', title: 'Website yang nyaman dipakai di Android', body: 'Struktur singkat, jelas, dan mudah dipindai dari layar kecil.', button: 'Lihat demo', href: '/demo' }),
      cloneBlock('feature', { kicker: '01', title: 'Satu tujuan utama', body: 'Halaman tidak terlalu panjang dan CTA tetap terlihat.' }),
      cloneBlock('cta', { title: 'Mau mulai dari mana?', body: 'Pilih blok yang relevan lalu susun dengan cepat.', button: 'Tambah konten', href: '/builder' })
    ]
  },
  {
    id: 'learn-path',
    label: 'Jalur belajar',
    description: 'Modul untuk Core/Learn: ringkas, bertahap, dan terstruktur.',
    icon: 'LR',
    category: 'Learning',
    build: () => [
      cloneBlock('hero', { eyebrow: 'CORE / LEARN', title: 'Belajar bertahap tanpa terasa berat', body: 'Susun materi dalam potongan kecil agar nyaman dibaca di HP.', button: 'Lihat modul', href: '/core' }),
      cloneBlock('richtext', { content: '## Apa yang dipelajari\n\n- Ringkasan singkat\n- Langkah praktik\n- Referensi lanjutan' }),
      cloneBlock('stats', { value1: '12+', label1: 'Modul', value2: '3', label2: 'Level', value3: '100%', label3: 'Mobile first' }),
      cloneBlock('cta', { title: 'Lanjutkan pembelajaran', body: 'Sediakan jalan berikutnya yang jelas setelah pembaca selesai.', button: 'Mulai kelas', href: '/learn' })
    ]
  },
  {
    id: 'lab-launch',
    label: 'Lab interaktif',
    description: 'Pembuka Lab dengan visual, penjelasan, dan tombol tindakan.',
    icon: 'LB',
    category: 'Learning',
    build: () => [
      cloneBlock('hero', { eyebrow: 'LAB PRAKTIK', title: 'Belajar lewat simulasi yang langsung terasa', body: 'Perlihatkan konteks, hasil, dan langkah yang akan dikerjakan.', button: 'Masuk lab', href: '/lab' }),
      cloneBlock('gallery', { alt: 'Preview lab interaktif' }),
      cloneBlock('text', { title: 'Apa yang akan dikerjakan', body: 'Berikan ringkasan skenario sebelum pengguna masuk ke lab.' }),
      cloneBlock('cta', { title: 'Siap mencoba?', body: 'Pastikan tombol utama mudah dijangkau di layar kecil.', button: 'Mulai simulasi', href: '/lab/start' })
    ]
  },
  {
    id: 'social-proof',
    label: 'Bukti sosial',
    description: 'Statistik, kutipan, dan ajakan untuk menaikkan kepercayaan.',
    icon: 'SP',
    category: 'Conversion',
    build: () => [
      cloneBlock('stats', { value1: '40+', label1: 'Materi', value2: '98%', label2: 'Relevan', value3: '4.9', label3: 'Rating' }),
      cloneBlock('quote', { quote: 'Desain yang bagus terasa jelas, cepat dibaca, dan memberi arah.', author: 'Karyra Spark', role: 'UI/UX Assistant' }),
      cloneBlock('cta', { title: 'Yakin untuk lanjut?', body: 'Gabungkan bukti sosial dengan tombol tindakan yang spesifik.', button: 'Coba sekarang', href: '/signup' })
    ]
  },
  {
    id: 'lead-capture',
    label: 'Kumpulkan leads',
    description: 'Modul pendek untuk landing page dan pendaftaran.',
    icon: 'LD',
    category: 'Conversion',
    build: () => [
      cloneBlock('hero', { eyebrow: 'DAPATKAN INFO', title: 'Bangun halaman yang mengubah pengunjung jadi kontak', body: 'Gunakan copy yang singkat, visual yang relevan, dan CTA yang jelas.', button: 'Daftar', href: '/signup' }),
      cloneBlock('form', { title: 'Tinggalkan kontak', body: 'Satu langkah kecil sebelum pengguna lanjut.', fields: 'Nama|name|text|required\nEmail|email|email|required\nTujuan|goal|text|required', button: 'Kirim', success: 'Terima kasih, data sudah diterima.' }),
      cloneBlock('divider', { width: '100' })
    ]
  },
  {
    id: 'media-story',
    label: 'Cerita visual',
    description: 'Komposisi untuk menonjolkan media, video, dan animasi.',
    icon: 'MV',
    category: 'Media',
    build: () => [
      cloneBlock('image', { src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', alt: 'Ilustrasi desain antarmuka', caption: 'Gunakan media yang relevan dan tetap ringan.' }),
      cloneBlock('video', { src: '', poster: '', title: 'Demo singkat', caption: 'Video pendek dengan poster agar cepat dimuat.', autoplay: 'false', loop: 'false', muted: 'true', controls: 'true', playsinline: 'true' }),
      cloneBlock('lottie', { src: '', title: 'Animasi ringan', loop: 'true', autoplay: 'true', speed: '1' })
    ]
  }
];

export const moduleCatalog: ModulePreset[] = moduleTemplates.map(({ build, ...module }) => ({
  ...module,
  blocks: build()
}));

export function instantiateModule(moduleId: string): BuilderBlock[] {
  const module = moduleCatalog.find((item) => item.id === moduleId);
  return module ? cloneBlocks(module.blocks) : [];
}

