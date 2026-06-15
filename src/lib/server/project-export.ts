import type { BuilderExportTarget, BuilderProject } from '$lib/builder/types';
import { createNextJsZip } from './nextjs-export';
import { createStaticZip } from './static-export';

export function createProjectExport(project: BuilderProject, target: BuilderExportTarget = 'static-html'): { filename: string; contentType: string; body: Uint8Array } {
  if (target === 'nextjs') {
    return {
      filename: `${project.id}-nextjs.zip`,
      contentType: 'application/zip',
      body: createNextJsZip(project)
    };
  }
  return {
    filename: `${project.id}.zip`,
    contentType: 'application/zip',
    body: createStaticZip(project)
  };
}

export function isBuilderExportTarget(value: unknown): value is BuilderExportTarget {
  return value === 'static-html' || value === 'nextjs';
}
