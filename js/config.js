/* Seashell site v1: runtime configuration. Edit this file only.
   Same Supabase project and tables as the live v3.1 site (website/js/config.js, SUPABASE-PROJECT.md):
   tables `waitlist` and `events`, anonymous visitors may INSERT, nothing else.
   The publishable ("anon") key is public by design, but this folder syncs to OneDrive, so it is NOT
   typed in here: site-v1/deploy_v1.py copies it from the live site's deployed js/config.js into the
   deployed (or --stage) copy. Here the key stays empty, so the local copy runs in "local" mode
   (sign-ups stay in the browser), which is also what the offline laptop copy (open-site.bat) does. */
window.SEASHELL_CONFIG = {
  // "auto": inside a claude.ai artifact use its db (private preview), else Supabase when url+key
  // are set, else localStorage. Or force one: "supabase" | "artifact" | "local".
  adapter: "auto",

  supabase: {
    url: "https://hyylgliqpzvaykttkkko.supabase.co",   // the Seashell project (eu-west-1)
    anonKey: "sb_publishable_CXtrSxJXfjEnD127JcLbIg_JqtLXXes"         // filled by deploy_v1.py from the live config.js (sb_publishable_...)
  },

  // Tag stored with every row, so the site versions can be told apart (v3.1 wrote "site-v2").
  source: "site-shell-v1",

  // The price shown on the page; stored with every buy_click so H66 ("they buy at 199") can be read.
  price: 199,
  currency: "EUR"
};
