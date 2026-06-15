import { json } from '@sveltejs/kit';
import { builderConfig } from '$lib/server/config';
import { localDb } from '$lib/server/local-db';

export const GET = () => {
  try {
    const config = builderConfig();
    if (config.mode === 'local') localDb().prepare('select 1').get();
    return json({ ok: true, mode: config.mode });
  } catch { return json({ ok: false }, { status: 503 }); }
};
