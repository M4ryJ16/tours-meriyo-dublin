import { getTourAvailability } from "@/lib/api.js";

export const prerender = false;

export async function GET({ params, url }) {
  const date = url.searchParams.get("date");
  const scheduleId = url.searchParams.get("scheduleId");

  if (!date || !scheduleId) {
    return new Response(
      JSON.stringify({ message: "Faltan parámetros date y scheduleId." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const availability = await getTourAvailability(params.id, { date, scheduleId });
    return new Response(JSON.stringify(availability), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Failed to load tour availability", err);
    return new Response(
      JSON.stringify({ message: "No se ha podido comprobar la disponibilidad." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}