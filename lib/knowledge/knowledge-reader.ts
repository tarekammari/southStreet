/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SAKHR AI — MEMBERS KNOWLEDGE BASE READER                  │
 * │  Reads & parses markdown files from knowledge/ folder      │
 * │  Keyword search · File cache · Hot reload                  │
 * └─────────────────────────────────────────────────────────────┘
 */

import fs from 'fs';
import path from 'path';
import {
  KnowledgeFile, KnowledgeChunk, KnowledgeSearchResult,
  KnowledgeListEntry, KnowledgeCategory, KnowledgeSaveRequest
} from './knowledge-types';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

/** Category mapping: folder name → category type */
const CATEGORY_MAP: Record<string, KnowledgeCategory> = {
  packages: 'packages',
  prices: 'prices',
  flights: 'flights',
  offers: 'offers',
  hajj: 'hajj',
  umrah: 'umrah',
  faq: 'faq'
};

/** In-memory cache: filePath → { file, cachedAt } */
const fileCache = new Map<string, { file: KnowledgeFile; cachedAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

/**
 * Members Knowledge Base Reader — the backbone of Sakhr's member-submitted data pipeline.
 */
export class KnowledgeReader {

  /**
   * Ensure the knowledge directory and default structure exists
   */
  static ensureDirectoryExists(): void {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
    // Create subdirectory if not exists
    const categories = Object.keys(CATEGORY_MAP);
    for (const cat of categories) {
      const catDir = path.join(KNOWLEDGE_DIR, cat);
      if (!fs.existsSync(catDir)) {
        fs.mkdirSync(catDir, { recursive: true });
      }
    }
  }

  /**
   * Determine the category from a file path
   */
  static getCategory(relativePath: string): KnowledgeCategory {
    const parts = relativePath.split(/[/\\]/);
    const folder = parts[0]?.toLowerCase();
    return CATEGORY_MAP[folder] || 'general';
  }

  /**
   * Extract keywords from markdown content (headings + bold text)
   */
  static extractKeywords(content: string): string[] {
    const keywords: string[] = [];
    // Extract from headings (# ## ###)
    const headings = content.match(/^#{1,3}\s+(.+)$/gm) || [];
    for (const h of headings) {
      keywords.push(...h.replace(/^#+\s+/, '').split(/[\s,،]+/).filter(k => k.length > 2));
    }
    // Extract from bold **text**
    const bold = content.match(/\*\*([^*]+)\*\*/g) || [];
    for (const b of bold) {
      keywords.push(...b.replace(/\*\*/g, '').split(/[\s,،]+/).filter(k => k.length > 2));
    }
    // Deduplicate and lowercase
    return [...new Set(keywords.map(k => k.toLowerCase().trim()))].slice(0, 50);
  }

  /**
   * Split markdown content into chunks by heading (H2 level)
   */
  static splitIntoChunks(content: string, category: KnowledgeCategory, source: string): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    const sections = content.split(/^##\s+/m);

    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.split('\n');
      const heading = lines[0]?.trim() || 'محتوى عام';
      const body = lines.slice(1).join('\n').trim();
      if (body.length > 20) {
        chunks.push({
          source,
          category,
          heading,
          content: body,
          score: 0
        });
      }
    }

    // If no H2 sections found, treat entire file as one chunk
    if (chunks.length === 0 && content.trim().length > 20) {
      const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'معلومات عامة';
      chunks.push({
        source,
        category,
        heading: firstLine,
        content: content.trim(),
        score: 0
      });
    }

    return chunks;
  }

  /**
   * Read and parse a single knowledge file
   */
  static readFile(relativePath: string): KnowledgeFile | null {
    const absolutePath = path.join(KNOWLEDGE_DIR, relativePath);

    if (!fs.existsSync(absolutePath)) return null;

    // Check cache
    const cached = fileCache.get(relativePath);
    const stat = fs.statSync(absolutePath);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.file;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const category = this.getCategory(relativePath);
      const keywords = this.extractKeywords(content);
      const firstHeading = (content.match(/^#\s+(.+)$/m) || [])[1]?.trim() || path.basename(relativePath, '.md');

      const file: KnowledgeFile = {
        relativePath,
        category,
        title: firstHeading,
        content,
        lastModified: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        keywords
      };

      fileCache.set(relativePath, { file, cachedAt: Date.now() });
      return file;
    } catch (e) {
      console.error('[KnowledgeReader] Failed to read:', relativePath, e);
      return null;
    }
  }

  /**
   * List all knowledge files across all categories
   */
  static listAll(): KnowledgeListEntry[] {
    this.ensureDirectoryExists();
    const entries: KnowledgeListEntry[] = [];

    const walkDir = (dir: string, base: string) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(base, item).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath, relativePath);
        } else if (item.endsWith('.md') && !item.startsWith('README') && !item.startsWith('template')) {
          const category = this.getCategory(relativePath);
          const content = fs.readFileSync(fullPath, 'utf8');
          const firstHeading = (content.match(/^#\s+(.+)$/m) || [])[1]?.trim() || item.replace('.md', '');
          entries.push({
            relativePath,
            category,
            title: firstHeading,
            lastModified: stat.mtime.toISOString(),
            sizeBytes: stat.size
          });
        }
      }
    };

    walkDir(KNOWLEDGE_DIR, '');
    return entries;
  }

  /**
   * Compute relevance score of a chunk for a query
   */
  private static computeScore(chunk: KnowledgeChunk, queryWords: string[]): number {
    const text = `${chunk.heading} ${chunk.content}`.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (word.length < 2) continue;
      if (text.includes(word)) {
        // Heading matches score higher
        score += chunk.heading.toLowerCase().includes(word) ? 3 : 1;
      }
    }
    return score;
  }

  /**
   * Search across all knowledge files for the most relevant chunks
   */
  static async search(query: string, topK: number = 5): Promise<KnowledgeSearchResult> {
    const startTs = Date.now();
    this.ensureDirectoryExists();

    const entries = this.listAll();
    const allChunks: KnowledgeChunk[] = [];

    // Split query into meaningful words (Arabic/French/English)
    const queryWords = query
      .toLowerCase()
      .split(/[\s,،.؟?!]+/)
      .filter(w => w.length > 1);

    for (const entry of entries) {
      const file = this.readFile(entry.relativePath);
      if (!file) continue;

      const chunks = this.splitIntoChunks(file.content, file.category, entry.relativePath);
      for (const chunk of chunks) {
        chunk.score = this.computeScore(chunk, queryWords);
        if (chunk.score > 0) {
          allChunks.push(chunk);
        }
      }
    }

    // Sort by score descending and take top K
    const sorted = allChunks.sort((a, b) => b.score - a.score).slice(0, topK);

    // Normalize scores to 0–1
    const maxScore = sorted[0]?.score || 1;
    for (const chunk of sorted) {
      chunk.score = Math.round((chunk.score / maxScore) * 100) / 100;
    }

    return {
      query,
      chunks: sorted,
      totalFiles: entries.length,
      searchTimeMs: Date.now() - startTs
    };
  }

  /**
   * Save or update a knowledge file (called from admin API)
   */
  static saveFile(request: KnowledgeSaveRequest): { success: boolean; message: string } {
    try {
      this.ensureDirectoryExists();

      // Security: prevent path traversal
      const safePath = request.relativePath
        .replace(/\.\./g, '')
        .replace(/[^a-zA-Z0-9/_\-.\u0600-\u06FF]/g, '');

      if (!safePath.endsWith('.md')) {
        return { success: false, message: 'يجب أن يكون الملف بصيغة .md' };
      }

      const absolutePath = path.join(KNOWLEDGE_DIR, safePath);
      const dir = path.dirname(absolutePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Add metadata header if not present
      let content = request.content;
      if (!content.includes('<!-- meta:')) {
        const meta = `<!-- meta: lastUpdated=${new Date().toISOString()} author=${request.authorEmail || 'admin'} -->`;
        content = `${meta}\n\n${content}`;
      } else {
        // Update existing meta
        content = content.replace(
          /<!-- meta:.*?-->/,
          `<!-- meta: lastUpdated=${new Date().toISOString()} author=${request.authorEmail || 'admin'} -->`
        );
      }

      fs.writeFileSync(absolutePath, content, 'utf8');

      // Invalidate cache
      fileCache.delete(safePath);

      return { success: true, message: `تم حفظ الملف: ${safePath}` };
    } catch (e: any) {
      return { success: false, message: `خطأ في الحفظ: ${e.message}` };
    }
  }

  /**
   * Delete a knowledge file
   */
  static deleteFile(relativePath: string): { success: boolean; message: string } {
    try {
      const safePath = relativePath.replace(/\.\./g, '');
      const absolutePath = path.join(KNOWLEDGE_DIR, safePath);
      if (!fs.existsSync(absolutePath)) {
        return { success: false, message: 'الملف غير موجود' };
      }
      fs.unlinkSync(absolutePath);
      fileCache.delete(safePath);
      return { success: true, message: `تم حذف الملف: ${safePath}` };
    } catch (e: any) {
      return { success: false, message: `خطأ في الحذف: ${e.message}` };
    }
  }
}
