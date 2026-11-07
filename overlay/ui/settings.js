const { invoke } = window.__TAURI_INTERNALS__;
const $ = (id) => document.getElementById(id);
const fields = ['url', 'toggleShortcut', 'clickThroughShortcut', 'opacity'];

function showOpacity() {
  $('opacityValue').textContent = `${Math.round($('opacity').value * 100)}%`;
}

invoke('get_config').then((config) => {
  for (const field of fields) $(field).value = config[field];
  showOpacity();
});

$('opacity').addEventListener('input', showOpacity);

$('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('error').textContent = '';
  $('form').querySelector('button').disabled = true;
  const config = Object.fromEntries(fields.map((field) => [field, $(field).value]));
  config.opacity = Number(config.opacity);
  try {
    await invoke('save_config', { config }); // closes this window on success
  } catch (error) {
    $('error').textContent = String(error);
    $('form').querySelector('button').disabled = false;
  }
});
