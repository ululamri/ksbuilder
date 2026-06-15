export type BlockType = 'hero' | 'text' | 'richtext' | 'feature' | 'cta' | 'image' | 'video' | 'lottie' | 'gallery' | 'stats' | 'quote' | 'form' | 'divider' | 'spacer';
export type DeviceMode = 'mobile' | 'tablet' | 'desktop';
export type BuilderExportTarget = 'static-html' | 'nextjs';

export type BuilderBlock = {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  style: {
    background: string;
    foreground: string;
    align: 'left' | 'center';
    radius: 'none' | 'medium' | 'large';
    padding?: 'compact' | 'normal' | 'roomy';
    shadow?: boolean;
    hiddenOn?: DeviceMode[];
    animation?: 'none' | 'fade' | 'slide-up' | 'slide-left' | 'zoom';
    animationDuration?: 'fast' | 'normal' | 'slow';
    animationDelay?: number;
    animationOnce?: boolean;
  };
};

export type BuilderPage = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  seo?: {
    title: string;
    description: string;
    image: string;
    noIndex: boolean;
  };
  blocks: BuilderBlock[];
  updatedAt: string;
};

export type BuilderProject = {
  schemaVersion: 1;
  id: string;
  name: string;
  theme?: {
    primary: string;
    accent: string;
    surface: string;
    text: string;
    font: 'modern' | 'friendly' | 'editorial';
    buttonRadius: 'soft' | 'pill' | 'square';
  };
  site?: {
    headerTitle: string;
    footerText: string;
    navigation: Array<{ id: string; label: string; pageId: string }>;
  };
  reusableSections?: Array<{ id: string; name: string; blocks: BuilderBlock[] }>;
  pages: BuilderPage[];
};

export type BlockDefinition = {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  defaults: BuilderBlock['data'];
};
