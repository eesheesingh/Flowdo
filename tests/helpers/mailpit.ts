const MAILPIT_URL = "http://127.0.0.1:54324";

export async function waitForEmail(to: string, retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const json = await res.json();
    if (json.messages && json.messages.length > 0) {
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${json.messages[0].ID}`);
      return msgRes.json();
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`No email arrived for ${to} within ${retries * delayMs}ms`);
}
