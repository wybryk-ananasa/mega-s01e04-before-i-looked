import type { Hono } from 'hono';
import { lane } from '../lane.js';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';
import { DigestPage } from '../views/digest.js';
import { Layout } from '../views/layout.js';

const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function registerDigestPage(app: Hono, config: RigConfig) {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!NIGHT_PATTERN.test(night)) return c.notFound();

    const digest = readNight(config.runsDir, night);
    if (!digest.found) return c.notFound();

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });
}
