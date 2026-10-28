# Seashell — leave the phone, stay reachable

Pre-launch website of the Seashell hub (TU Delft, Build Your Start-up) + the Supabase schema for its waitlist and traction events.

- `index.html`, `css/`, `js/`, `img/`: the static site (no build step). Deployed with GitHub Pages from `main`.
- `supabase/migrations/*.sql`: applied to the Supabase project by its GitHub integration on every push to `main`.
- `js/config.js` holds the Supabase project URL and the **publishable** key, which is public by design; row-level security on the tables is the protection (the browser can only INSERT).

Source of truth and the full making-of recipe: the `Making_and_Prototyping/prototypes/05-seashell-hub/` folder of Pau's project (not in this repo). The site is copied here by `website/deploy.py`.
