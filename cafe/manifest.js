/* Single source of truth for the Cafe studio/preview contract. */
(() => {
  const url = new URL('nightshift.manifest.json', document.baseURI).href;
  window.NightshiftCafeManifest = fetch(url, { credentials: 'same-origin' }).then(response => {
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
    return response.json();
  });
})();
