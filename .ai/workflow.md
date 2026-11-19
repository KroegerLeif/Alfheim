# Issue-to-PR workflow

The loop every agent follows for one issue. The rules each step relies on are in
[`AGENTS.md`](../AGENTS.md); this file only orders them.

1. **Read the issue.** `gh issue view <n>`, including the target files, acceptance criteria and
   the "Diátaxis docs update required" note. Ask before widening the scope.
2. **Branch off `dev`.** `git fetch origin && git switch -c <type>/<name> origin/dev`.
   Never commit to `main`.
3. **Read the nearest nested `AGENTS.md`** for the directories you touch, and the convention page
   it links.
4. **Implement** the change and its tests.
5. **Run the gate.** `./scripts/verify.sh --<stack>` for every stack you touched, plus
   `--security`. Fix until each exits 0; do not commit unverified work.
6. **Commit the code** as a Conventional Commit that references the issue.
7. **Update the docs** named in the issue in a separate `docs(...)` commit.
8. **Add a changelog entry** under `[Unreleased]` in [`CHANGELOG.md`](../CHANGELOG.md), in the
   format stated by the comment there.
9. **Open the pull request against `dev`.** Put `Closes #<n>` in the body and list the gates you
   ran with their exit codes.
10. **Address review** with new commits on the same branch; rerun step 5 after each change.
