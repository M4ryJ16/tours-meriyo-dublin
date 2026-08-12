// Server-only helper for talking to the tours/bookings API.
//
// This must never be imported from a client-side <script> block — it reads
// the API key from a server-only env var (no PUBLIC_ prefix, see
// .env.example) and would leak it to the browser if bundled client-side.
// Use it from Astro frontmatter (runs server-side) or from src/pages/api/*
// endpoints.

const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.API_KEY;

if (!API_KEY) {
  console.warn('[api] API_KEY is not set — requests to the booking API will fail with 401.');

}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY ?? '',
      ...(options.headers ?? {})
    }
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}

// --- Tours — public catalog browsing, x-api-key only, no publish key ---

export function getTours({ active = true } = {}) {
  const params = new URLSearchParams();
  if (active !== undefined) params.set('active', String(active));
  return apiFetch(`/tours?${params.toString()}`);
}

export function getTour(id) {
  return apiFetch(`/tours/${id}`);

}

// GET /tours list doesn't join gallery images (only GET /tours/:id does),
// so the catalog grid fetches each tour's gallery separately to show a
// cover photo. Fine at this scale (a handful of tours); worth caching or
// batching if the catalog grows a lot.

export function getTourGallery(tourId) {
  return apiFetch(`/tours/${tourId}/gallery`);

}

// A tour's available departure times. Bookings now require a
// tour_schedule_id (see /lib/adminApi.js and the booking form), so the
// frontend needs to be able to look these up — both server-side (Booking.astro
// pre-selecting a tour) and, via src/pages/api/tours/[id]/schedules.js, from
// client-side code that can't hold the API key itself.
export function getTourSchedules(tourId) {
  return apiFetch(`/tours/${tourId}/schedules`);
}

// --- Reviews ---

// Homepage testimonials: a small random sample across the whole catalog,
// using the API's /reviews/random endpoint (with `count` set to however
// many the caller wants to show). withContentOnly is on by default here
// since a quote with no text isn't useful to display.
export async function getRandomReviews({ count = 5, tourId, minStars, withContentOnly = true } = {}) {
  const params = new URLSearchParams();
  params.set('count', String(count));
  if (tourId) params.set('tourId', tourId);
  if (minStars !== undefined) params.set('minStars', String(minStars));
  params.set('withContentOnly', String(withContentOnly));

  const data = await apiFetch(`/reviews/random?${params.toString()}`);
  return data.reviews;
}

// One page of reviews for a single tour.
export function getTourReviews(tourId, { limit = 20, offset = 0, stars } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (stars !== undefined) params.set('stars', String(stars));
  return apiFetch(`/tours/${tourId}/reviews?${params.toString()}`);
}

// Every review for a tour, not just one page. The API caps a single page
// at 100 (see MAX_PAGE_SIZE in the reviews route), so this pages through
// until a page comes back shorter than requested — that's the signal
// there's nothing left to fetch.
export async function getAllTourReviews(tourId) {
  const pageSize = 100;
  let offset = 0;
  let all = [];

  while (true) {
    const page = await getTourReviews(tourId, { limit: pageSize, offset });
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

// Aggregate rating for a tour — review count, average stars, and the
// 1–5 star breakdown.
export function getTourReviewSummary(tourId) {
  return apiFetch(`/tours/${tourId}/reviews/summary`);
}

// --- Customers & bookings ---
// Deliberately not wired up here: payment methods (/customers/:id/payment-methods,
// /payment-methods/:id) and transactions (/transactions/*). Those are payment
// endpoints and this site only creates the booking record itself.

export function createCustomer(data) {
  return apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function createBooking(data) {
  return apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function getBooking(id) {
  return apiFetch(`/bookings/${id}`);
}

// --- Auth (customer login / registration by email code — no passwords) ---

export function requestRegisterCode({ email, fullName, phone }) {
  return apiFetch('/auth/register/request-code', {
    method: 'POST',
    body: JSON.stringify({ email, fullName, phone })
  });
}

export function verifyRegisterCode({ email, code }) {
  return apiFetch('/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  });
}

export function requestLoginCode({ email }) {
  return apiFetch('/auth/login/request-code', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function verifyLoginCode({ email, code }) {
  return apiFetch('/auth/login/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  });
}

// Resolves the customer for a session token by asking the backend to
// verify the JWT itself (via /auth/me) — the frontend never needs to know
// JWT_SECRET, it just forwards the Bearer token.
export function getCurrentCustomer(token) {
  return apiFetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}