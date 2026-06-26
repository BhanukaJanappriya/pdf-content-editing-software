const API_BASE_URL = 'http://127.0.0.1:8000';

export interface PageActionParams {
  page_num?: number;
  angle?: number;
  new_order?: number[];
  width?: number;
  height?: number;
}

export const api = {
  loadDocument: async (filePath: string) => {
    const res = await fetch(`${API_BASE_URL}/document/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/document/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  closeDocument: async (docId: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/close`, {
      method: 'POST',
    });
    return res.json();
  },

  getPageImage: async (docId: string, pageNum: number, dpi: number = 150) => {
    const res = await fetch(
      `${API_BASE_URL}/document/${encodeURIComponent(docId)}/page/${pageNum}/image?dpi=${dpi}`
    );
    if (!res.ok) throw new Error('Failed to render page image');
    return res.json(); // { image: "data:image/png;base64,..." }
  },

  getPageLayout: async (docId: string, pageNum: number) => {
    const res = await fetch(
      `${API_BASE_URL}/document/${encodeURIComponent(docId)}/page/${pageNum}/layout`
    );
    if (!res.ok) throw new Error('Failed to retrieve page layout');
    return res.json();
  },

  getFontsCSS: async (docId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/document/${encodeURIComponent(docId)}/fonts/css?server_url=${encodeURIComponent(API_BASE_URL)}`
    );
    if (!res.ok) throw new Error('Failed to fetch font styles');
    return res.json(); // { css: "...", fonts: [...] }
  },

  editSpan: async (docId: string, pageNum: number, spanId: string, newText: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/edit/span`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_num: pageNum, span_id: spanId, new_text: newText }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  editBlock: async (
    docId: string,
    pageNum: number,
    blockId: string,
    newText: string,
    fontName?: string,
    fontSize?: number,
    colorHex?: string,
    align: number = 0
  ) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/edit/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_num: pageNum,
        block_id: blockId,
        new_text: newText,
        font_name: fontName,
        font_size: fontSize,
        color_hex: colorHex,
        align: align,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  addNewText: async (
    docId: string,
    pageNum: number,
    x: number,
    y: number,
    text: string,
    fontName: string = 'Helvetica',
    fontSize: number = 10,
    colorHex: string = '#000000'
  ) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/edit/add_text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_num: pageNum,
        x,
        y,
        text,
        font_name: fontName,
        font_size: fontSize,
        color_hex: colorHex,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteText: async (docId: string, pageNum: number, bbox: number[]) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/edit/delete_text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_num: pageNum, bbox }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteImage: async (docId: string, pageNum: number, bbox: number[]) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/image/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_num: pageNum, bbox }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  moveImage: async (
    docId: string,
    pageNum: number,
    oldBbox: number[],
    newBbox: number[],
    xref: number
  ) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/image/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_num: pageNum,
        old_bbox: oldBbox,
        new_bbox: newBbox,
        xref,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  replaceImage: async (docId: string, pageNum: number, bbox: number[], file: File) => {
    const formData = new FormData();
    formData.append('page_num', pageNum.toString());
    formData.append('bbox_json', bbox.join(','));
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/image/replace`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  managePages: async (docId: string, action: 'insert' | 'delete' | 'rotate' | 'duplicate' | 'reorder', params: PageActionParams) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/pages/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  checkOCR: async (docId: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/ocr/check`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to check OCR status');
    return res.json(); // { available: boolean }
  },

  ocrPage: async (docId: string, pageNum: number, lang: string = 'eng') => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/ocr/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_num: pageNum, lang }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  ocrDoc: async (docId: string, lang: string = 'eng') => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/ocr/doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  undo: async (docId: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/undo`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  redo: async (docId: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/redo`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  saveDocument: async (docId: string, outputPath: string) => {
    const res = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(docId)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_path: outputPath }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
