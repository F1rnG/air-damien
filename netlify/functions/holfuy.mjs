// Holfuy launch wind proxy.
// Fetches the public Holfuy widget HTML for El Peñón Launch (station 609),
// parses the embedded data values, and returns clean JSON. This solves the
// CORS problem (browser cannot fetch Holfuy directly) and lets the conditions
// page render the data in our own UI instead of a styled iframe.
//
// Cached for 60 seconds at the CDN edge to avoid hammering Holfuy.

const HOLFUY_STATION_ID = 609; // El Peñón Launch
const WIDGET_URL = `https://widget.holfuy.com/?station=${HOLFUY_STATION_ID}&su=mph&t=F&lang=en&type=2`;

// Pull a single value out of the widget HTML by its DOM id.
function pickById(html, id) {
  const re = new RegExp(`id=["']${id}["'][^>]*>([^<]*)`);
  const match = html.match(re);
  if (!match) return null;
  const raw = match[1].trim();
  return raw === '' || raw === '-' ? null : raw;
}

// Numeric extraction with fallback.
function pickNumber(html, id) {
  const v = pickById(html, id);
  if (v === null) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// "Updated: <b>104</b> sec. ago" -> 104
function parseUpdatedSeconds(html) {
  const m = html.match(/id=["']act_date["'][^>]*>\s*<b>\s*(\d+)\s*<\/b>/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export default async (request, context) => {
  try {
    const upstream = await fetch(WIDGET_URL, {
      headers: {
        'User-Agent': 'AirDamien-Conditions-Proxy/1.0 (+https://airdamien.com)',
        'Accept': 'text/html'
      }
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `upstream_${upstream.status}` }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const html = await upstream.text();

    const data = {
      ok: true,
      stationId: HOLFUY_STATION_ID,
      stationName: 'El Peñón Launch',
      elevationM: 2350,
      units: { speed: 'mph', temperature: 'F' },

      // Live wind (current 2-3 second sample)
      wind: {
        speedMph: pickNumber(html, 'j_speed'),
        gustMph: pickNumber(html, 'j_gust'),
        directionLabel: pickById(html, 'j_dir'),
      },

      // 15-minute averages
      avg15: {
        speedMph: pickNumber(html, 'j_avg_speed'),
        maxGustMph: pickNumber(html, 'j_max_gust'),
        directionLabel: pickById(html, 'j_avg_dir'),
      },

      // Day's range so far
      daily: {
        avgSpeedMph: pickNumber(html, 'j_daily_avg_speed'),
        maxGustMph: pickNumber(html, 'j_daily_max_wind'),
      },

      // Temperature & feel
      temperature: {
        airF: pickNumber(html, 'j_temperature'),
        windChillF: pickNumber(html, 'j_wind_chill'),
        dailyMaxF: pickNumber(html, 'j_daily_max_temp'),
        dailyMinF: pickNumber(html, 'j_daily_min_temp'),
      },

      // Atmospheric
      atmosphere: {
        humidityPct: pickNumber(html, 'j_humidity'),
        cloudBaseM: pickNumber(html, 'j_cloud_base'),
        pressureHpa: pickNumber(html, 'j_pressure'),
        rainMmToday: pickNumber(html, 'j_rain'),
      },

      // Freshness
      lastReadingSecondsAgo: parseUpdatedSeconds(html),
      fetchedAtIso: new Date().toISOString(),

      // Attribution (always required)
      source: {
        provider: 'Holfuy',
        stationUrl: `https://holfuy.com/en/weather/${HOLFUY_STATION_ID}`,
        widgetUrl: WIDGET_URL,
      },
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // Cache 60 seconds at the edge, allow 5 minutes of stale-while-revalidate
        'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        'access-control-allow-origin': '*',
        'x-source': 'holfuy-widget-proxy',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'fetch_failed', message: String(err && err.message || err) }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
};

export const config = {
  path: '/api/holfuy',
};
