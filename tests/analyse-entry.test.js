import express from 'express';
import request from 'supertest';
import { createRouter } from '../routes/ai.js';

const mockMessagesCreate = vi.fn();

const app = express();
app.use(express.json());
app.use(
  '/api',
  createRouter({
    supabaseFactory: () => ({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: 'user-123', email: 'test@example.com' } },
            error: null,
          }),
      },
    }),
    anthropic: { messages: { create: mockMessagesCreate } },
  })
);

describe('POST /api/analyse-entry', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/analyse-entry').send({ content: 'test entry' });
    expect(res.status).toBe(401);
  });

  it('returns 400 without content', async () => {
    const res = await request(app)
      .post('/api/analyse-entry')
      .set('Authorization', 'Bearer validtoken')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing entry content');
  });
});
