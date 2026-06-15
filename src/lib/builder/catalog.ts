import type { BlockDefinition, BlockType, BuilderBlock } from './types';

export const blockCatalog: BlockDefinition[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Judul, deskripsi, dan tombol utama.',
    icon: 'H1',
    defaults: { eyebrow: 'MULAI DI SINI', title: 'Belajar Web3 dengan aman', body: 'Materi praktis yang disusun untuk pemula Indonesia.', button: 'Mulai belajar', href: '/core' }
  },
  {
    type: 'text',
    label: 'Teks',
    description: 'Judul dan paragraf edukasi.',
    icon: 'T',
    defaults: { title: 'Judul bagian', body: 'Tulis konten yang singkat, jelas, dan mudah dipindai dari layar ponsel.' }
  },
  {
    type: 'richtext',
    label: 'Rich text',
    description: 'Paragraf, heading, dan daftar terstruktur.',
    icon: 'RT',
    defaults: { content: '## Judul bagian\n\nTulis paragraf di sini.\n\n- Poin pertama\n- Poin kedua' }
  },
  {
    type: 'feature',
    label: 'Kartu fitur',
    description: 'Sorot satu manfaat atau materi.',
    icon: 'F',
    defaults: { kicker: '01', title: 'Pahami dasarnya', body: 'Pelajari konsep penting sebelum mencoba fitur yang lebih lanjut.' }
  },
  {
    type: 'cta',
    label: 'Ajakan',
    description: 'Panel tindakan dengan satu tombol.',
    icon: 'GO',
    defaults: { title: 'Siap melanjutkan?', body: 'Lanjutkan ke langkah berikutnya saat kamu sudah memahami materi.', button: 'Lanjut', href: '/dashboard' }
  },
  {
    type: 'image',
    label: 'Gambar',
    description: 'Gambar responsif dengan teks alternatif.',
    icon: 'IMG',
    defaults: { src: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80', alt: 'Ilustrasi teknologi blockchain', caption: 'Gunakan gambar yang relevan dengan materi.' }
  },
  {
    type: 'video',
    label: 'Video',
    description: 'MP4/WebM lokal atau embed YouTube/Vimeo.',
    icon: 'VID',
    defaults: { src: '', poster: '', title: 'Video', caption: '', autoplay: 'false', loop: 'false', muted: 'true', controls: 'true', playsinline: 'true' }
  },
  {
    type: 'lottie',
    label: 'Lottie',
    description: 'Animasi JSON ringan dan responsif.',
    icon: 'LOT',
    defaults: { src: '', title: 'Animasi', loop: 'true', autoplay: 'true', speed: '1' }
  },
  {
    type: 'gallery',
    label: 'Galeri',
    description: 'Tiga gambar dalam grid responsif.',
    icon: 'GRD',
    defaults: { image1: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80', image2: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80', image3: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80', alt: 'Galeri teknologi dan pembelajaran' }
  },
  {
    type: 'stats',
    label: 'Statistik',
    description: 'Tampilkan tiga angka penting.',
    icon: '123',
    defaults: { value1: '12+', label1: 'Modul', value2: '40+', label2: 'Materi', value3: '100%', label3: 'Praktis' }
  },
  {
    type: 'grid',
    label: 'Grid layout',
    description: 'Grid kartu responsif dengan kontrol kolom.',
    icon: 'GRID',
    defaults: { title: 'Jelajahi bagian utama', body: 'Susun highlight atau fitur dalam grid mobile-first.', columnsMobile: '1', columnsTablet: '2', columnsDesktop: '3', items: 'Core|Fondasi materi dan jalur belajar.|/core|Lihat Core\nLearn|Lesson yang mudah dipindai di mobile.|/learn|Buka Learn\nLab|Praktik interaktif dan simulasi.|/lab|Masuk Lab' }
  },
  {
    type: 'quote',
    label: 'Kutipan',
    description: 'Testimoni atau pesan utama.',
    icon: '“”',
    defaults: { quote: 'Belajar teknologi harus terasa aman, terarah, dan relevan.', author: 'Karyra Spark', role: 'Platform edukasi' }
  },
  {
    type: 'form',
    label: 'Formulir',
    description: 'Form kontak atau pendaftaran.',
    icon: 'FRM',
    defaults: { title: 'Hubungi kami', body: 'Isi formulir dan tim kami akan menghubungi kamu.', fields: 'Nama|name|text|required\nEmail|email|email|required\nPesan|message|textarea|required', button: 'Kirim pesan', success: 'Terima kasih. Pesanmu sudah diterima.' }
  },
  {
    type: 'divider',
    label: 'Pemisah',
    description: 'Garis pemisah antarkonten.',
    icon: '—',
    defaults: { width: '100' }
  },
  {
    type: 'spacer',
    label: 'Jarak',
    description: 'Atur ruang antarkonten.',
    icon: '--',
    defaults: { size: '32' }
  },
  {
    type: 'symbol',
    label: 'Komponen global',
    description: 'Reference ke library komponen proyek.',
    icon: 'SYM',
    defaults: { componentId: '' }
  }
];

export function createBlock(type: BlockType): BuilderBlock {
  const definition = blockCatalog.find((item) => item.type === type) ?? blockCatalog[1];
  return {
    id: crypto.randomUUID(),
    type,
    data: { ...definition.defaults },
    style: { background: '#ffffff', foreground: '#17211b', align: 'left', radius: 'large', padding: 'normal', shadow: false, hiddenOn: [], animation: 'none', animationDuration: 'normal', animationDelay: 0, animationOnce: true }
  };
}
