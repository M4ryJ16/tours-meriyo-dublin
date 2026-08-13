// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, getBooking, finalizeStripePayment, getCurrentCustomer } from '@/lib/api.js';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) return json({ message: 'Debes iniciar sesión para confirmar el pago.' }, 401);

  let customer;
  try {
    customer = await getCurrentCustomer(token);
  } catch {
    clearSessionCookie(cookies);
    return json({ message: 'Tu sesión ha expirado. Inicia sesión de nuevo.' }, 401);
  }

  let body: { paymentIntentId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }
  if (!body.paymentIntentId) {
    return json({ message: 'Falta paymentIntentId.' }, 400);
  }

  try {
    const booking = await getBooking(params.id as string);
    if (booking.customer_id !== customer.id) {
      return json({ message: 'Esta reserva no pertenece a tu cuenta.' }, 403);
    }

    const updated = await finalizeStripePayment(params.id as string, body.paymentIntentId);
    return json(updated, 200);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return json({ message: 'Reserva no encontrada.' }, 404);
      if (err.status === 409) return json({ message: err.message }, 409);
      if (err.status === 400) return json({ message: err.message }, 400);
    }
    console.error('Failed to finalize Stripe payment', err);
    return json({ message: 'No se ha podido confirmar el pago. Contacta con nosotros si el cargo se ha realizado.' }, 500);
  }
};