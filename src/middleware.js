import { defineMiddleware } from "astro:middleware";

// Guards the admin panel and its API routes with HTTP Basic Auth.
// Set ADMIN_USER / ADMIN_PASSWORD server-side (not PUBLIC_-prefixed).
// This is a minimal gate, not a replacement for a real auth system —
// swap it out if the project already has one.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdminRoute) {
    return next();
  }

  const adminUser = import.meta.env.ADMIN_USER;
  const adminPassword = import.meta.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return new Response(
      "El panel de administración no está configurado (faltan ADMIN_USER / ADMIN_PASSWORD).",
      { status: 500 }
    );
  }

  const authHeader = context.request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (user === adminUser && password === adminPassword) {
      return next();
    }
  }

  return new Response("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' }
  });
});