// @ts-nocheck

import type { APIRoute } from 'astro';
import { ApiError, createBooking, createCustomer } from '@/lib/api.ts';

export const prerender = false;

interface BookingRequestBody {
  tourId?: string;
  tourDate?: string;
  tourScheduleId?: string;
  guests?: number;
  fullName?: string;
  email?: string;
  phone?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { tourId, tourDate, tourScheduleId, guests, fullName, email, phone } = body;

  if (!tourId || !tourDate || !tourScheduleId || !guests || !fullName || !email) {
    return json(
      { message: 'Faltan datos obligatorios: ruta, fecha, hora, personas, nombre y correo.' },
      400
    );
  }

  try {
    // NOTE: the customers API has no "find by email" endpoint, so a repeat
    // visitor booking with an email already on file will hit the 409 branch
    // below rather than reusing their existing customer record. Adding a
    // GET /customers?email= lookup on the backend would let this create a
    // new booking under the existing customer instead of failing.
    const customer = await createCustomer({ fullName, email, phone });
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
      if (err.status === 409) {
        return json(
          {
            message:
              'Ya existe una reserva con este correo electrónico. Contacta con nosotros para gestionar tu reserva.'
          },
          409
        );
      }
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