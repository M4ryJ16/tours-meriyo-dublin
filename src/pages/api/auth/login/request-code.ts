// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, requestLoginCode } from '@/lib/api.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { email } = body ?? {};
  if (!email) return json({ message: 'El correo electrónico es obligatorio.' }, 400);

  try {
    const result = await requestLoginCode({ email });
    return json(result, 202);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : 'No se ha podido enviar el código.';
    return json({ message }, status);
  }
};