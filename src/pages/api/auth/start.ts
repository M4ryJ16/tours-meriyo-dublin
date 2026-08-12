// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, requestLoginCode, requestRegisterCode } from '@/lib/api.js';

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

  const { email, fullName, phone } = body ?? {};
  if (!email) return json({ message: 'El correo electrónico es obligatorio.' }, 400);

  // Most repeat visitors already have an account — try logging in first.
  try {
    const result = await requestLoginCode({ email });
    return json({ mode: 'login', ...result }, 202);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      const status = err instanceof ApiError ? err.status : 500;
      const message = err instanceof ApiError ? err.message : 'No se ha podido continuar. Inténtalo de nuevo.';
      return json({ message }, status);
    }
    // 404 = no account for this email → fall through to registration.
  }

  if (!fullName) {
    return json({ message: 'Introduce tu nombre completo para crear una cuenta.' }, 400);
  }

  try {
    const result = await requestRegisterCode({ email, fullName, phone });
    return json({ mode: 'register', ...result }, 202);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : 'No se ha podido crear la cuenta. Inténtalo de nuevo.';
    return json({ message }, status);
  }
};