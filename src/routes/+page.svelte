<script lang="ts">
  import { onMount } from 'svelte';
  import { blockCatalog, createBlock } from '$lib/builder/catalog';
  import { BuilderCmsGateway, BuilderGatewayError } from '$lib/builder/cms-gateway';
  import { analyzeDesign } from '$lib/builder/design-assistant';
  import { instantiateModule, moduleCatalog } from '$lib/builder/modules';
  import { optimizeImageForUpload } from '$lib/builder/image-optimizer';
  import { loadProject, normalizeProject, saveProject } from '$lib/builder/persistence';
  import { SparkApiPublishAdapter } from '$lib/builder/publish-adapter';
  import { duplicatePage, starterProject } from '$lib/builder/project';
  import { templates } from '$lib/builder/templates';
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
  let mediaAssets = $state<Array<{ id: string; fileName: string; contentType: string; size: number; createdAt: string; url: string }>>([]);
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

  async function uploadMedia(file: File, silent = false) {
    uploading = true;
    try { await gateway.upload(file); mediaAssets = await gateway.media(); if (!silent) showToast('Media berhasil diunggah'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Upload gagal.'); }
    finally { uploading = false; }
  }

  async function uploadMediaWithOptimization(file: File) {
    const optimized = await optimizeImageForUpload(file);
    await uploadMedia(optimized.file, optimized.optimized);
    if (optimized.optimized) {
      showToast(`Gambar dioptimalkan otomatis (${Math.ceil(optimized.originalSize / 1024)} KB → ${Math.ceil(optimized.optimizedSize / 1024)} KB)`);
    }
  }

  function insertMedia(asset: { url: string; fileName: string; contentType: string }) {
    if (!page) return;
    const type = asset.contentType.startsWith('video/') ? 'video' : asset.contentType === 'application/json' ? 'lottie' : 'image';
    const block = createBlock(type);
    block.data = type === 'image'
      ? { ...block.data, src: asset.url, alt: asset.fileName, caption: '' }
      : type === 'video'
        ? { ...block.data, src: asset.url, title: asset.fileName, caption: '' }
        : { ...block.data, src: asset.url, title: asset.fileName };
    updateBlocks([...page.blocks, block]);
    selectedBlockId = block.id;
    activePanel = null;
  }

  function saveReusable(block: BuilderBlock) {
    if (!project) return;
    const name = block.data.title || block.data.quote || `${block.type} section`;
    snapshot();
    commit({ ...project, reusableSections: [...(project.reusableSections ?? []), { id: crypto.randomUUID(), name: name.slice(0, 80), blocks: [{ ...structuredClone(block), id: crypto.randomUUID() }] }] });
    selectedBlockId = null;
    showToast('Disimpan sebagai reusable section');
  }

  function insertReusable(sectionId: string) {
    if (!project || !page) return;
    const section = project.reusableSections?.find((item) => item.id === sectionId);
    if (!section) return;
    updateBlocks([...page.blocks, ...section.blocks.map((block) => ({ ...structuredClone(block), id: crypto.randomUUID() }))]);
    activePanel = null;
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

  function updateSite(key: 'headerTitle' | 'footerText', value: string) {
    if (!project) return;
    snapshot();
    commit({ ...project, site: { ...(project.site ?? { headerTitle: project.name, footerText: '', navigation: [] }), [key]: value } });
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
  <div class:preview-mode={preview} class="builder-app" style={`--theme-primary:${project.theme?.primary};--theme-accent:${project.theme?.accent};--theme-surface:${project.theme?.surface};--theme-text:${project.theme?.text};--button-radius:${project.theme?.buttonRadius === 'square' ? '4px' : project.theme?.buttonRadius === 'soft' ? '14px' : '999px'}`} data-font={project.theme?.font}>
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
            <p>Template mengganti isi halaman aktif. Reusable section ditambahkan ke halaman.</p><div class="template-list">{#each templates as template}<button onclick={() => applyTemplate(template.id)} style={`--template-color:${template.color}`}><i></i><strong>{template.name}</strong><small>{template.description}</small><span>Gunakan template</span></button>{/each}</div>{#if project.reusableSections?.length}<h3 class="panel-subtitle">Reusable sections</h3><div class="block-library">{#each project.reusableSections as section}<button onclick={() => insertReusable(section.id)}><span>R</span><div><strong>{section.name}</strong><small>{section.blocks.length} blok</small></div><Icon name="plus" size={17} /></button>{/each}</div>{/if}
          {:else if activePanel === 'pages'}
            <div class="page-list">{#each project.pages as item}<button class:active={item.id === page.id} onclick={() => { activePageId = item.id; activePanel = null; }}><span>{item.title.slice(0, 1)}</span><div><strong>{item.title}</strong><small>/{item.slug}</small></div></button>{/each}</div><div class="page-actions"><button onclick={addPage}><Icon name="plus" /> Baru</button><button onclick={copyActivePage}><Icon name="pages" /> Duplikasi</button><button class="danger-action" onclick={deleteActivePage} disabled={project.pages.length === 1}><Icon name="trash" /> Hapus</button></div>
          {:else if activePanel === 'layers'}
            <p>Kelola urutan dan pilih bagian halaman dengan cepat.</p><div class="layer-list">{#each page.blocks as block, index}<button class:selected={selectedBlockId === block.id} onclick={() => { selectedBlockId = block.id; activePanel = null; }}><span>{index + 1}</span><strong>{block.type}</strong><small>{block.data.title ?? block.data.quote ?? block.data.caption ?? 'Elemen halaman'}</small><i>{block.style.hiddenOn?.length ? `${block.style.hiddenOn.length} hidden` : ''}</i></button>{/each}</div>
          {:else if activePanel === 'media'}
            <MediaLibrary assets={mediaAssets} {uploading} onupload={uploadMediaWithOptimization} onselect={insertMedia} />
          {:else if activePanel === 'theme' && project.theme}
            <p>Token global menjaga warna dan tipografi tetap konsisten.</p><div class="settings-form"><div class="theme-colors"><label>Utama<input type="color" value={project.theme.primary} onchange={(event) => updateTheme('primary', event.currentTarget.value)} /></label><label>Aksen<input type="color" value={project.theme.accent} onchange={(event) => updateTheme('accent', event.currentTarget.value)} /></label><label>Permukaan<input type="color" value={project.theme.surface} onchange={(event) => updateTheme('surface', event.currentTarget.value)} /></label><label>Teks<input type="color" value={project.theme.text} onchange={(event) => updateTheme('text', event.currentTarget.value)} /></label></div><label>Gaya font<select value={project.theme.font} onchange={(event) => updateTheme('font', event.currentTarget.value)}><option value="modern">Modern</option><option value="friendly">Friendly</option><option value="editorial">Editorial</option></select></label><label>Sudut tombol<select value={project.theme.buttonRadius} onchange={(event) => updateTheme('buttonRadius', event.currentTarget.value)}><option value="pill">Pill</option><option value="soft">Soft</option><option value="square">Square</option></select></label></div>
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
              <label>Judul SEO<input value={page.seo.title} maxlength="60" onchange={(event) => updateSeo('title', event.currentTarget.value)} /><small>{page.seo.title.length}/60 karakter</small></label>
              <label>Deskripsi SEO<textarea rows="3" maxlength="160" value={page.seo.description} onchange={(event) => updateSeo('description', event.currentTarget.value)}></textarea><small>{page.seo.description.length}/160 karakter</small></label>
              <label>Social image HTTPS<input value={page.seo.image} onchange={(event) => updateSeo('image', event.currentTarget.value)} /></label>
              <label class="check-row"><input type="checkbox" checked={page.seo.noIndex} onchange={(event) => updateSeo('noIndex', event.currentTarget.checked)} />Sembunyikan dari mesin pencari</label>

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
                <BlockPreview {block} />
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
