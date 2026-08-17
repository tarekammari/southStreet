/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SAKHR AI — MEMBERS KNOWLEDGE BASE TYPES                   │
 * └─────────────────────────────────────────────────────────────┘
 */

export type KnowledgeCategory =
  | 'packages'
  | 'prices'
  | 'flights'
  | 'offers'
  | 'hajj'
  | 'umrah'
  | 'faq'
  | 'general';

export interface KnowledgeFile {
  /** Relative path under knowledge/ folder, e.g. "packages/packages_data.md" */
  relativePath: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  lastModified: string;
  sizeBytes: number;
  /** Parsed keywords extracted from headings and bold text */
  keywords: string[];
}

export interface KnowledgeChunk {
  /** Source file path */
  source: string;
  category: KnowledgeCategory;
  /** Heading under which this chunk appears */
  heading: string;
  /** Raw markdown content of this chunk */
  content: string;
  /** Relevance score (0–1) computed during search */
  score: number;
}

export interface KnowledgeSearchResult {
  query: string;
  chunks: KnowledgeChunk[];
  totalFiles: number;
  searchTimeMs: number;
}

export interface KnowledgeSaveRequest {
  relativePath: string;
  content: string;
  authorEmail?: string;
}

export interface KnowledgeListEntry {
  relativePath: string;
  category: KnowledgeCategory;
  title: string;
  lastModified: string;
  sizeBytes: number;
}
