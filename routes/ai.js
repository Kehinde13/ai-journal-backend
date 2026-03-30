const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function verifyToken(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  return data.user;
}

// POST /api/analyse-entry
router.post('/analyse-entry', async (req, res) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Missing entry content' });
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
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

  const raw = message.content[0].text.trim();
  const parsed = JSON.parse(raw);

  res.json(parsed);
});

// POST /api/weekly-summary
router.post('/weekly-summary', async (req, res) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries must be a non-empty array' });
  }

  const entriesText = entries
    .map((e, i) => `Entry ${i + 1}:\n${typeof e === 'string' ? e : e.content}`)
    .join('\n\n');

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

module.exports = router;
