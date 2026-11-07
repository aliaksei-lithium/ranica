-- Which editor produced the brief: a Claude model id, or 'fallback' for the no-LLM editor.
ALTER TABLE edition ADD COLUMN model TEXT;
