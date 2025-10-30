# Hlubiny – Static Website

A minimal, fast, and modern static site ready for GitHub Pages.

## What’s inside
- `index.html` – the homepage with sections: Hero, About, Projects, Contact
- `styles.css` – clean dark theme styling
- `script.js` – small enhancements (year in footer, demo contact form)

## Local preview
You can open `index.html` directly in your browser. For a better experience (and to avoid any future CORS issues when you add features), use VS Code’s Live Server extension or any simple static server.

## Publish on GitHub Pages
You can publish from the `main` branch root (simplest):

1. Commit and push your changes from VS Code
   - In VS Code Source Control: stage all, write a message like "Initial site", click Commit and then Push.
2. On GitHub, open your repository → Settings → Pages
3. Build and deployment → Source: choose `Deploy from a branch`
4. Branch: `main` and Folder: `/ (root)` → Save
5. Wait ~1–2 minutes. Your site will be live at the URL shown on that page.

Tip: If you use a custom domain, add your domain in the same Pages settings, then create the suggested DNS records with your domain provider. You can also add a `CNAME` file at the repo root with your domain name.

## Customizing
- Update text in `index.html` sections.
- Tweak colors and spacing in `styles.css`.
- Replace the contact form with a service like Formspree if you want real email delivery.

## Notes
- No build tools are required. It’s plain HTML/CSS/JS.
- Works great with GitHub Pages from the repository root.


