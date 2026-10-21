const meta = document.querySelector('meta[name="lat-redirect"]');
if (meta) {
  try {
    window.location.replace(decodeURIComponent(meta.content) + window.location.search + window.location.hash);
  } catch {}
}
