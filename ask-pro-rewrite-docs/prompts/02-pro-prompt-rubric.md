# Pro prompt rubric

Use this only as guidance. The agent should write the final prompt itself.

A good `$ask-pro` prompt asks ChatGPT Pro to:

- inspect the attached manifest/context
- answer the exact architectural/backend question
- recommend one concrete approach
- explain tradeoffs
- name files to edit
- provide an implementation sequence
- identify failure modes
- provide a test plan
- identify what not to do
- create `ask-pro-response.zip` if file generation is available

## Suggested snippet

```text
You are reviewing a hard backend/architecture decision for a coding agent.

Task:
<what we are trying to build/fix>

Question:
<the exact decision needed>

Repository context:
I attached CONTEXT.zip. Read MANIFEST.md first. It lists included files and why they matter.

Stack/constraints:
<language/framework/db/infra/team constraints>

What I inspected:
<files and findings>

Options considered:
<option A, option B, option C>

Please return:
1. recommendation
2. why this approach wins
3. alternatives and tradeoffs
4. implementation sequence
5. files to edit
6. failure modes and migration risks
7. test plan
8. things the coding agent should not do
9. final concise instruction to the coding agent

If file generation is available, also create a downloadable zip named ask-pro-response.zip containing IMPLEMENTATION_PLAN.md, TASKS.json, TEST_PLAN.md, RISK_REGISTER.md, FILES_TO_EDIT.md, and REPO_CONTEXT_USED.md. If you cannot create a zip, return the same content in markdown sections.
```

Never send a vague prompt like “what do you think?” without context.
