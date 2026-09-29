# Related Notes

[简体中文](README.md)

Select a term or phrase in a Markdown note and choose **Find related notes** from the editor bubble menu. A compact popover beside the selection shows text matches first, then a loading state and results under **Related**. Each excerpt shows up to three lines and highlights the selected text when present. Click the file name or excerpt to open the note, or **Create link** beside the file name to link the current selection to that note.

Version 0.1.0 is a desktop plugin requiring NoteGen 0.38.0 and plugin protocol 0.1.9 or newer. See the [usage guide](USAGE.md).

Text search covers saved Markdown files within the granted workspace scope and is capped at 200 files, 16 MiB of scanned content and 100 matches. Related search uses only authorized indexed Markdown notes; NoteGen may call its configured embedding and reranking providers, falling back to local keyword search when unavailable. Plugin settings control the text match count (1–15), whether related search runs, the minimum relevance score (0–1), and the related result count (1–10). The minimum score only filters the host's returned scores; it does not change global RAG retrieval or indexing. The popover warns when text search is incomplete.

Candidate notes are never modified. Candidates already linked from the current note are excluded. Before creating a link, the plugin checks the active selection and editor revision to avoid writing into changed content.

## Permissions

| Permission | Purpose |
| --- | --- |
| `editor.read` | Read the selection and current note path |
| `editor.write` | Change the current selection after the user chooses **Create link** |
| `notes.list`, `notes.read` | Search and read candidate excerpts |
| `notes.open` | Open a candidate when requested |

Its popover uses the protocol 0.1.9 `editor/selection-panel` view location.
