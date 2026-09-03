export const runtime = 'edge';

// Server-side only — set these in Vercel Project Settings → Environment Variables.
// Never referenced from client code, never sent in any response.
const KEYS = {
  groq: process.env.GROQ_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  zai: process.env.ZAI_API_KEY,
};

const URLS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  zai: 'https://api.z.ai/api/paas/v4/chat/completions',
};

function pickProvider(model) {
  if (typeof model === 'string' && model.startsWith('glm-')) return 'zai';
  if (model === 'gpt-5.6') return 'openai';
  return 'groq';
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const provider = pickProvider(body.model);
  const key = KEYS[provider];
  if (!key) {
    return new Response(
      JSON.stringify({ error: `Server is missing ${provider.toUpperCase()}_API_KEY — set it in Vercel env vars.` }),
      { status: 500 }
    );
  }

  // Strip any client-controllable fields we don't want forwarded verbatim; whitelist instead.
  const forwardBody = {
    model: body.model,
    messages: body.messages,
  };
  if (body.max_tokens != null) forwardBody.max_tokens = body.max_tokens;
  if (body.temperature != null) forwardBody.temperature = body.temperature;
  if (body.stream != null) forwardBody.stream = body.stream;
  if (body.tools != null) forwardBody.tools = body.tools;
  if (body.tool_choice != null) forwardBody.tool_choice = body.tool_choice;

  let upstream;
  try {
    upstream = await fetch(URLS[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify(forwardBody),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Upstream request failed' }), { status: 502 });
  }

  // Stream mode: pipe the upstream SSE body straight through untouched.
  if (forwardBody.stream) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
      },
    });
  }

  // Non-stream mode: pass the JSON through as-is.
  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
