<script lang="ts">
  import { onMount } from 'svelte';
  import { blockCatalog, createBlock } from '$lib/builder/catalog';
  import { BuilderCmsGateway, BuilderGatewayError, type BuilderMediaAsset } from '$lib/builder/cms-gateway';
  import { analyzeDesign } from '$lib/builder/design-assistant';
  import { instantiateModule, moduleCatalog } from '$lib/builder/modules';
  import { prepareImageUploadPlan } from '$lib/builder/image-optimizer';
  import { loadProject, normalizeProject, saveProject } from '$lib/builder/persistence';
  import { SparkApiPublishAdapter } from '$lib/builder/publish-adapter';
  import { duplicatePage, starterProject } from '$lib/builder/project';
  import { templates } from '$lib/builder/templates';
  import { themePresets } from '$lib/builder/theme-presets';
  import { safeSlug } from '$lib/builder/security';
  import type { BlockType, BuilderBlock, BuilderExportTarget, BuilderProject, DeviceMode } from '$lib/builder/types';
  import type { BuilderAiSettingsStatus, CmsSession } from '$lib/contracts/cms';
  import BlockPreview from '$lib/components/BlockPreview.svelte';
  import EditorSheet from '$lib/components/EditorSheet.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import LoginScreen from '$lib/components/LoginScreen.svelte';
  import BlockchainProvenance from '$lib/components/BlockchainProvenance.svelte';
  import MediaLibrary from '$lib/components/MediaLibrary.svelte';
  import ModuleLibrary from '$lib/components/ModuleLibrary.svelte';
  import DesignAssistant from '$lib/components/DesignAssistant.svelte';

  let project = $state<BuilderProject | null>(null);
  let activePageId = $state('');
  let selectedBlockId = $state<string | null>(null);
  let activePanel = $state<'projects' | 'blocks' | 'modules' | 'assistant' | 'templates' | 'pages' | 'layers' | 'media' | 'theme' | 'revisions' | 'submissions' | 'settings' | 'more' | null>(null);
  let device = $state<DeviceMode>('mobile');
  let insertAt = $state<number | null>(null);
  let preview = $state(false);
  let publishing = $state(false);
  let toast = $state('');
  let history = $state<string[]>([]);
  let future = $state<string[]>([]);
  let backendRevision = $state(0);
  let syncing = $state(false);
  let session = $state<CmsSession | null>(null);
  let sessionLoading = $state(true);
  let revisions = $state<Array<{ revision: number; createdAt: string; contentHash: string; createdBy: string }>>([]);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let mediaAssets = $state<BuilderMediaAsset[]>([]);
  let uploading = $state(false);
  let draggedIndex = $state<number | null>(null);
  let submissions = $state<Array<{ id: string; payload: Record<string, string>; createdAt: string }>>([]);
  let projectList = $state<Array<{ id: string; name: string; revision: number; publishedRevision: number | null; updatedAt: string }>>([]);
  let lastSyncedJson = '';
  let assistantBrief = $state('Fokus pada mobile, CTA, dan hierarki visual.');
  let assistantTick = $state(0);
  let aiSettings = $state<BuilderAiSettingsStatus | null>(null);
  let aiSettingsLoading = $state(false);
  let aiSettingsSaving = $state(false);
  let aiProvider = $state<'openai' | 'anthropic' | 'gemini' | 'custom'>('openai');
  let aiModel = $state('gpt-4.1-mini');
  let aiBaseUrl = $state('https://api.openai.com/v1');
  let aiApiKey = $state('');
  let exportTarget = $state<BuilderExportTarget>('static-html');
  const gateway = new BuilderCmsGateway();

  let page = $derived(project?.pages.find((item) => item.id === activePageId) ?? project?.pages[0]);
  let selectedBlock = $derived(page?.blocks.find((item) => item.id === selectedBlockId));
  let panelTitle = $derived.by(() => {
    if (activePanel === 'projects') return 'Semua proyek';
    if (activePanel === 'blocks') return 'Tambah blok';
    if (activePanel === 'modules') return 'Modul';
    if (activePanel === 'assistant') return 'Karyra Spark Assistant';
    if (activePanel === 'templates') return 'Template';
    if (activePanel === 'pages') return 'Halaman';
    if (activePanel === 'layers') return 'Lapisan';
    if (activePanel === 'media') return 'Media library';
    if (activePanel === 'theme') return 'Tema global';
    if (activePanel === 'revisions') return 'Riwayat revisi';
    if (activePanel === 'submissions') return 'Inbox formulir';
    if (activePanel === 'settings') return 'Setelan & SEO';
    if (activePanel === 'more') return 'Lainnya';
    return '';
  });
  let assistantReport = $derived.by(() => {
    assistantTick;
    return project && page ? analyzeDesign({ project, page, device, brief: assistantBrief }) : null;
  });

  onMount(async () => {
    project = loadProject() ?? starterProject();
    activePageId = project.pages[0].id;
    try { session = await gateway.session(); }
    catch { session = { backendMode: 'draft', authenticated: false, csrfToken: '' }; }
    finally { sessionLoading = false; }
  });

  $effect(() => {
    if (!project || sessionLoading || session?.backendMode === 'draft' || !session?.authenticated || syncing) return;
    const serialized = JSON.stringify(project);
    if (serialized === lastSyncedJson) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void syncProject(true), 1500);
    return () => { if (autosaveTimer) clearTimeout(autosaveTimer); };
  });

  function snapshot() {
    if (!project) return;
    history = [...history.slice(-29), JSON.stringify(project)];
    future = [];
  }

  function commit(next: BuilderProject, message?: string) {
    project = next;
    saveProject(next);
    if (message) showToast(message);
  }

  function updateBlocks(blocks: BuilderBlock[]) {
    if (!project || !page) return;
    snapshot();
    commit({ ...project, pages: project.pages.map((item) => item.id === page.id ? { ...item, blocks, updatedAt: new Date().toISOString() } : item) });
  }

  function insertBlocks(blocksToInsert: BuilderBlock[]) {
    if (!project || !page || blocksToInsert.length === 0) return;
    const blocks = [...page.blocks];
    blocks.splice(insertAt ?? blocks.length, 0, ...blocksToInsert);
    updateBlocks(blocks);
    selectedBlockId = blocksToInsert[0]?.id ?? null;
    insertAt = null;
    activePanel = null;
  }

  function addBlock(type: BlockType) {
    insertBlocks([createBlock(type)]);
  }

  function insertModule(moduleId: string) {
    const blocks = instantiateModule(moduleId);
    if (!blocks.length) return;
    insertBlocks(blocks);
    showToast('Modul ditambahkan');
  }

  function duplicateBlock(blockId: string) {
    if (!page) return;
    const index = page.blocks.findIndex((item) => item.id === blockId);
    if (index < 0) return;
    const copy = structuredClone(page.blocks[index]);
    copy.id = crypto.randomUUID();
    const blocks = [...page.blocks];
    blocks.splice(index + 1, 0, copy);
    updateBlocks(blocks);
    showToast('Blok diduplikasi');
  }

  function applyTemplate(templateId: string) {
    if (!page) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    updateBlocks(template.create());
    activePanel = null;
    showToast('Template diterapkan');
  }

  function updateTheme(key: string, value: string) {
    if (!project || !project.theme) return;
    snapshot();
    commit({ ...project, theme: { ...project.theme, [key]: value } as NonNullable<BuilderProject['theme']> });
  }

  function applyThemePreset(presetId: string) {
    if (!project) return;
    const preset = themePresets.find((item) => item.id === presetId);
    if (!preset) return;
    snapshot();
    commit({ ...project, theme: structuredClone(preset.theme) }, 'Preset tema diterapkan');
  }

  function updateSeo(key: string, value: string | boolean) {
    if (!project || !page || !page.seo) return;
    snapshot();
    commit({ ...project, pages: project.pages.map((item) => item.id === page.id ? { ...item, seo: { ...item.seo!, [key]: value } as NonNullable<typeof item.seo> } : item) });
  }

  function updateProjectName(name: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, name });
  }

  function updateProjectMetadata<K extends keyof NonNullable<BuilderProject['metadata']>>(key: K, value: NonNullable<BuilderProject['metadata']>[K]) {
    if (!project || !project.metadata) return;
    snapshot();
    commit({ ...project, metadata: { ...project.metadata, [key]: value } });
  }

  function updateLearnMetadata<K extends keyof NonNullable<BuilderProject['metadata']>['learn']>(key: K, value: NonNullable<BuilderProject['metadata']>['learn'][K]) {
    if (!project?.metadata) return;
    snapshot();
    commit({ ...project, metadata: { ...project.metadata, learn: { ...project.metadata.learn, [key]: value } } });
  }

  function updateLabMetadata<K extends keyof NonNullable<BuilderProject['metadata']>['lab']>(key: K, value: NonNullable<BuilderProject['metadata']>['lab'][K]) {
    if (!project?.metadata) return;
    snapshot();
    commit({ ...project, metadata: { ...project.metadata, lab: { ...project.metadata.lab, [key]: value } } });
  }

  function updateHubMetadata<K extends keyof NonNullable<BuilderProject['metadata']>['hub']>(key: K, value: NonNullable<BuilderProject['metadata']>['hub'][K]) {
    if (!project?.metadata) return;
    snapshot();
    commit({ ...project, metadata: { ...project.metadata, hub: { ...project.metadata.hub, [key]: value } } });
  }

  function exportProject() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeSlug(project.name) || 'spark-project'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Backup berhasil diekspor');
  }

  async function importProject(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('too-large');
      const next = normalizeProject(JSON.parse(await file.text()) as BuilderProject);
      if (!next) throw new Error('invalid');
      snapshot();
      commit(next);
      activePageId = next.pages[0].id;
      activePanel = null;
      showToast('Backup berhasil diimpor');
    } catch {
      showToast('File backup tidak valid');
    } finally {
      input.value = '';
    }
  }

  function updateBlock(block: BuilderBlock) {
    if (!page) return;
    updateBlocks(page.blocks.map((item) => item.id === block.id ? block : item));
    selectedBlockId = null;
    showToast('Perubahan disimpan');
  }

  function removeBlock() {
    if (!page || !selectedBlockId) return;
    updateBlocks(page.blocks.filter((item) => item.id !== selectedBlockId));
    selectedBlockId = null;
    showToast('Blok dihapus');
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!page) return;
    const target = index + direction;
    if (target < 0 || target >= page.blocks.length) return;
    const blocks = [...page.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateBlocks(blocks);
  }

  function addPage() {
    if (!project) return;
    snapshot();
    const nextPage = { id: crypto.randomUUID(), title: 'Halaman baru', slug: `halaman-${project.pages.length + 1}`, status: 'draft' as const, seo: { title: 'Halaman baru', description: '', image: '', noIndex: false }, blocks: [createBlock('hero')], updatedAt: new Date().toISOString() };
    commit({ ...project, pages: [...project.pages, nextPage] });
    activePageId = nextPage.id;
  }

  function copyActivePage() {
    if (!project || !page) return;
    snapshot();
    const copy = duplicatePage(page);
    commit({ ...project, pages: [...project.pages, copy] });
    activePageId = copy.id;
  }

  function deleteActivePage() {
    if (!project || !page || project.pages.length === 1) return;
    snapshot();
    const pages = project.pages.filter((item) => item.id !== page.id);
    commit({ ...project, pages });
    activePageId = pages[0].id;
    showToast('Halaman dihapus');
  }

  function handleShortcut(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, select')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (event.key === 'Escape') {
      selectedBlockId = null;
      activePanel = null;
    }
  }

  function renamePage(title: string) {
    if (!project || !page) return;
    const next = { ...project, pages: project.pages.map((item) => item.id === page.id ? { ...item, title, slug: safeSlug(title), updatedAt: new Date().toISOString() } : item) };
    commit(next);
  }

  function undo() {
    if (!project || history.length === 0) return;
    future = [JSON.stringify(project), ...future];
    const previous = history.at(-1)!;
    history = history.slice(0, -1);
    commit(JSON.parse(previous));
  }

  function redo() {
    if (!project || future.length === 0) return;
    history = [...history, JSON.stringify(project)];
    const next = future[0];
    future = future.slice(1);
    commit(JSON.parse(next));
  }

  async function publish() {
    if (!project || !page) return;
    publishing = true;
    try {
      const publishProject = { ...project, pages: project.pages.map((item) => item.id === page.id ? { ...item, status: 'published' as const } : item) };
      if (session?.backendMode === 'draft') {
        const result = await new SparkApiPublishAdapter().publish(publishProject, backendRevision);
        if (!result.ok) throw new Error(result.message);
        commit(publishProject);
      } else {
        const record = await gateway.save(publishProject, backendRevision);
        backendRevision = record.revision;
        lastSyncedJson = JSON.stringify(record.project);
        const result = await new SparkApiPublishAdapter().publish(record.project, record.revision);
        if (!result.ok) throw new Error(result.message);
        commit(record.project);
      }
      showToast('Situs berhasil diterbitkan');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Publikasi gagal.');
    } finally {
      publishing = false;
    }
  }

  async function syncProject(silent = false) {
    if (!project) return;
    syncing = true;
    try {
      const record = await gateway.save(project, backendRevision);
      backendRevision = record.revision;
      commit(record.project);
      lastSyncedJson = JSON.stringify(record.project);
      if (!silent) showToast(`Backend tersinkron, revisi ${record.revision}`);
    } catch (error) {
      const message = error instanceof BuilderGatewayError && error.code === 'revision_conflict'
        ? 'Ada revisi baru di server. Muat ulang sebelum menyimpan.'
        : error instanceof Error ? error.message : 'Sinkronisasi backend gagal.';
      showToast(message);
    } finally {
      syncing = false;
    }
  }

  async function login(email: string, password: string) {
    session = await gateway.login(email, password);
    if (!project) return;
    try {
      const record = await gateway.load(project.id);
      project = record.project;
      backendRevision = record.revision;
      activePageId = record.project.pages[0].id;
      saveProject(record.project);
      lastSyncedJson = JSON.stringify(record.project);
    } catch (error) {
      if (!(error instanceof BuilderGatewayError) || error.code !== 'not_found') throw error;
      projectList = await gateway.projects();
      if (projectList.length) await switchProject(projectList[0].id);
      else await syncProject(true);
    }
  }

  async function openProjects() {
    activePanel = 'projects';
    try { projectList = await gateway.projects(); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Daftar proyek gagal dimuat.'); }
  }

  function openBlocks() {
    insertAt = null;
    activePanel = activePanel === 'blocks' ? null : 'blocks';
  }

  function openTemplates() {
    activePanel = activePanel === 'templates' ? null : 'templates';
  }

  function openPages() {
    activePanel = activePanel === 'pages' ? null : 'pages';
  }

  function openModules() {
    activePanel = activePanel === 'modules' ? null : 'modules';
  }

  function openAssistant() {
    activePanel = activePanel === 'assistant' ? null : 'assistant';
  }

  function openLayers() {
    activePanel = activePanel === 'layers' ? null : 'layers';
  }

  function openTheme() {
    activePanel = activePanel === 'theme' ? null : 'theme';
  }

  function openSettings() {
    activePanel = activePanel === 'settings' ? null : 'settings';
    if (activePanel === 'settings') void loadAiSettings();
  }

  function openMore() {
    activePanel = activePanel === 'more' ? null : 'more';
  }

  async function switchProject(projectId: string) {
    try {
      const record = await gateway.load(projectId);
      project = record.project;
      backendRevision = record.revision;
      activePageId = record.project.pages[0].id;
      saveProject(record.project);
      lastSyncedJson = JSON.stringify(record.project);
      activePanel = null;
      history = [];
      future = [];
    } catch (error) { showToast(error instanceof Error ? error.message : 'Proyek gagal dimuat.'); }
  }

  function newProject() {
    const next = starterProject();
    project = next;
    backendRevision = 0;
    activePageId = next.pages[0].id;
    activePanel = null;
    history = [];
    future = [];
    saveProject(next);
    void syncProject(true);
  }

  async function logout() {
    await gateway.logout();
    session = await gateway.session();
  }

  async function openRevisions() {
    if (!project) return;
    activePanel = 'revisions';
    try { revisions = await gateway.revisions(project.id); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Riwayat gagal dimuat.'); }
  }

  async function openMedia() {
    activePanel = 'media';
    try { mediaAssets = await gateway.media(); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Media gagal dimuat.'); }
  }

  async function uploadMedia(
    file: File,
    folder = '',
    input: { parentAssetId?: string; variantRole?: string; variantWidth?: number; focalX?: number; focalY?: number } = {},
    silent = false
  ) {
    try {
      const asset = await gateway.upload(file, folder, input);
      mediaAssets = await gateway.media();
      if (!silent) showToast('Media berhasil diunggah');
      return asset;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload gagal.');
      return null;
    }
  }

  async function uploadMediaWithOptimization(file: File, folder = '') {
    const prepared = await prepareImageUploadPlan(file);
    const master = await uploadMedia(prepared.file, folder, {}, prepared.optimized);
    if (!master) return;
    for (const variant of prepared.variants) {
      await uploadMedia(variant.file, folder, {
        parentAssetId: master.id,
        variantRole: variant.role,
        variantWidth: variant.width
      }, true);
    }
    mediaAssets = await gateway.media();
    if (prepared.optimized) {
      showToast(`Gambar dioptimalkan otomatis (${Math.ceil(prepared.originalSize / 1024)} KB → ${Math.ceil(prepared.optimizedSize / 1024)} KB)`);
      return;
    }
    if (prepared.variants.length) showToast(`Media berhasil diunggah dengan ${prepared.variants.length} varian responsif.`);
  }

  async function uploadMediaBatch(files: File[], folder = '') {
    if (!files.length) return;
    uploading = true;
    try {
      for (const file of files) await uploadMediaWithOptimization(file, folder);
    } finally {
      uploading = false;
    }
  }

  function insertMedia(asset: BuilderMediaAsset) {
    if (!page) return;
    const type = asset.contentType.startsWith('video/') ? 'video' : asset.contentType === 'application/json' ? 'lottie' : 'image';
    const block = createBlock(type);
    block.data = type === 'image'
      ? {
        ...block.data,
        src: asset.url,
        srcset: asset.variants.length ? asset.variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ') : '',
        sizes: '100vw',
        focalX: String(asset.focalX),
        focalY: String(asset.focalY),
        alt: asset.fileName,
        caption: ''
      }
      : type === 'video'
        ? { ...block.data, src: asset.url, title: asset.fileName, caption: '' }
        : { ...block.data, src: asset.url, title: asset.fileName };
    updateBlocks([...page.blocks, block]);
    selectedBlockId = block.id;
    activePanel = null;
  }

  function createSymbolBlock(componentId: string): BuilderBlock {
    const symbol = createBlock('symbol');
    symbol.data.componentId = componentId;
    return symbol;
  }

  async function renameMedia(assetId: string, fileName: string) {
    try {
      await gateway.updateMedia(assetId, { fileName });
      mediaAssets = await gateway.media();
      showToast('Nama file diperbarui');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Nama file gagal diperbarui.');
    }
  }

  async function moveMedia(assetId: string, folder: string) {
    try {
      await gateway.updateMedia(assetId, { folder });
      mediaAssets = await gateway.media();
      showToast(folder.trim() ? 'File dipindahkan ke folder baru' : 'File dipindahkan ke root');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Folder file gagal diperbarui.');
    }
  }

  async function removeMedia(assetId: string) {
    try {
      await gateway.deleteMedia(assetId);
      mediaAssets = await gateway.media();
      showToast('File dihapus');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'File gagal dihapus.');
    }
  }

  async function updateMediaFocus(assetId: string, focalX: number, focalY: number) {
    try {
      await gateway.updateMedia(assetId, { focalX, focalY });
      mediaAssets = await gateway.media();
      showToast('Focal point diperbarui');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Focal point gagal diperbarui.');
    }
  }

  function saveReusable(block: BuilderBlock) {
    if (!project || block.type === 'symbol') return;
    const name = block.data.title || block.data.quote || `${block.type} component`;
    snapshot();
    const nextComponent = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      category: block.type === 'hero' ? 'Hero' : block.type === 'image' || block.type === 'video' || block.type === 'gallery' || block.type === 'lottie' ? 'Media' : block.type === 'cta' || block.type === 'form' ? 'Conversion' : 'Content',
      description: `Komponen global dari blok ${block.type}.`,
      updatedAt: new Date().toISOString(),
      blocks: [{ ...structuredClone(block), id: crypto.randomUUID() }]
    } satisfies NonNullable<BuilderProject['componentLibrary']>[number];
    commit({ ...project, componentLibrary: [...(project.componentLibrary ?? []), nextComponent] });
    selectedBlockId = null;
    showToast('Blok disimpan ke library komponen');
  }

  function insertComponent(componentId: string) {
    if (!project || !page) return;
    const component = project.componentLibrary?.find((item) => item.id === componentId);
    if (!component) return;
    updateBlocks([...page.blocks, createSymbolBlock(componentId)]);
    activePanel = null;
    showToast(`Komponen "${component.name}" ditambahkan`);
  }

  function savePageAsComponent() {
    if (!project || !page || page.blocks.length === 0) return;
    snapshot();
    const nextComponent = {
      id: crypto.randomUUID(),
      name: page.title.slice(0, 80) || 'Section',
      category: 'Section',
      description: `Section global dari halaman ${page.title}.`,
      updatedAt: new Date().toISOString(),
      blocks: page.blocks
        .filter((block) => block.type !== 'symbol')
        .map((block) => ({ ...structuredClone(block), id: crypto.randomUUID() }))
    } satisfies NonNullable<BuilderProject['componentLibrary']>[number];
    if (!nextComponent.blocks.length) {
      showToast('Section hanya bisa dibuat dari blok biasa, bukan reference symbol.');
      return;
    }
    commit({ ...project, componentLibrary: [...(project.componentLibrary ?? []), nextComponent] });
    showToast('Halaman aktif disimpan sebagai section global');
  }

  function overwriteComponentFromPage(componentId: string) {
    if (!project || !page) return;
    const component = project.componentLibrary?.find((item) => item.id === componentId);
    if (!component) return;
    const sourceBlocks = page.blocks.filter((block) => block.type !== 'symbol').map((block) => ({ ...structuredClone(block), id: crypto.randomUUID() }));
    if (!sourceBlocks.length) {
      showToast('Section sumber kosong atau hanya berisi symbol.');
      return;
    }
    snapshot();
    commit({
      ...project,
      componentLibrary: (project.componentLibrary ?? []).map((item) => item.id === componentId ? {
        ...item,
        blocks: sourceBlocks,
        updatedAt: new Date().toISOString()
      } : item)
    });
    showToast(`Source komponen "${component.name}" diperbarui dari halaman aktif`);
  }

  function deleteComponent(componentId: string) {
    if (!project) return;
    if (project.pages.some((candidate) => candidate.blocks.some((block) => block.type === 'symbol' && block.data.componentId === componentId))) {
      showToast('Komponen masih dipakai oleh halaman. Lepas symbol dulu sebelum menghapus.');
      return;
    }
    snapshot();
    commit({ ...project, componentLibrary: (project.componentLibrary ?? []).filter((item) => item.id !== componentId) });
    showToast('Komponen dihapus dari library');
  }

  function dropBlock(targetIndex: number) {
    if (!page || draggedIndex === null || draggedIndex === targetIndex) return;
    const blocks = [...page.blocks];
    const [moved] = blocks.splice(draggedIndex, 1);
    blocks.splice(targetIndex, 0, moved);
    draggedIndex = null;
    updateBlocks(blocks);
  }

  async function openSubmissions() {
    activePanel = 'submissions';
    try { submissions = await gateway.submissions(); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Inbox gagal dimuat.'); }
  }

  async function loadAiSettings() {
    if (aiSettingsLoading || !session?.authenticated) return;
    aiSettingsLoading = true;
    try {
      aiSettings = await gateway.aiSettings();
      aiProvider = aiSettings.provider;
      aiModel = aiSettings.model;
      aiBaseUrl = aiSettings.apiBaseUrl;
      aiApiKey = '';
    } catch (error) {
      if (!(error instanceof BuilderGatewayError) || error.code !== 'backend_unavailable') {
        showToast(error instanceof Error ? error.message : 'Pengaturan AI gagal dimuat.');
      }
    } finally {
      aiSettingsLoading = false;
    }
  }

  async function saveAiSettings() {
    if (aiSettingsSaving) return;
    aiSettingsSaving = true;
    try {
      aiSettings = await gateway.saveAiSettings({
        provider: aiProvider,
        apiKey: aiApiKey.trim() ? aiApiKey.trim() : undefined,
        model: aiModel.trim() || 'gpt-4.1-mini',
        apiBaseUrl: aiBaseUrl.trim() || 'https://api.openai.com/v1'
      });
      aiProvider = aiSettings.provider;
      aiModel = aiSettings.model;
      aiBaseUrl = aiSettings.apiBaseUrl;
      aiApiKey = '';
      showToast(aiSettings.hasApiKey ? 'API key AI tersimpan' : 'Pengaturan AI diperbarui');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Pengaturan AI gagal disimpan.');
    } finally {
      aiSettingsSaving = false;
    }
  }

  async function clearAiSettingsKey() {
    if (aiSettingsSaving) return;
    aiSettingsSaving = true;
    try {
      aiSettings = await gateway.saveAiSettings({
        provider: aiProvider,
        apiKey: '',
        model: aiModel.trim() || 'gpt-4.1-mini',
        apiBaseUrl: aiBaseUrl.trim() || 'https://api.openai.com/v1'
      });
      aiApiKey = '';
      showToast('API key AI dihapus');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'API key AI gagal dihapus.');
    } finally {
      aiSettingsSaving = false;
    }
  }

  async function exportStaticSite() {
    if (!project) return;
    try {
      const blob = await gateway.exportStatic(project, exportTarget);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeSlug(project.name) || 'spark-site'}${exportTarget === 'nextjs' ? '-nextjs' : ''}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast(exportTarget === 'nextjs' ? 'Export Next.js selesai' : 'Export situs statis selesai');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Export gagal.'); }
  }

  function updateSite(key: 'headerTitle' | 'footerText' | 'homePageId' | 'formAction', value: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), [key]: value } });
  }

  function updateSiteLink(key: 'headerCtaLabel' | 'headerCtaHref', value: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), [key]: value } });
  }

  function addNavigationItem() {
    if (!project || !page) return;
    const item = { id: crypto.randomUUID(), label: page.title, pageId: page.id };
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), navigation: [...(project.site?.navigation ?? []), item] } });
  }

  function updateNavigationItem(id: string, key: 'label' | 'pageId', value: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), navigation: (project.site?.navigation ?? []).map((item) => item.id === id ? { ...item, [key]: value } : item) } });
  }

  function moveNavigationItem(id: string, direction: -1 | 1) {
    if (!project?.site?.navigation?.length) return;
    const items = [...project.site.navigation];
    const index = items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    snapshot();
    commit({ ...project, site: { ...project.site, navigation: items } });
  }

  function removeNavigationItem(id: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), navigation: (project.site?.navigation ?? []).filter((item) => item.id !== id) } });
  }

  function addFooterLink() {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), footerLinks: [...(project.site?.footerLinks ?? []), { id: crypto.randomUUID(), label: 'Link baru', href: '/' }] } });
  }

  function updateFooterLink(id: string, key: 'label' | 'href', value: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), footerLinks: (project.site?.footerLinks ?? []).map((item) => item.id === id ? { ...item, [key]: value } : item) } });
  }

  function removeFooterLink(id: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [] }), footerLinks: (project.site?.footerLinks ?? []).filter((item) => item.id !== id) } });
  }

  async function restoreRevision(revision: number) {
    if (!project) return;
    try {
      const record = await gateway.restore(project.id, revision, backendRevision);
      project = record.project;
      backendRevision = record.revision;
      activePageId = record.project.pages[0].id;
      saveProject(record.project);
      lastSyncedJson = JSON.stringify(record.project);
      await openRevisions();
      showToast(`Revisi ${revision} dipulihkan sebagai revisi ${record.revision}`);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Restore gagal.'); }
  }

  function showToast(message: string) {
    toast = message;
    setTimeout(() => { if (toast === message) toast = ''; }, 2200);
  }
</script>

<svelte:window onkeydown={handleShortcut} />

<svelte:head><title>Spark Builder - Mobile website editor</title><meta name="description" content="Builder konten mobile-first untuk ekosistem Karyra Spark." /></svelte:head>

{#if sessionLoading || !project || !page}
  <main class="loading"><div class="brand-mark">S</div><p>Menyiapkan builder...</p></main>
{:else if session?.backendMode !== 'draft' && !session?.authenticated}
  <LoginScreen onlogin={login} />
{:else}
  <div class:preview-mode={preview} class="builder-app" style={`--theme-primary:${project.theme?.primary};--theme-accent:${project.theme?.accent};--theme-surface:${project.theme?.surface};--theme-text:${project.theme?.text};--button-radius:${project.theme?.buttonRadius === 'square' ? '4px' : project.theme?.buttonRadius === 'soft' ? '14px' : '999px'};--content-width:${project.theme?.contentWidth === 'compact' ? '920px' : project.theme?.contentWidth === 'wide' ? '1280px' : '1100px'};--section-gap:${project.theme?.sectionGap === 'tight' ? '10px' : project.theme?.sectionGap === 'relaxed' ? '18px' : '12px'}`} data-font={project.theme?.font} data-surface={project.theme?.surfaceStyle ?? 'flat'}>
    <header class="topbar">
      <div class="topbar-left"><button class="round-button" aria-label="Daftar proyek" onclick={openProjects}><Icon name="back" /></button><div class="document-name"><input value={page.title} onchange={(event) => renamePage(event.currentTarget.value)} aria-label="Nama halaman" /><span><i class:published={page.status === 'published'}></i>{page.status === 'published' ? 'Terbit' : 'Draf tersimpan'}</span></div></div>
      <div class="topbar-actions"><div class="device-switch"><button class:active={device === 'mobile'} onclick={() => device = 'mobile'}>M</button><button class:active={device === 'tablet'} onclick={() => device = 'tablet'}>T</button><button class:active={device === 'desktop'} onclick={() => device = 'desktop'}>D</button></div><button class="icon-action" onclick={undo} disabled={history.length === 0} aria-label="Urungkan"><Icon name="undo" /></button><button class="icon-action" onclick={redo} disabled={future.length === 0} aria-label="Ulangi"><Icon name="redo" /></button><button class="preview-button" class:active={preview} onclick={() => preview = !preview}><Icon name="eye" size={18} /><span>{preview ? 'Edit' : 'Preview'}</span></button><button class="publish-button" onclick={publish} disabled={publishing}>{publishing ? 'Memproses...' : 'Terbitkan'}</button></div>
    </header>

    <div class="workspace">
      <aside class="desktop-rail">
        <div class="rail-brand"><div class="brand-mark">S</div><strong>Spark<br />Builder</strong></div>
        <nav><button class:active={activePanel === 'blocks'} onclick={() => { insertAt = null; activePanel = activePanel === 'blocks' ? null : 'blocks'; }}><Icon name="plus" /><span>Tambah</span></button><button class:active={activePanel === 'templates'} onclick={() => activePanel = activePanel === 'templates' ? null : 'templates'}><Icon name="pages" /><span>Template</span></button><button class:active={activePanel === 'pages'} onclick={() => activePanel = activePanel === 'pages' ? null : 'pages'}><Icon name="pages" /><span>Halaman</span></button><button class:active={activePanel === 'layers'} onclick={() => activePanel = activePanel === 'layers' ? null : 'layers'}><Icon name="layers" /><span>Lapisan</span></button><button class:active={activePanel === 'media'} onclick={openMedia}><Icon name="eye" /><span>Media</span></button><button class:active={activePanel === 'theme'} onclick={() => activePanel = activePanel === 'theme' ? null : 'theme'}><Icon name="palette" /><span>Tema</span></button></nav>
        <button class="rail-settings" class:active={activePanel === 'settings'} onclick={() => activePanel = activePanel === 'settings' ? null : 'settings'}><Icon name="settings" /><span>Setelan</span></button>
      </aside>

      {#if activePanel}
        <aside class="library-panel">
          <header><div><span>EDITOR</span><h2>{panelTitle}</h2></div><button class="round-button" onclick={() => activePanel = null}><Icon name="close" /></button></header>
          {#if activePanel === 'projects'}
            <p>Pilih proyek yang tersimpan di backend atau buat workspace baru.</p><button class="new-project" onclick={newProject}><Icon name="plus" /> Proyek baru</button><div class="project-list">{#each projectList as item}<button class:active={item.id === project.id} onclick={() => switchProject(item.id)}><strong>{item.name}</strong><small>Revisi {item.revision} · {new Date(item.updatedAt).toLocaleString('id-ID')}</small><span>{item.publishedRevision ? 'Terbit' : 'Draf'}</span></button>{/each}</div>
          {:else if activePanel === 'blocks'}
            <p>Pilih blok yang ingin ditambahkan ke bagian bawah halaman.</p><div class="block-library">{#each blockCatalog as item}<button onclick={() => addBlock(item.type)}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><Icon name="plus" size={17} /></button>{/each}</div>
          {:else if activePanel === 'modules'}
            <ModuleLibrary modules={moduleCatalog} insertAtLabel={insertAt === null ? 'akhir halaman' : `posisi blok ${insertAt + 1}`} oninsert={insertModule} onclose={() => activePanel = null} />
          {:else if activePanel === 'assistant'}
            {#if assistantReport}
              <DesignAssistant
                report={assistantReport}
                brief={assistantBrief}
                modules={moduleCatalog}
                onbriefchange={(value) => assistantBrief = value}
                onrun={() => { assistantBrief = assistantBrief.trim() || 'Fokus pada mobile, CTA, dan hierarki visual.'; assistantTick += 1; }}
                onopenblocks={openBlocks}
                onopenmodules={openModules}
                onopensettings={openSettings}
                onpreview={() => preview = !preview}
                oninsertmodule={insertModule}
                onclose={() => activePanel = null}
              />
            {/if}
          {:else if activePanel === 'templates'}
            <p>Template mengganti isi halaman aktif. Library komponen menyimpan source global yang bisa dipakai ulang lewat symbol block.</p>
            <div class="template-list">{#each templates as template}<button onclick={() => applyTemplate(template.id)} style={`--template-color:${template.color}`}><i></i><strong>{template.name}</strong><small>{template.description}</small><span>Gunakan template</span></button>{/each}</div>
            <div class="page-actions"><button onclick={savePageAsComponent}><Icon name="plus" /> Simpan halaman aktif ke library</button></div>
            {#if project.componentLibrary?.length}
              <h3 class="panel-subtitle">Global component library</h3>
              <div class="block-library">
                {#each project.componentLibrary as component}
                  <article class="component-card">
                    <button onclick={() => insertComponent(component.id)}><span>SYM</span><div><strong>{component.name}</strong><small>{component.category} · {component.blocks.length} blok · {new Date(component.updatedAt).toLocaleDateString('id-ID')}</small></div><Icon name="plus" size={17} /></button>
                    <div class="component-card-actions">
                      <button class="secondary-action" onclick={() => overwriteComponentFromPage(component.id)}>Update dari halaman aktif</button>
                      <button class="danger-action" onclick={() => deleteComponent(component.id)}>Hapus</button>
                    </div>
                  </article>
                {/each}
              </div>
            {/if}
          {:else if activePanel === 'pages'}
            <div class="page-list">{#each project.pages as item}<button class:active={item.id === page.id} onclick={() => { activePageId = item.id; activePanel = null; }}><span>{item.title.slice(0, 1)}</span><div><strong>{item.title}</strong><small>/{item.slug}</small></div></button>{/each}</div><div class="page-actions"><button onclick={addPage}><Icon name="plus" /> Baru</button><button onclick={copyActivePage}><Icon name="pages" /> Duplikasi</button><button class="danger-action" onclick={deleteActivePage} disabled={project.pages.length === 1}><Icon name="trash" /> Hapus</button></div>
          {:else if activePanel === 'layers'}
            <p>Kelola urutan dan pilih bagian halaman dengan cepat.</p><div class="layer-list">{#each page.blocks as block, index}<button class:selected={selectedBlockId === block.id} onclick={() => { selectedBlockId = block.id; activePanel = null; }}><span>{index + 1}</span><strong>{block.type === 'symbol' ? (project.componentLibrary?.find((item) => item.id === block.data.componentId)?.name ?? 'symbol') : block.type}</strong><small>{block.type === 'symbol' ? 'Reference komponen global' : block.data.title ?? block.data.quote ?? block.data.caption ?? 'Elemen halaman'}</small><i>{block.style.hiddenOn?.length ? `${block.style.hiddenOn.length} hidden` : ''}</i></button>{/each}</div>
          {:else if activePanel === 'media'}
            <MediaLibrary assets={mediaAssets} {uploading} onupload={uploadMediaBatch} onselect={insertMedia} onrename={renameMedia} onmove={moveMedia} ondelete={removeMedia} onfocus={updateMediaFocus} />
          {:else if activePanel === 'theme' && project.theme}
            <p>Token global menjaga warna, ritme, dan lebar konten tetap konsisten di preview, publish, static export, dan Next.js export.</p>
            <div class="settings-form">
              <div class="theme-preset-list">
                {#each themePresets as preset}
                  <button onclick={() => applyThemePreset(preset.id)}>
                    <span style={`--swatch-primary:${preset.theme.primary};--swatch-accent:${preset.theme.accent};--swatch-surface:${preset.theme.surface}`}></span>
                    <strong>{preset.name}</strong>
                    <small>{preset.description}</small>
                  </button>
                {/each}
              </div>
              <div class="theme-colors"><label>Utama<input type="color" value={project.theme.primary} onchange={(event) => updateTheme('primary', event.currentTarget.value)} /></label><label>Aksen<input type="color" value={project.theme.accent} onchange={(event) => updateTheme('accent', event.currentTarget.value)} /></label><label>Permukaan<input type="color" value={project.theme.surface} onchange={(event) => updateTheme('surface', event.currentTarget.value)} /></label><label>Teks<input type="color" value={project.theme.text} onchange={(event) => updateTheme('text', event.currentTarget.value)} /></label></div>
              <label>Gaya font<select value={project.theme.font} onchange={(event) => updateTheme('font', event.currentTarget.value)}><option value="modern">Modern</option><option value="friendly">Friendly</option><option value="editorial">Editorial</option></select></label>
              <label>Sudut tombol<select value={project.theme.buttonRadius} onchange={(event) => updateTheme('buttonRadius', event.currentTarget.value)}><option value="pill">Pill</option><option value="soft">Soft</option><option value="square">Square</option></select></label>
              <label>Lebar konten<select value={project.theme.contentWidth ?? 'standard'} onchange={(event) => updateTheme('contentWidth', event.currentTarget.value)}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
              <label>Jarak section<select value={project.theme.sectionGap ?? 'normal'} onchange={(event) => updateTheme('sectionGap', event.currentTarget.value)}><option value="tight">Tight</option><option value="normal">Normal</option><option value="relaxed">Relaxed</option></select></label>
              <label>Surface style<select value={project.theme.surfaceStyle ?? 'flat'} onchange={(event) => updateTheme('surfaceStyle', event.currentTarget.value)}><option value="flat">Flat</option><option value="tinted">Tinted</option><option value="contrast">Contrast</option></select></label>
            </div>
          {:else if activePanel === 'revisions'}
            <p>Setiap penyimpanan backend menghasilkan snapshot immutable.</p><div class="revision-list">{#each revisions as item}<article><div><strong>Revisi {item.revision}</strong><small>{new Date(item.createdAt).toLocaleString('id-ID')} · {item.createdBy}</small></div><button onclick={() => restoreRevision(item.revision)} disabled={item.revision === backendRevision}>Pulihkan</button></article>{/each}{#if revisions.length === 0}<small>Belum ada revisi tersimpan.</small>{/if}</div>
          {:else if activePanel === 'submissions'}
            <p>Submission terbaru dari formulir pada situs publik.</p><div class="submission-list">{#each submissions as item}<article><small>{new Date(item.createdAt).toLocaleString('id-ID')}</small>{#each Object.entries(item.payload) as [key, value]}<div><strong>{key}</strong><span>{value}</span></div>{/each}</article>{/each}{#if submissions.length === 0}<small>Belum ada submission.</small>{/if}</div>
          {:else if activePanel === 'settings' && page.seo}
            <p>Atur identitas situs, metadata mesin pencari, backup, sinkronisasi, dan koneksi AI eksternal.</p>
            <div class="settings-form">
              <label>Nama proyek<input value={project.name} onchange={(event) => updateProjectName(event.currentTarget.value)} /></label>
              <label>Judul header<input value={project.site?.headerTitle ?? project.name} onchange={(event) => updateSite('headerTitle', event.currentTarget.value)} /></label>
              <label>Teks footer<input value={project.site?.footerText ?? ''} onchange={(event) => updateSite('footerText', event.currentTarget.value)} /></label>
              <label>Teks CTA header<input value={project.site?.headerCtaLabel ?? ''} onchange={(event) => updateSiteLink('headerCtaLabel', event.currentTarget.value)} /></label>
              <label>Tautan CTA header<input value={project.site?.headerCtaHref ?? ''} onchange={(event) => updateSiteLink('headerCtaHref', event.currentTarget.value)} /></label>
              <label>Home page<select value={project.site?.homePageId ?? page.id} onchange={(event) => updateSite('homePageId', event.currentTarget.value)}>{#each project.pages as item}<option value={item.id}>{item.title}</option>{/each}</select></label>
              <label>Form action publik<input value={project.site?.formAction ?? ''} placeholder="https://forms.example.com/submit" onchange={(event) => updateSite('formAction', event.currentTarget.value)} /><small>Kosongkan bila target runtime akan menyuntikkan endpoint form sendiri.</small></label>
              <div class="settings-subsection">
                <h3>Navbar builder</h3>
                <small>Kontrol label, urutan, dan halaman tujuan untuk navigasi header.</small>
              </div>
              <div class="nav-editor">
                {#each project.site?.navigation ?? [] as item, index}
                  <div class="nav-editor-row">
                    <input value={item.label} onchange={(event) => updateNavigationItem(item.id, 'label', event.currentTarget.value)} />
                    <select value={item.pageId} onchange={(event) => updateNavigationItem(item.id, 'pageId', event.currentTarget.value)}>{#each project.pages as candidate}<option value={candidate.id}>{candidate.title}</option>{/each}</select>
                    <button class="icon-action" onclick={() => moveNavigationItem(item.id, -1)} disabled={index === 0} aria-label="Naik"><Icon name="up" size={16} /></button>
                    <button class="icon-action" onclick={() => moveNavigationItem(item.id, 1)} disabled={index === (project.site?.navigation?.length ?? 1) - 1} aria-label="Turun"><Icon name="down" size={16} /></button>
                    <button class="danger-action" onclick={() => removeNavigationItem(item.id)}>Hapus</button>
                  </div>
                {/each}
                <button class="secondary-action" onclick={addNavigationItem}>Tambah item navigasi</button>
              </div>

              <div class="settings-subsection">
                <h3>Footer builder</h3>
                <small>Kelola kumpulan tautan footer tanpa harus membuat blok terpisah.</small>
              </div>
              <div class="nav-editor">
                {#each project.site?.footerLinks ?? [] as link}
                  <div class="nav-editor-row">
                    <input value={link.label} onchange={(event) => updateFooterLink(link.id, 'label', event.currentTarget.value)} />
                    <input value={link.href} onchange={(event) => updateFooterLink(link.id, 'href', event.currentTarget.value)} />
                    <button class="danger-action" onclick={() => removeFooterLink(link.id)}>Hapus</button>
                  </div>
                {/each}
                <button class="secondary-action" onclick={addFooterLink}>Tambah link footer</button>
              </div>
              <label>Judul SEO<input value={page.seo.title} maxlength="60" onchange={(event) => updateSeo('title', event.currentTarget.value)} /><small>{page.seo.title.length}/60 karakter</small></label>
              <label>Deskripsi SEO<textarea rows="3" maxlength="160" value={page.seo.description} onchange={(event) => updateSeo('description', event.currentTarget.value)}></textarea><small>{page.seo.description.length}/160 karakter</small></label>
              <label>Social image HTTPS<input value={page.seo.image} onchange={(event) => updateSeo('image', event.currentTarget.value)} /></label>
              <label class="check-row"><input type="checkbox" checked={page.seo.noIndex} onchange={(event) => updateSeo('noIndex', event.currentTarget.checked)} />Sembunyikan dari mesin pencari</label>

              <div class="settings-subsection">
                <h3>Core / Learn / Lab / Hub</h3>
                <small>Metadata ini ikut masuk ke render contract dan artifact export untuk consumer seperti Spark dan Hub.</small>
              </div>
              <label>Jenis proyek<select value={project.metadata?.kind ?? 'site'} onchange={(event) => updateProjectMetadata('kind', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['kind'])}><option value="site">Site</option><option value="core">Core</option><option value="learn">Learn</option><option value="lab">Lab</option><option value="hub">Hub</option></select></label>
              <label>Audience<input value={project.metadata?.audience ?? ''} onchange={(event) => updateProjectMetadata('audience', event.currentTarget.value)} /></label>
              <label>Level<select value={project.metadata?.level ?? 'mixed'} onchange={(event) => updateProjectMetadata('level', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['level'])}><option value="mixed">Mixed</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
              <label>Durasi (menit)<input type="number" min="0" max="1440" value={project.metadata?.durationMinutes ?? ''} onchange={(event) => updateProjectMetadata('durationMinutes', event.currentTarget.value ? Number(event.currentTarget.value) : null)} /></label>
              <label>Ringkasan proyek<textarea rows="3" maxlength="400" value={project.metadata?.summary ?? ''} onchange={(event) => updateProjectMetadata('summary', event.currentTarget.value)}></textarea></label>
              <label>Tags<input value={(project.metadata?.tags ?? []).join(', ')} placeholder="web3, mobile, onboarding" onchange={(event) => updateProjectMetadata('tags', event.currentTarget.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20))} /></label>
              <label>Visibility target<select value={project.metadata?.visibilityTarget ?? 'spark'} onchange={(event) => updateProjectMetadata('visibilityTarget', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['visibilityTarget'])}><option value="spark">Spark</option><option value="spark-hub">Spark Hub</option><option value="both">Both</option></select></label>

              <div class="settings-subsection">
                <h3>Learn metadata</h3>
                <small>Gunakan untuk course, path, dan authoring lesson yang nanti dipisah ke CMS khusus.</small>
              </div>
              <label>Track learn<input value={project.metadata?.learn.track ?? ''} onchange={(event) => updateLearnMetadata('track', event.currentTarget.value)} /></label>
              <label>Format learn<select value={project.metadata?.learn.format ?? 'path'} onchange={(event) => updateLearnMetadata('format', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['learn']['format'])}><option value="lesson">Lesson</option><option value="path">Path</option><option value="cohort">Cohort</option></select></label>
              <label>Learning outcomes<textarea rows="3" value={(project.metadata?.learn.outcomes ?? []).join('\n')} onchange={(event) => updateLearnMetadata('outcomes', event.currentTarget.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 20))}></textarea></label>
              <label>Prerequisite learn<textarea rows="3" value={(project.metadata?.learn.prerequisites ?? []).join('\n')} onchange={(event) => updateLearnMetadata('prerequisites', event.currentTarget.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 20))}></textarea></label>

              <div class="settings-subsection">
                <h3>Lab metadata</h3>
                <small>Fondasi untuk runtime profile, grader, dan orchestration environment.</small>
              </div>
              <label>Lab profile<input value={project.metadata?.lab.profile ?? ''} onchange={(event) => updateLabMetadata('profile', event.currentTarget.value)} /></label>
              <label>Lab runtime<select value={project.metadata?.lab.runtime ?? 'browser'} onchange={(event) => updateLabMetadata('runtime', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['lab']['runtime'])}><option value="browser">Browser</option><option value="container">Container</option><option value="external">External</option></select></label>
              <label>Lab difficulty<select value={project.metadata?.lab.difficulty ?? 'guided'} onchange={(event) => updateLabMetadata('difficulty', event.currentTarget.value as NonNullable<BuilderProject['metadata']>['lab']['difficulty'])}><option value="guided">Guided</option><option value="standard">Standard</option><option value="challenge">Challenge</option></select></label>
              <label>Estimasi lab (menit)<input type="number" min="0" max="1440" value={project.metadata?.lab.estimatedMinutes ?? ''} onchange={(event) => updateLabMetadata('estimatedMinutes', event.currentTarget.value ? Number(event.currentTarget.value) : null)} /></label>

              <div class="settings-subsection">
                <h3>Hub metadata</h3>
                <small>Dipakai untuk listing card, katalog, dan filtering di Spark Hub.</small>
              </div>
              <label class="check-row"><input type="checkbox" checked={project.metadata?.hub.listed ?? false} onchange={(event) => updateHubMetadata('listed', event.currentTarget.checked)} />Tampilkan di Hub</label>
              <label>Kategori Hub<input value={project.metadata?.hub.category ?? ''} onchange={(event) => updateHubMetadata('category', event.currentTarget.value)} /></label>
              <label>Judul card Hub<input value={project.metadata?.hub.cardTitle ?? project.name} onchange={(event) => updateHubMetadata('cardTitle', event.currentTarget.value)} /></label>
              <label>Ringkasan card Hub<textarea rows="3" maxlength="220" value={project.metadata?.hub.cardSummary ?? ''} onchange={(event) => updateHubMetadata('cardSummary', event.currentTarget.value)}></textarea></label>

              <div class="settings-subsection">
                <h3>AI eksternal</h3>
                <small>{aiSettings?.hasApiKey ? `Tersimpan aman · ${aiSettings.provider.toUpperCase()} · ${aiSettings.model}` : 'Belum ada API key. Asisten UI/UX akan tetap memakai analisis lokal.'}</small>
              </div>
              <label>Provider AI<select value={aiProvider} onchange={(event) => aiProvider = event.currentTarget.value as typeof aiProvider}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="custom">Custom</option></select></label>
              <label>Model AI<input value={aiModel} placeholder="gpt-4.1-mini" onchange={(event) => aiModel = event.currentTarget.value} /></label>
              <label>Base URL API<input value={aiBaseUrl} placeholder="https://api.openai.com/v1" onchange={(event) => aiBaseUrl = event.currentTarget.value} /></label>
              <label>API key AI eksternal<input type="password" value={aiApiKey} placeholder={aiSettings?.hasApiKey ? 'Kosongkan untuk mempertahankan key tersimpan' : 'Tempel API key di sini'} onchange={(event) => aiApiKey = event.currentTarget.value} /></label>
              <div class="backup-actions ai-actions">
                <button onclick={saveAiSettings} disabled={aiSettingsSaving || aiSettingsLoading}>{aiSettingsSaving ? 'Menyimpan...' : 'Simpan AI settings'}</button>
                <button class="danger-action" onclick={clearAiSettingsKey} disabled={aiSettingsSaving || aiSettingsLoading || !aiSettings?.hasApiKey}>Hapus key</button>
              </div>

              <BlockchainProvenance project={project} page={page} revision={backendRevision || 0} onclose={() => activePanel = null} />

              <button class="sync-action" onclick={() => syncProject(false)} disabled={syncing}>{syncing ? 'Menyinkronkan...' : `Sinkronkan backend (rev ${backendRevision})`}</button>
              <button class="secondary-action" onclick={openRevisions}>Riwayat revisi</button>
              <button class="secondary-action" onclick={openSubmissions}>Inbox formulir</button>
              <label>Target export<select bind:value={exportTarget}><option value="static-html">Static HTML</option><option value="nextjs">Next.js App Router</option></select></label>
              <button class="secondary-action" onclick={exportStaticSite}>{exportTarget === 'nextjs' ? 'Unduh paket Next.js (.zip)' : 'Unduh situs statis (.zip)'}</button>
              <button class="danger-action standalone" onclick={logout}>Keluar dari builder</button>
              <div class="backup-actions"><button onclick={exportProject}>Ekspor JSON</button><label>Impor JSON<input type="file" accept="application/json" onchange={importProject} /></label></div>
            </div>
          {:else if activePanel === 'more'}
            <p>Aksi cepat untuk navigasi, sinkronisasi, dan pengelolaan builder.</p>
            <div class="quick-actions">
              <button onclick={openTemplates}><Icon name="pages" /><span>Template</span><small>Ganti layout cepat</small></button>
              <button onclick={openModules}><Icon name="pages" /><span>Modul</span><small>Preset komposit</small></button>
              <button onclick={openAssistant}><Icon name="more" /><span>AI UX</span><small>Saran desain mobile</small></button>
              <button onclick={openLayers}><Icon name="layers" /><span>Lapisan</span><small>Pilih blok lebih cepat</small></button>
              <button onclick={openTheme}><Icon name="palette" /><span>Tema</span><small>Warna dan font global</small></button>
              <button onclick={openRevisions}><Icon name="undo" /><span>Revisi</span><small>Lihat snapshot backend</small></button>
              <button onclick={openSubmissions}><Icon name="eye" /><span>Inbox</span><small>Formulir yang masuk</small></button>
              <button onclick={openSettings}><Icon name="settings" /><span>Setelan</span><small>SEO, sinkron, backup</small></button>
              <button onclick={openProjects}><Icon name="back" /><span>Proyek</span><small>Pindah workspace</small></button>
            </div>
            <div class="quick-actions-footer">
              <button class="secondary-action" onclick={() => { activePanel = null; preview = !preview; }}>{preview ? 'Kembali ke edit' : 'Lihat preview'}</button>
              <button class="sync-action" onclick={() => syncProject(false)} disabled={syncing}>{syncing ? 'Menyinkronkan...' : `Sinkronkan backend (rev ${backendRevision})`}</button>
              <button class="danger-action standalone" onclick={logout}>Keluar dari builder</button>
            </div>
          {/if}
        </aside>
      {/if}

      <main class="canvas-area" class:panel-open={activePanel !== null}>
        <div class="canvas-label"><span>Pratinjau {device}</span><span>{device === 'mobile' ? '390 x 844' : device === 'tablet' ? '768 x 1024' : '1280 x 900'}</span></div>
        <article class="phone-canvas" class:tablet-canvas={device === 'tablet'} class:desktop-canvas={device === 'desktop'}>
          <div class="site-header"><a href="/" aria-label="Spark"><span class="mini-mark">S</span><strong>{project.site?.headerTitle ?? project.name}</strong></a><button aria-label="Menu"><i></i><i></i></button></div>
          <div class="canvas-content">
            {#each page.blocks as block, index (block.id)}
              <div class:selected={selectedBlockId === block.id} class:hidden-device={block.style.hiddenOn?.includes(device)} class="editable-block" role="button" tabindex="0" draggable={!preview} ondragstart={() => draggedIndex = index} ondragover={(event) => event.preventDefault()} ondrop={() => dropBlock(index)} onclick={() => { if (!preview) selectedBlockId = block.id; }} onkeydown={(event) => { if (event.key === 'Enter' && !preview) selectedBlockId = block.id; }}>
                {#if !preview}<div class="block-tools"><button onclick={(event) => { event.stopPropagation(); moveBlock(index, -1); }} disabled={index === 0} aria-label="Naik"><Icon name="up" size={16} /></button><button onclick={(event) => { event.stopPropagation(); moveBlock(index, 1); }} disabled={index === page.blocks.length - 1} aria-label="Turun"><Icon name="down" size={16} /></button><button onclick={(event) => { event.stopPropagation(); duplicateBlock(block.id); }} aria-label="Duplikasi"><Icon name="pages" size={15} /></button><span>{block.type}</span></div>{/if}
                <BlockPreview {block} {project} projectId={project.id} pageId={page.id} publicMode={preview} formAction={preview ? (project.site?.formAction || '/api/public/forms') : null} />
                {#if !preview}<button class="between-add" onclick={(event) => { event.stopPropagation(); insertAt = index + 1; activePanel = 'blocks'; }} aria-label="Sisipkan blok setelah ini"><Icon name="plus" size={14} /></button>{/if}
              </div>
            {/each}
            {#if !preview}<button class="inline-add" onclick={() => { insertAt = null; activePanel = 'blocks'; }}><Icon name="plus" /> Tambah blok</button>{/if}
          </div>
          <footer class="site-footer"><strong>{project.name}</strong><span>{project.site?.footerText}</span></footer>
        </article>
      </main>
    </div>

    {#if !preview}<nav class="mobile-nav"><button class:active={activePanel === 'blocks'} onclick={openBlocks}><Icon name="plus" /><span>Tambah</span></button><button class:active={activePanel === 'pages'} onclick={openPages}><Icon name="pages" /><span>Halaman</span></button><button class:active={activePanel === 'media'} onclick={openMedia}><Icon name="eye" /><span>Media</span></button><button class:active={preview} onclick={() => preview = !preview}><Icon name="eye" /><span>{preview ? 'Edit' : 'Preview'}</span></button><button class:active={activePanel === 'more'} onclick={openMore}><Icon name="more" /><span>Lainnya</span></button></nav>{/if}
  </div>

  {#if selectedBlock}<EditorSheet block={selectedBlock} onclose={() => selectedBlockId = null} onupdate={updateBlock} onremove={removeBlock} onsaveReusable={saveReusable} />{/if}
  {#if toast}<div class="toast"><Icon name="check" size={18} />{toast}</div>{/if}
{/if}
