// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, createBooking, getCurrentCustomer } from '@/lib/api.ts';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

interface BookingRequestBody {
  tourId?: string;
  tourDate?: string;
  tourScheduleId?: string;
  guests?: number;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) {
    return json({ message: 'Debes verificar tu correo antes de reservar.' }, 401);
  }

  let customer;
  try {
    customer = await getCurrentCustomer(token);
  } catch {
    clearSessionCookie(cookies);
    return json({ message: 'Tu sesión ha expirado. Verifica tu correo de nuevo para continuar.' }, 401);
  }

  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { tourId, tourDate, tourScheduleId, guests } = body;

  if (!tourId || !tourDate || !tourScheduleId || !guests) {
    return json(
      { message: 'Faltan datos obligatorios: ruta, fecha, hora y número de personas.' },
      400
    );
  }

  try {
    const booking = await createBooking({
      customerId: customer.id,
      tourId,
      tourDate,
      tourScheduleId,
      quantity: guests
    });
    return json(booking, 201);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return json({ message: 'La ruta seleccionada ya no está disponible.' }, 404);
      }
      if (err.status === 400) {
        return json({ message: err.message }, 400);
      }
    }
    console.error('Failed to create booking', err);
    return json(
      { message: 'No se ha podido completar la reserva. Inténtalo de nuevo más tarde.' },
      500
    );
  }
};