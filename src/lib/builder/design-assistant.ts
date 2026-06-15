import type { BuilderPage, BuilderProject, DeviceMode } from './types';

export type AssistantInsight = {
  title: string;
  detail: string;
};

export type AssistantSuggestion = {
  title: string;
  detail: string;
  action: 'open-blocks' | 'open-modules' | 'open-settings' | 'preview' | 'focus-page';
};

export type AssistantReport = {
  score: number;
  summary: string;
  strengths: AssistantInsight[];
  warnings: AssistantInsight[];
  suggestions: AssistantSuggestion[];
  recommendedModules: string[];
};

type AnalyzeInput = {
  project: BuilderProject;
  page: BuilderPage;
  device: DeviceMode;
  brief: string;
};

const moduleMap: Array<{ id: string; keywords: string[] }> = [
  { id: 'mobile-hero', keywords: ['mobile', 'hero', 'landing', 'ux'] },
  { id: 'learn-path', keywords: ['learn', 'belajar', 'course', 'core'] },
  { id: 'lab-launch', keywords: ['lab', 'simulasi', 'praktik'] },
  { id: 'social-proof', keywords: ['trust', 'bukti', 'testimoni', 'convert', 'jualan'] },
  { id: 'lead-capture', keywords: ['lead', 'form', 'signup', 'daftar', 'jual'] },
  { id: 'media-story', keywords: ['media', 'video', 'animasi', 'visual'] }
];

function hasBlock(page: BuilderPage, type: string) {
  return page.blocks.some((block) => block.type === type);
}

function count(page: BuilderPage, type: string) {
  return page.blocks.filter((block) => block.type === type).length;
}

function normalizeBrief(brief: string) {
  return brief.trim().toLowerCase();
}

