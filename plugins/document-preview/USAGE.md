# Document Preview

Requires NoteGen desktop with plugin API 0.1.2. Install the complete plugin package, enable it, and choose “entire workspace” in the permission dialog. You can then open any PDF, DOCX, XLSX or PPTX from the workspace tree without granting files one by one. No npm commands or LibreOffice installation are needed by end users.

Documents are processed locally in an isolated preview. Files are never uploaded or modified.

## PDF

Use the left/right arrows or enter a page number. Click −/+ to zoom out or in (25%–300%), or choose a percentage or Fit width from the zoom menu. Drag to select page text. The filename appears in NoteGen's tab and is not repeated inside the preview.

Enter a query and click the magnifying glass or press Enter. Match counts and up/down arrows appear after searching. Enter advances to the next match; Shift+Enter goes to the previous match. Click × or press Escape to clear the search. Stop appears only while searching and retains partial results. Hover over icons for their labels. Search ignores English case but does not match across pages. Columns, ligatures and hyphenation depend on the PDF's internal text order. Image-only scans have no searchable/selectable OCR text. Protected PDFs prompt for a password for local decryption.

Input limit: 128 MiB. Search is limited to 2000 pages, 5000 matches or 16 million extracted characters; incomplete results are labelled. PDF scripts, XFA and interactive forms are unsupported; very large images are restricted.

## Word (DOCX)

Scroll through body text, images, tables, headers/footers and footnotes/endnotes. Use −/+ to zoom.

This is HTML document layout; fonts, floating objects and pagination can differ from Word. Tracked changes, comments and embedded HTML are not displayed. Macros and document links do not run. Use the original Office application, or export a PDF from it, when exact layout matters.

## Excel (XLSX)

Select a worksheet; hidden sheets are labelled. Browse up to 100 rows using the paging buttons or starting row field. Scroll horizontally through columns, with letter labels above and row numbers pinned on the left. Row paging preserves the horizontal position. Long values are ellipsized; hover to inspect the full displayed value or formula. Row and column counts appear in NoteGen's bottom status bar, with an in-preview fallback for older NoteGen versions that do not support this interface.

This is a **data browser**, not print-layout reproduction. Merged cells, charts, images and conditional formatting are not reproduced. Formulas use saved cached results without recalculation. Missing cached results are labelled; hover to inspect a formula. Macros and external data connections do not run.

Browsing covers the first 100000 rows and 256 columns, with truncation notices. Displayed cell text is limited to 32768 characters. Drag to select and copy cell text.

## PowerPoint (PPTX)

Use the previous/next buttons, page input, or arrow keys, PageUp/PageDown and Home/End while the preview is focused. Zoom with −/+, choose 10%–300%, or fit the window. Page counts appear in NoteGen's bottom status bar, with an in-preview fallback for older hosts. The existing tab supplies the filename; the preview shows its toolbar and current slide only.

Displays static text, images, shapes and tables. Complex SmartArt, charts, vector art and fonts may differ from PowerPoint. Animations, transitions, audio/video playback, document links and EMF embedded-PDF fallback are disabled. Supports at most 300 slides with on-demand media decoding.

## Unsupported formats and errors

Legacy DOC/XLS/PPT and macro-enabled DOCM/XLSM/PPTM are not registered. Extracted text or Markdown is never substituted for slides.

DOCX/XLSX/PPTX input limit: 32 MiB, with additional limits on ZIP expansion, XML parts, sheet and slide counts. Encrypted Office files, ZIP64, damaged packages and excessive compression are rejected. Workbook Worker operations stop after 30 seconds. If an error appears, close the preview, check file permission and reopen it. Large/complex DOCX or PPTX layout can stall the renderer; close the preview to release it and use desktop Office when needed.

Closing the file, disabling the plugin or changing workspaces releases the preview. UI language follows NoteGen through the host's locale field; unsupported languages and older hosts that omit it fall back to English. Changing NoteGen's language reloads the preview. Colors still follow the system preference.
