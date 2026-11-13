# .ai

Workflow notes for coding agents: how an agent moves from an issue to a pull request. Rules about
the code live in [`AGENTS.md`](../AGENTS.md) and the nested `AGENTS.md` files; explanations live
in [`docs/en`](../docs/en).

| File | Purpose |
| --- | --- |
| [`workflow.md`](workflow.md) | The issue-to-PR loop |

## No duplication

- Never copy or paraphrase text from `docs/` or `AGENTS.md` into this folder. Link to the page.
- If a step needs more detail than a link gives, improve the linked page instead.
- Only `README.md` and `workflow.md` may live here; `scripts/check-markdown-links.py` fails on any
  other tracked file under `.ai/`.
- Keep the files tool-neutral. No per-tool copies (`.cursorrules`, `GEMINI.md` and similar).
