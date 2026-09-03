export const runtime = 'edge';

const TAVILY_KEY = process.env.TAVILY_API_KEY;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!TAVILY_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server is missing TAVILY_API_KEY — set it in Vercel env vars.' }),
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.query || typeof body.query !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
  }

  const upstream = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + TAVILY_KEY,
    },
    body: JSON.stringify({
      query: body.query,
      search_depth: 'basic',
      max_results: 8,
      include_answer: true,
    }),
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
