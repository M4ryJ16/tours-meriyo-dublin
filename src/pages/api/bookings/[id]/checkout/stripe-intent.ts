// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, getBooking, createStripePaymentIntent, getCurrentCustomer } from '@/lib/api.js';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ params, cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) return json({ message: 'Debes iniciar sesión para pagar esta reserva.' }, 401);

  let customer;
  try {
    customer = await getCurrentCustomer(token);
  } catch {
    clearSessionCookie(cookies);
    return json({ message: 'Tu sesión ha expirado. Inicia sesión de nuevo.' }, 401);
  }

  try {
    const booking = await getBooking(params.id as string);
    if (booking.customer_id !== customer.id) {
      return json({ message: 'Esta reserva no pertenece a tu cuenta.' }, 403);
    }

    const intent = await createStripePaymentIntent(params.id as string);
    return json(intent, 200);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return json({ message: 'Reserva no encontrada.' }, 404);
      if (err.status === 409) return json({ message: err.message }, 409);
    }
    console.error('Failed to create Stripe payment intent', err);
    return json({ message: 'No se ha podido iniciar el pago. Inténtalo de nuevo más tarde.' }, 500);
  }
};