/**
 * HTTP route handlers for Memory operations.
 *
 * Standalone server has no display, so we expose only the read paths +
 * copy-path (path is returned so the renderer can clipboard it). The Electron
 * preload uses its own IPC channels for the full opener menu.
 */

import { createLogger } from '@shared/utils/logger';

import { validateProjectId } from '../ipc/guards';

import type { HttpServices } from './index';
import type { FastifyInstance } from 'fastify';

const logger = createLogger('HTTP:memory');

export function registerMemoryRoutes(app: FastifyInstance, services: HttpServices): void {
  app.get<{ Querystring: { projectId?: string } }>('/api/memory/has', async (request) => {
    const validated = validateProjectId(request.query.projectId);
    if (!validated.valid || !validated.value) return false;
    try {
      return await services.memoryReader.hasMemory(validated.value);
    } catch (error) {
      logger.error('Error in GET /api/memory/has:', error);
      return false;
    }
  });

  app.get<{ Querystring: { projectId?: string } }>('/api/memory/index', async (request) => {
    const validated = validateProjectId(request.query.projectId);
    if (!validated.valid || !validated.value) return null;
    try {
      return await services.memoryReader.readIndex(validated.value);
    } catch (error) {
      logger.error('Error in GET /api/memory/index:', error);
      return null;
    }
  });

  app.get<{ Querystring: { projectId?: string; file?: string } }>(
    '/api/memory/file',
    async (request) => {
      const validated = validateProjectId(request.query.projectId);
      if (!validated.valid || !validated.value) {
        return { success: false, error: validated.error ?? 'Invalid projectId' };
      }
      const fileName = request.query.file;
      if (typeof fileName !== 'string' || !fileName.trim()) {
        return { success: false, error: 'file query parameter is required' };
      }
      try {
        const file = await services.memoryReader.readFile(validated.value, fileName);
        return { success: true, content: file.content, path: file.absolutePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    }
  );

  app.post<{ Body: { projectId?: string; fileName?: string | null } }>(
    '/api/memory/copy-path',
    async (request) => {
      const validated = validateProjectId(request.body.projectId);
      if (!validated.valid || !validated.value) {
        return { success: false, error: validated.error ?? 'Invalid projectId' };
      }
      try {
        const reader = services.memoryReader;
        const fileName = request.body.fileName;
        const absolutePath =
          typeof fileName === 'string' && fileName.trim().length > 0
            ? reader.getFilePath(validated.value, fileName)
            : reader.getDirPath(validated.value);
        // Renderer copies to its own clipboard; the server just returns the path.
        return { success: true, path: absolutePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    }
  );
}
