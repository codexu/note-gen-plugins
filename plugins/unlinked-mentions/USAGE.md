# Using Related Notes

1. Open a saved Markdown note in NoteGen Desktop and select a single-line term or phrase of 2–80 characters.
2. Choose **Find related notes** in the selection bubble menu. Grant editor and workspace note access when prompted. Results open in a compact popover beside the selected text.
3. Text matches appear first. A loading state under **Related** then gives way to related notes. Excerpts show up to three lines and highlight the selection when present. Click a file name or excerpt to open the note, or **Create link** to link the current selection to it. The candidate note is not edited.
4. If the selection or current note changes, select the text and search again.

Text search covers saved candidate files and is subject to host scan and result limits. Related search uses indexed Markdown and may call NoteGen's configured embedding and reranking providers. The popover indicates when text search was truncated.

Under Settings → Plugins → Installed → this plugin → Settings, you can change the text match count (default 10), enable or disable related search (on by default), set the minimum relevance score (default 0.35), and set the related result count (default 5). A higher score removes weak matches but may miss useful notes. It filters results in this plugin; NoteGen's global RAG settings remain separate. Changes apply to the next search.

You can hide the bubble-menu entry or its results panel under Settings → Plugins → Installed → this plugin → Interface visibility. This feature needs both surfaces to be visible.
