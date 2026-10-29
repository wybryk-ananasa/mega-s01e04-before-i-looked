import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function registerDigestApi(app: Hono, config: RigConfig): void {
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!NIGHT_PATTERN.test(night)) return c.json({ error: 'invalid night' }, 400);

    const result = readNight(config.runsDir, night);
    if (!result.found) return c.json({ error: 'night not found' }, 404);
    return c.json(result);
  });
}
