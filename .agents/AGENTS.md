# Agent Instructions

This directory contains project-specific agent context. The [aidevops](https://aidevops.sh)
framework is loaded separately via the global config (`~/.aidevops/agents/`).

## Purpose

Files in `.agents/` provide project-specific instructions that AI assistants
read when working in this repository. Use this for:

- Domain-specific conventions not covered by the framework
- Project architecture decisions and patterns
- API design rules, data models, naming conventions
- Integration details (third-party services, deployment targets)

## Adding Agents

Create `.md` files in this directory for domain-specific context:

```text
.agents/
  AGENTS.md              # This file - overview and index
  api-patterns.md        # API design conventions
  deployment.md          # Deployment procedures
  data-model.md          # Database schema and relationships
```

Each file is read on demand by AI assistants when relevant to the task.

## Security

### MCP Server Output Sanitization

This project is an MCP server. MCP server outputs are consumed by AI agents, making them a prompt injection attack surface. If the QuickFile API returns user-controlled content (invoice descriptions, contact names, notes, free-text fields) containing injection payloads, the consuming AI agent could be manipulated.

**When returning data from QuickFile API responses:**

1. **Document which fields contain user-controlled content** in tool descriptions
2. **Strip HTML/script tags** from free-text fields before returning
3. **Be aware** that consumers should use `@stackone/defender` to wrap tool results from this server

See the [framework security docs](https://github.com/marcusquinn/aidevops) `tools/security/prompt-injection-defender.md` for the full MCP trust model and defense layers.

**Related issue**: [#38](https://github.com/marcusquinn/quickfile-mcp/issues/38)
