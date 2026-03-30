# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered journaling backend built with:
- **Express.js** (v5) — web framework
- **Supabase** — PostgreSQL database + authentication
- **Anthropic Claude API** (`@anthropic-ai/sdk`) — AI features
- **dotenv** — environment variable management
- **cors** — CORS middleware

## Commands

No scripts beyond the default placeholder are configured yet. As the project grows, add to `package.json`:

```bash
npm start        # Start server (once index.js exists)
npm run dev      # Dev server with nodemon (if added)
npm test         # Currently placeholder — no test framework configured
```

## Architecture

The project is in early scaffolding state. `package.json` declares `"main": "index.js"` with CommonJS modules (`"type": "commonjs"`).

### Expected structure as the project develops

- `index.js` — Entry point: Express app setup, middleware (cors, json), route mounting, server listen
- `.env` — Required env vars: Supabase URL/key, Anthropic API key, PORT
- Routes → Controllers → Services pattern is typical for this stack

### Key integration points

- **Supabase**: Use `@supabase/supabase-js` client initialized with `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or service role key for server-side). Supabase handles both auth (JWT verification) and DB queries.
- **Anthropic**: Use `@anthropic-ai/sdk` with `ANTHROPIC_API_KEY`. The SDK is already installed — use `claude-sonnet-4-6` or `claude-opus-4-6` as the model.
- **CORS**: Already installed; configure origins to match the frontend domain.

### Environment variables needed

```
SUPABASE_URL=
SUPABASE_ANON_KEY=        # or SUPABASE_SERVICE_ROLE_KEY for server-side
ANTHROPIC_API_KEY=
PORT=3000
```
