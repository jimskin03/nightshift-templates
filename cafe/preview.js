(() => {
  const allowed = window.location.origin;
  let latestRequestId = 0;
  const isTrustedParent = event => event.origin !== allowed ? false : event.source === window.parent;
  window.addEventListener('message', async event => {
    if (!isTrustedParent(event) || event.data?.channel !== 'nightshift-preview') return;
    if (event.data.type !== 'NIGHTSHIFT_PREVIEW_UPDATE' || !Number.isInteger(event.data.requestId)) return;
    if (event.data.requestId <= latestRequestId) return;
    latestRequestId = event.data.requestId;
    const result = await window.NightshiftCafe.render(event.data.config);
    event.source.postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_ACK', requestId: event.data.requestId, ...result }, allowed);
  });
  window.parent?.postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_READY' }, allowed);
})();
