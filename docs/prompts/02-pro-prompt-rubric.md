# Pro prompt rubric

Use this only as guidance. The agent should write the final prompt itself.

A good `$ask-pro` prompt gives ChatGPT Pro, once:

- the exact goal or question
- relevant context and attached evidence
- hard constraints and success criteria
- required evidence and output format
- known uncertainty or missing context

Ask only for outputs that the decision needs. For example, request
severity-ranked findings for a risk review, or a recommendation and tradeoffs
for an architecture consult. The CLI wrapper already tells Pro to read
`CONTEXT.zip` and `MANIFEST.md`, so do not repeat that instruction.

## Suggested snippet

```text
You are reviewing a hard backend/architecture decision for a coding agent.

Return final Markdown only, with no preamble or implementation package.

Task:
<what we are trying to build/fix>

Question:
<the exact decision needed>

Relevant context and evidence:
<facts and attached files that matter to the decision>

Constraints and success criteria:
<hard constraints and what a successful answer must establish>

What I inspected:
<files and findings>

Options considered:
<option A, option B, option C>

Please return:
1. recommendation
2. supporting evidence and tradeoffs
3. concrete next steps
4. uncertainty or missing context
```

For risk reviews, also request severity-ranked findings, failure modes, and a
test plan. For implementation planning, request the sequence and files to edit.

Use `--artifacts` only when the standard implementation package is needed. The
wrapper supplies the zip name, standard files, and markdown fallback; add only
task-specific deliverables not covered by that package.

Never send a vague prompt like “what do you think?” without context.
