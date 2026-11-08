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

// Shortcut fields record the keys pressed instead of taking typed text. KeyboardEvent.code
// names the physical key the way the global-shortcut parser expects ("Backslash", "KeyM").
const MODIFIERS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'];

function shortcutFrom(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');
  parts.push(event.code.replace(/^(Key|Digit)/, ''));
  return parts.join('+');
}

for (const input of document.querySelectorAll('.shortcut')) {
  let saved = '';
  input.addEventListener('focus', () => {
    saved = input.value;
    input.value = '';
    input.placeholder = 'Press the keys…';
  });
  input.addEventListener('blur', () => {
    if (!input.value) input.value = saved;
    input.placeholder = '';
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' || MODIFIERS.includes(event.key)) return;
    event.preventDefault();
    if (event.key !== 'Escape') input.value = shortcutFrom(event);
    input.blur();
  });
}

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