export function analyzeDesign({ project, page, device, brief }: AnalyzeInput): AssistantReport {
  const briefText = normalizeBrief(brief);
  let score = 72;
  const strengths: AssistantInsight[] = [];
  const warnings: AssistantInsight[] = [];
  const suggestions: AssistantSuggestion[] = [];
  const recommendedModules = new Set<string>();

  const hero = page.blocks.find((block) => block.type === 'hero');
  const ctaCount = count(page, 'cta');
  const mediaCount = count(page, 'image') + count(page, 'video') + count(page, 'lottie') + count(page, 'gallery');
  const textBlocks = count(page, 'text') + count(page, 'richtext');

  if (hero) {
    strengths.push({ title: 'Ada hero di awal', detail: 'Struktur halaman sudah punya pembuka yang jelas.' });
    const title = hero.data.title ?? '';
    if (device === 'mobile' && title.length > 58) {
      score -= 8;
      warnings.push({ title: 'Judul hero terlalu panjang', detail: 'Di Android, judul pendek lebih cepat dipindai.' });
      suggestions.push({ title: 'Ringkas judul hero', detail: 'Kurangi frasa yang tidak penting agar CTA lebih cepat terlihat.', action: 'open-blocks' });
    }
  } else {
    score -= 12;
    warnings.push({ title: 'Tidak ada hero', detail: 'Pengunjung butuh orientasi visual di 1 layar pertama.' });
    suggestions.push({ title: 'Tambahkan hero fokus mobile', detail: 'Hero adalah titik masuk yang paling aman untuk halaman landing.', action: 'open-modules' });
    recommendedModules.add('mobile-hero');
  }

  if (ctaCount > 0) {
    strengths.push({ title: 'Ada ajakan bertindak', detail: 'CTA membantu halaman punya arah yang jelas.' });
  } else {
    score -= 12;
    warnings.push({ title: 'CTA belum terlihat', detail: 'Halaman terasa belum punya tujuan akhir.' });
    suggestions.push({ title: 'Tambahkan modul lead capture', detail: 'Gunakan CTA atau formulir singkat untuk menaikkan konversi.', action: 'open-modules' });
    recommendedModules.add('lead-capture');
  }

  if (mediaCount > 0) {
    strengths.push({ title: 'Ada media visual', detail: 'Gambar atau video membuat halaman lebih hidup.' });
  } else if (page.blocks.length > 4) {
    score -= 6;
    warnings.push({ title: 'Belum ada elemen visual', detail: 'Halaman panjang tanpa visual cenderung terasa berat di mobile.' });
    suggestions.push({ title: 'Sisipi modul visual', detail: 'Pilih gambar, video pendek, atau animasi ringan.', action: 'open-modules' });
    recommendedModules.add('media-story');
  }

  if (textBlocks > 3 && device === 'mobile') {
    score -= 6;
    warnings.push({ title: 'Terlalu banyak blok teks', detail: 'Pecah informasi panjang jadi section yang lebih singkat.' });
    suggestions.push({ title: 'Pakai modul jalur belajar', detail: 'Gunakan struktur bertahap supaya mudah dipindai di Android.', action: 'open-modules' });
    recommendedModules.add('learn-path');
  }

  if (page.blocks.length > 8 && device === 'mobile') {
    score -= 8;
    warnings.push({ title: 'Struktur cukup berat', detail: 'Banyak blok di layar kecil butuh navigasi yang lebih cepat.' });
    suggestions.push({ title: 'Kurangi kompleksitas halaman', detail: 'Gabungkan section yang mirip dan simpan sisanya ke halaman lain.', action: 'open-blocks' });
  }

  if (page.seo?.title && page.seo.title.length > 60) {
    score -= 5;
    warnings.push({ title: 'Judul SEO terlalu panjang', detail: 'Mesin pencari dan preview sosial lebih nyaman di bawah 60 karakter.' });
    suggestions.push({ title: 'Rapikan metadata', detail: 'Singkatkan judul SEO dan buka panel setelan.', action: 'open-settings' });
  }

  if (page.seo?.description && page.seo.description.length < 80) {
    score += 2;
    strengths.push({ title: 'Deskripsi singkat', detail: 'Metadata cukup ringkas untuk preview sosial.' });
  }

  if (briefText.includes('premium')) {
    score += 2;
    suggestions.push({ title: 'Naikkan rasa premium', detail: 'Pakai satu media kuat, ruang kosong lebih lega, dan CTA yang spesifik.', action: 'open-modules' });
    recommendedModules.add('social-proof');
  }
  if (briefText.includes('jual') || briefText.includes('convert') || briefText.includes('daftar')) {
    score += 2;
    suggestions.push({ title: 'Fokus konversi', detail: 'Tambahkan bukti sosial dan formulir yang singkat.', action: 'open-modules' });
    recommendedModules.add('lead-capture');
    recommendedModules.add('social-proof');
  }
  if (briefText.includes('mobile')) {
    score += 2;
    strengths.push({ title: 'Brief selaras mobile', detail: 'Arah desain sudah cocok untuk layar kecil.' });
  }
  if (briefText.includes('lab') || briefText.includes('simulasi')) {
    recommendedModules.add('lab-launch');
  }
  if (briefText.includes('media') || briefText.includes('video') || briefText.includes('animasi')) {
    recommendedModules.add('media-story');
  }
  if (briefText.includes('learn') || briefText.includes('belajar') || briefText.includes('core')) {
    recommendedModules.add('learn-path');
  }

  if (!hasBlock(page, 'quote')) {
    suggestions.push({ title: 'Tambahkan bukti sosial', detail: 'Kutipan singkat membantu halaman terasa lebih terpercaya.', action: 'open-modules' });
    recommendedModules.add('social-proof');
  }

  score = Math.max(30, Math.min(98, score));

  const summary = score >= 85
    ? 'Struktur halaman sudah kuat untuk mobile. Fokuskan pada penyederhanaan detail visual.'
    : score >= 70
      ? 'Fondasi sudah oke, tapi masih ada beberapa bagian yang bisa dipersingkat agar lebih nyaman di Android.'
      : 'Halaman masih butuh penguatan hierarki, CTA, dan pemetaan blok yang lebih ringkas.';

  return {
    score,
    summary,
    strengths: strengths.slice(0, 3),
    warnings: warnings.slice(0, 4),
    suggestions: suggestions.slice(0, 5),
    recommendedModules: [...recommendedModules].slice(0, 4)
  };
}

export function suggestModulesFromBrief(brief: string) {
  const normalized = normalizeBrief(brief);
  const recommended = moduleMap.filter((item) => item.keywords.some((keyword) => normalized.includes(keyword))).map((item) => item.id);
  return recommended.length ? recommended : ['mobile-hero', 'lead-capture'];
}

