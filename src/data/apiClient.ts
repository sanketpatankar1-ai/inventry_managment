const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v2';

export async function apiSubmitUnloadRequest(payload: any) {
  const res = await fetch(`${BASE_URL}/unload-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to submit unload request');
  }
  return res.json();
}

export async function apiGetUnloadRequest(workDayId: string) {
  const res = await fetch(`${BASE_URL}/unload-requests/${workDayId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch unload request status');
  return res.json();
}
