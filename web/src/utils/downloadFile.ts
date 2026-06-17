/**
 * Trigger a browser file download from a POST request.
 * Fetches the URL with the given body and triggers a file download in the browser.
 */
export async function downloadFileFromPost(
  url: string,
  body: Record<string, unknown>,
  fileName: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Export failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.message) errorMessage = err.message;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}
