export type BlockType = 'hero' | 'text' | 'richtext' | 'feature' | 'cta' | 'image' | 'video' | 'lottie' | 'gallery' | 'stats' | 'quote' | 'form' | 'divider' | 'spacer' | 'symbol' | 'grid';
export type DeviceMode = 'mobile' | 'tablet' | 'desktop';
export type BuilderExportTarget = 'static-html' | 'nextjs';
export type BuilderProjectKind = 'site' | 'core' | 'learn' | 'lab' | 'hub';
export type BuilderAudienceLevel = 'mixed' | 'beginner' | 'intermediate' | 'advanced';
export type BuilderVisibilityTarget = 'spark' | 'spark-hub' | 'both';

export type BuilderLearnMetadata = {
  track: string;
  format: 'lesson' | 'path' | 'cohort';
  outcomes: string[];
  prerequisites: string[];
};

export type BuilderLabMetadata = {
  profile: string;
  runtime: 'browser' | 'container' | 'external';
  difficulty: 'guided' | 'standard' | 'challenge';
  estimatedMinutes: number | null;
};

export type BuilderHubMetadata = {
  listed: boolean;
  category: string;
  cardTitle: string;
  cardSummary: string;
};

export type BuilderProjectMetadata = {
  kind: BuilderProjectKind;
  audience: string;
  level: BuilderAudienceLevel;
  durationMinutes: number | null;
  summary: string;
  tags: string[];
  visibilityTarget: BuilderVisibilityTarget;
  learn: BuilderLearnMetadata;
  lab: BuilderLabMetadata;
  hub: BuilderHubMetadata;
};

export type BuilderComponent = {
  id: string;
  name: string;
  category: 'Section' | 'Hero' | 'Content' | 'Conversion' | 'Media' | 'Custom';
  description: string;
  blocks: BuilderBlock[];
  updatedAt: string;
};

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
    headerCtaLabel?: string;
    headerCtaHref?: string;
    footerLinks?: Array<{ id: string; label: string; href: string }>;
    homePageId?: string;
    formAction?: string;
  };
  metadata?: BuilderProjectMetadata;
  componentLibrary?: BuilderComponent[];
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
