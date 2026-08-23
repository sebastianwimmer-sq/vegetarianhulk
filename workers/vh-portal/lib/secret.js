// Beide Seiten werden erst gehasht, damit der Vergleich immer gleich lange
// Puffer bekommt und die Laenge des Secrets nicht ueber die Laufzeit durchsickert.
async function digest(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function matchesSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length === 0) {
    return false;
  }

  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}
