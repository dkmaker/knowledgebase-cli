# @dkmaker/knowledgebase-cli

A profile-based research CLI with knowledge management capabilities. Execute AI-powered research queries and organize results into a curated library.

## Features

- **Profile-based research**: Choose from general, code, docs, or troubleshoot profiles
- **Multiple providers**: Extensible provider system (currently supports Perplexity)
- **Knowledge management**: Save research to drafts, curate into categorized library
- **AI-optimized output**: Token-efficient output format for AI agent integration
- **Zero dependencies**: Uses only Node.js built-ins (fetch, fs, path, crypto)

## Installation

```bash
npm install -g @dkmaker/knowledgebase-cli
```

Or run directly with npx:

```bash
npx @dkmaker/knowledgebase-cli "your query"
```

## Usage

### Execute a search

```bash
# General research (default profile)
kbcli "What is quantum computing?"

# Code examples
kbcli --profile code "React hooks examples"

# Official documentation
kbcli --profile docs "Node.js fs.readFile"

# Troubleshooting
kbcli --profile troubleshoot "ECONNREFUSED error"
```

### Manage drafts

```bash
# List all drafts
kbcli drafts

# List drafts for current repository only
kbcli drafts --local

# View a draft entry
kbcli drafts show abc123

# View with sources and thinking
kbcli drafts show abc123 --sources --thinking

# Save draft to library
kbcli drafts save abc123 --to my-category

# Delete a draft
kbcli drafts rm abc123
```

### Manage library

```bash
# List all library entries
kbcli library

# Filter by category
kbcli library --category react

# View an entry
kbcli library show abc123
```

### Manage categories

```bash
# List categories
kbcli categories

# Create a new category
kbcli categories new react-hooks --desc "React hooks patterns"

# Delete a category
kbcli categories rm abc123
```

### View profiles and providers

```bash
# List available profiles
kbcli profiles

# List available providers
kbcli providers
```

## Output Formats

- `md` - Markdown with YAML frontmatter (default for humans)
- `ai` - Token-efficient YAML-style output (default when CLAUDECODE=1)
- `json` - Raw JSON output

```bash
kbcli --output json "your query"
```

## Search Options

| Option | Description |
|--------|-------------|
| `--profile, -p` | Profile: general, code, docs, troubleshoot |
| `--model, -m` | Override model from profile |
| `--recency` | Filter: day, week, month, year |
| `--domains` | Comma-separated domain filter |
| `--max-tokens` | Maximum response tokens |
| `--show-thinking` | Display reasoning process |
| `--output, -o` | Output format: md, json, ai |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PERPLEXITY_API_KEY` | Perplexity API key (required) |
| `KBCLI_DATA_DIR` | Override data directory (default: ~/.local/share/knowledgebase) |
| `CLAUDECODE` | Set to "1" for AI-optimized output |

## Data Storage

All data is stored in `~/.local/share/knowledgebase/`:

- `categories.json` - Category definitions
- `drafts.json` - Draft research entries
- `library.json` - Curated library entries

## Profiles

| Profile | Model | Purpose |
|---------|-------|---------|
| `general` | sonar | General-purpose research (default) |
| `code` | sonar-reasoning-pro | Code examples with step-by-step reasoning |
| `docs` | sonar | Official documentation and API references |
| `troubleshoot` | sonar | Error messages, bugs, debugging |

## Requirements

- Node.js >= 18.0.0

## License

MIT
