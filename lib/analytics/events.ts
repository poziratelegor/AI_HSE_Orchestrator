export async function trackEvent(eventName: string, payload: Record<string, unknown>) {
  return {
    ok: true,
    eventName,
    payload
  };
}
