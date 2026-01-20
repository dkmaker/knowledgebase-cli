# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Overview

`@dkmaker/knowledgebase-cli` (binary: `kbcli`) is a profile-based research CLI with knowledge management. It queries AI providers (Perplexity) and stores results in a curated library.

## Architecture

```
knowledgebase-cli/
├── package.json       # @dkmaker/knowledgebase-cli, bin: kbcli
└── src/
    ├── index.js       # CLI entry point, argument parsing, routing
    ├── profiles.json  # Research profile definitions
    ├── providers/     # API provider implementations
    │   ├── index.js       # Provider registry
    │   ├── base.js        # Base provider + JSON schema
    │   └── perplexity.js  # Perplexity API implementation
    ├── renderers/     # Output formatters
    │   ├── index.js       # Renderer registry
    │   ├── base.js        # Base renderer interface
    │   ├── json.js        # JSON output
    │   ├── markdown.js    # Markdown with YAML frontmatter
    │   └── ai.js          # Token-efficient YAML for AI agents
    └── storage/       # Persistence layer
        ├── index.js       # Data directory, file I/O
        ├── utils.js       # ID generation, thinking extraction, git detection
        ├── entries.js     # Entry CRUD (drafts, library)
        └── categories.js  # Category CRUD
```

## Key Concepts

### Profiles
Task-oriented research modes defined in `src/profiles.json`:
- `general` - General research (sonar model)
- `code` - Code examples (sonar-reasoning-pro)
- `docs` - Documentation lookup (sonar)
- `troubleshoot` - Error debugging (sonar)

### Storage
Data stored in `~/.local/share/knowledgebase/` (override with `KBCLI_DATA_DIR`):
- `drafts.json` - Draft entries (auto-saved after each query)
- `library.json` - Curated entries with categories
- `categories.json` - Category definitions

### Output Formats
- `md` - Markdown with YAML frontmatter (human default)
- `ai` - Token-efficient YAML (default when `CLAUDECODE=1`)
- `json` - Raw JSON

## CLI Commands

```bash
# Research
kbcli "query"                    # General research
kbcli --profile code "query"     # Code-focused
kbcli --profile docs "query"     # Documentation
kbcli --profile troubleshoot "query"  # Debugging

# Drafts management
kbcli drafts                     # List drafts
kbcli drafts show <id>           # View entry
kbcli drafts save <id> --to <cat>  # Save to library
kbcli drafts rm <id>             # Delete

# Library management
kbcli library                    # List library
kbcli library --category <id>    # Filter by category
kbcli library show <id>          # View entry

# Categories (all fields required for new)
kbcli categories                 # List
kbcli categories new <slug> --short "..." --long "..." --ai "..." --rules "..." --example "..."
kbcli categories update <slug>   # Update fields
kbcli categories rm <slug>       # Delete

# Info
kbcli profiles                   # List profiles
kbcli providers                  # List providers
```

## Development

### Setup

```bash
pnpm install
pnpm link --global   # Makes 'kbcli' available globally
```

### Testing locally

```bash
# Via global link (preferred)
kbcli --help
kbcli profiles
kbcli drafts

# Or via node directly
node src/index.js --help
```

### Dependencies

Zero external dependencies - uses Node.js built-ins only:
- `fetch` (Node 18+)
- `fs`, `path`, `os`

### Adding a provider

1. Create `src/providers/newprovider.js` extending `BaseProvider`
2. Implement `ask()` method
3. Register in `src/providers/index.js`
4. Add profiles using the provider in `src/profiles.json`

### Adding a profile

Edit `src/profiles.json`:
```json
{
  "profile-name": {
    "provider": "perplexity",
    "model": "sonar",
    "description": "Profile description",
    "system": "System prompt for LLM",
    "prompt": "User message template with {{QUERY}}"
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PERPLEXITY_API_KEY` | Yes | Perplexity API authentication |
| `KBCLI_DATA_DIR` | No | Override storage directory |
| `CLAUDECODE` | No | Set to "1" for AI-optimized output |

## Entry Schema

```json
{
  "id": "xp48e",
  "query": "original query",
  "profile": "code",
  "model": "sonar-reasoning-pro",
  "provider": "perplexity",
  "scope": {
    "type": "repository",
    "path": "/path/to/git/root",
    "git": {
      "remote": "git@github.com:user/repo.git",
      "branch": "main"
    }
  },
  "title": "Generated title",
  "content": "Response with [n] refs",
  "thinking": "Reasoning or null",
  "examples": [{ "description": "", "code": "", "language": "" }],
  "sources": [{ "number": 1, "title": "", "url": "", "snippet": "" }],
  "created_at": "ISO8601",
  "category_id": "kunhu",
  "curated_at": "ISO8601"
}
```

### Scope Types

- `repository` - Inside a git repo (has `.git`), path is git root, includes git remote/branch
- `folder` - Not in a git repo, just a folder path (no git info)
- `global` - Set via `--general` flag during research (not auto-detected)

## Category Schema

```json
{
  "id": "p9njd",
  "slug": "auth",
  "short_desc": "Authentication patterns and security",
  "long_desc": "OAuth flows, JWT handling, session management, and security best practices",
  "ai_summary": "auth: oauth|jwt|session|security patterns for web apps",
  "rules": "Apply when entry covers: login flows, token management, auth middleware",
  "examples": ["OAuth 2.0 flow", "JWT refresh rotation", "Session security"],
  "created_at": "ISO8601"
}
```

All fields except `id` and `created_at` are required when creating a category. The `slug` is the user-facing identifier; `id` is internal only.

## Short IDs

5-character IDs using `abcdefghjkmnpqrstuvwxyz23456789` (excludes confusing chars).
Supports prefix matching: `kbcli drafts show abc` matches `abc12`.
