// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, verifyLoginCode, verifyRegisterCode } from '@/lib/api.js';
import { setSessionCookie } from '@/lib/session.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { mode, email, code } = body ?? {};
  if (!mode || !email || !code) {
    return json({ message: 'Faltan datos: modo, correo o código.' }, 400);
  }
  if (mode !== 'login' && mode !== 'register') {
    return json({ message: 'Modo de verificación no válido.' }, 400);
  }

  try {
    const result = mode === 'login'
      ? await verifyLoginCode({ email, code })
      : await verifyRegisterCode({ email, code });

    setSessionCookie(cookies, result.token);
    return json({ customer: result.customer }, mode === 'register' ? 201 : 200);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : 'No se ha podido verificar el código.';
    return json({ message }, status);
  }
};