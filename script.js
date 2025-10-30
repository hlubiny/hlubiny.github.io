document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const name = String(formData.get('name') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const message = String(formData.get('message') || '').trim();

      if (!name || !email || !message) {
        updateStatus('Please fill in all fields.');
        return;
      }

      // Demo-only handling: replace with a service (e.g., Formspree) later.
      updateStatus('Thanks! This demo form does not send emails.');
      form.reset();
    });
  }

  function updateStatus(text) {
    if (status) {
      status.textContent = text;
    }
  }
});


