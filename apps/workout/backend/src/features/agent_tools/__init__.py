"""Cross-feature composite MCP tool surface.

Named `agent_tools` rather than `mcp` to avoid colliding with the installed
`mcp` SDK package (pytest's test-module-name inference resolves by directory
name when a parent lacks __init__.py, matching this repo's existing
convention of no src/__init__.py or src/features/__init__.py) — `import mcp`
inside this package would otherwise shadow or be shadowed by the real one.

This is a DELIBERATE, documented exception to the mandatory 6-file feature
module standard (.ai/stacks/python_fastapi.md): this slice holds only
mcp_tools.py (+ tests/) and has no models.py/schemas.py/service.py/router.py
of its own. Its tools compose agent-facing actions that necessarily span
multiple features (e.g. "start today's workout and log a set" touches
plans, exercises, and session). Every tool here still honors the "delegate
to service.py, never duplicate business logic" rule — it just delegates to
*multiple* features' service.py modules (plans.service, session.service)
instead of one, rather than reimplementing any business logic itself.

Every tool takes explicit household_id/user_id parameters and passes them
straight into the underlying services, so household-scoped filtering is
enforced identically to the REST routes and to each feature's own
mcp_tools.py (see plans/mcp_tools.py, session/mcp_tools.py, etc.) — this is
the deliberate fix versus pantry/chores' MOCK_HOME_ID-hardcoded MCP tools.
"""
