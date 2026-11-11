/** Общие материалы учебной постановки «Чайка» (демо) — Google Docs и .docx на сервере. */

export const DEMO_CHAIKA_GOOGLE_DOC_URL =
  'https://docs.google.com/document/d/1M-GC9d0_G4NzQMs4H9cvUVG7rhALHyIg57_XcqHyUzc/edit';

/** Стабильный id файла в `data/uploads` (сидится с `data/demo-assets/chaika-inscenirovka.docx`). */
export const DEMO_CHAIKA_SCRIPT_FILE_ID = 'c0ffee00-0001-4000-8000-0000democha1';

export const DEMO_CHAIKA_SCRIPT_FILE_NAME = 'Чайка, инсценировка, 4я ступень ШАИ онлайн.docx';

export const DEMO_CHAIKA_SCRIPT_FILE_URL = `/api/files/${DEMO_CHAIKA_SCRIPT_FILE_ID}`;

export const DEMO_CHAIKA_SCRIPT_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const DEMO_CHAIKA_PLAY_MATERIAL = {
  documentUrl: DEMO_CHAIKA_GOOGLE_DOC_URL,
  scriptFileName: DEMO_CHAIKA_SCRIPT_FILE_NAME,
  scriptFileUrl: DEMO_CHAIKA_SCRIPT_FILE_URL,
  scriptFileMimeType: DEMO_CHAIKA_SCRIPT_MIME,
} as const;
