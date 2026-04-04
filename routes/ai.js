const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

// createRouter is a factory function that builds and returns an Express router.
// It accepts an optional `deps` object so that tests can pass in mock versions
// of the Anthropic client and the Supabase factory instead of hitting real APIs.
function createRouter(deps = {}) {
  const router = express.Router();

  // Use the injected Anthropic client if provided (e.g. in tests), otherwise
  // create a real one using the API key from the environment.
  const anthropic =
    deps.anthropic ||
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // supabaseFactory is a function that creates a Supabase client given a URL and key.
  // Using a factory (instead of a single shared client) means each request gets a
  // fresh client — useful if credentials ever need to vary per request.
  const supabaseFactory =
    deps.supabaseFactory ||
    ((url, key) => createClient(url, key));

  // verifyToken checks that the incoming request has a valid Supabase JWT.
  // It returns the authenticated user object on success, or null on failure
  // (and also sends the 401 response itself so the caller just needs to check for null).
  async function verifyToken(req, res) {
    // The token is expected in the Authorization header as: "Bearer <token>"
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' });
      return null;
    }

    // Create a Supabase client with the service role key, which has permission
    // to verify any user's token server-side (bypasses row-level security).
    const supabase = supabaseFactory(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Ask Supabase to decode and validate the JWT. If the token is expired,
    // tampered with, or otherwise invalid, `error` will be set.
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return null;
    }

    // Return the user object (contains id, email, etc.) for use in route handlers.
    return data.user;
  }

  // POST /api/analyse-entry
  // Accepts a single journal entry and returns an AI-generated mood label,
  // mood score (1-10), and a short psychological insight.
  router.post('/analyse-entry', async (req, res) => {
    // Authenticate the request before doing anything else.
    const user = await verifyToken(req, res);
    if (!user) return; // verifyToken already sent a 401, so just stop here.

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Missing entry content' });
    }

    // Send the journal entry to Claude with a structured prompt.
    // We ask for raw JSON (no markdown fences) so we can parse it directly.
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512, // Short response — just a mood label, score, and one insight.
      messages: [
        {
          role: 'user',
          content: `Analyse the following journal entry and respond with a JSON object containing:
- "mood": a short label for the overall mood (e.g. "anxious", "hopeful", "content")
- "moodScore": an integer from 1 (very negative) to 10 (very positive)
- "insights": a concise string with 1-2 sentences of psychological insight

Respond with raw JSON only, no markdown fences.

Journal entry:
"""
${content}
"""`,
        },
      ],
    });

    // Claude's reply is in message.content[0].text — parse it from JSON string to object.
    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);

    res.json(parsed);
  });

  // POST /api/weekly-summary
  // Accepts an array of journal entries (from the past week) and returns a narrative
  // summary, the dominant mood for the week, and an array of broader insights.
  router.post('/weekly-summary', async (req, res) => {
    const user = await verifyToken(req, res);
    if (!user) return;

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array' });
    }

    // Entries can be plain strings or objects with a `content` property.
    // Normalise them into a single numbered block of text for the prompt.
    const entriesText = entries
      .map((e, i) => `Entry ${i + 1}:\n${typeof e === 'string' ? e : e.content}`)
      .join('\n\n');

    // Higher token limit than analyse-entry because the response includes
    // a summary paragraph plus an array of multiple insight strings.
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a thoughtful journaling assistant. Review the following journal entries from the past week and respond with a JSON object containing:
- "summary": a 2-3 sentence narrative summary of the week
- "dominantMood": the single mood that best characterises the week
- "insights": an array of 2-4 concise insight strings the user might find valuable

Respond with raw JSON only, no markdown fences.

${entriesText}`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);

    res.json(parsed);
  });

  return router;
}

// Export a default router instance for use by index.js at runtime,
// and also export the factory so tests can call createRouter({ ...mocks }).
module.exports = createRouter();
module.exports.createRouter = createRouter;
