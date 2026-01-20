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
        ├── utils.js       # ID generation, thinking extraction
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
- `unsaved.json` - Draft entries (auto-saved after each query)
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

# Categories
kbcli categories                 # List
kbcli categories new <slug>      # Create
kbcli categories rm <id>         # Delete

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
  "scope": { "type": "repository", "path": "/path" },
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

## Short IDs

5-character IDs using `abcdefghjkmnpqrstuvwxyz23456789` (excludes confusing chars).
Supports prefix matching: `kbcli drafts show abc` matches `abc12`.
