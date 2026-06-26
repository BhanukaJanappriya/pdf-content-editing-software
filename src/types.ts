export interface PDFSpan {
  id: string;
  text: string;
  bbox: number[]; // [x0, y0, x1, y1]
  origin: number[]; // [x, y]
  font: string;
  size: number;
  color: string;
  flags: number;
  bold: boolean;
  italic: boolean;
}

export interface PDFLine {
  id: string;
  bbox: number[];
  spans: PDFSpan[];
}

export interface PDFBlock {
  id: string;
  type: 'text' | 'image';
  bbox: number[];
  lines?: PDFLine[];
  image_index?: number;
  ext?: string;
}

export interface PDFImageInfo {
  id: string;
  xref: number;
  bbox: number[];
  width: number;
  height: number;
  ext: string;
}

export interface PDFPageLayout {
  page_num: number;
  width: number;
  height: number;
  rotation: number;
  blocks: PDFBlock[];
  images: PDFImageInfo[];
}

export interface PDFMetadata {
  producer?: string;
  creator?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creationDate?: string;
  modDate?: string;
}

export interface PDFDocumentInfo {
  doc_id: string;
  file_path: string;
  page_count: number;
  metadata: PDFMetadata;
  is_encrypted?: boolean;
}

export type EditTool = 
  | 'select' 
  | 'edit_text' 
  | 'add_text' 
  | 'erase_text' 
  | 'image_edit' 
  | 'annotate_highlight' 
  | 'annotate_underline' 
  | 'annotate_strikeout'
  | 'page_manage';

export interface UndoRedoState {
  // Simple history tracking for layout changes
  past: Array<Record<number, PDFPageLayout>>;
  present: Record<number, PDFPageLayout>; // page_num -> page_layout
  future: Array<Record<number, PDFPageLayout>>;
}
