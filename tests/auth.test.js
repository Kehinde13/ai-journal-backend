import express from 'express';
import request from 'supertest';
import { createRouter } from '../routes/ai.js';

const mockGetUser = vi.fn();

const app = express();
app.use(express.json());
app.use(
  '/api',
  createRouter({
    supabaseFactory: () => ({ auth: { getUser: mockGetUser } }),
    anthropic: { messages: { create: vi.fn() } },
  })
);

describe('token verification middleware', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/api/analyse-entry').send({ content: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing authorization token');
  });

  it('returns 401 with invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });
    const res = await request(app)
      .post('/api/analyse-entry')
      .set('Authorization', 'Bearer invalidtoken')
      .send({ content: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('returns 401 with malformed Authorization header (no Bearer prefix)', async () => {
    const res = await request(app)
      .post('/api/analyse-entry')
      .set('Authorization', 'notavalidheader')
      .send({ content: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing authorization token');
  });
});
