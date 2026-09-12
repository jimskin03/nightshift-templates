(() => {
  const allowed = window.location.origin;
  window.addEventListener('message', event => {
    if (event.origin !== allowed || !event.data || event.data.channel !== 'nightshift-preview') return;
    if (event.data.type === 'NIGHTSHIFT_PREVIEW_UPDATE') {
      const result = window.NightshiftCafe.render(event.data.config);
      event.source?.postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_ACK', requestId: event.data.requestId, ...result }, allowed);
    }
  });
  window.parent?.postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_READY' }, allowed);
})();
