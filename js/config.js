/* Seashell website: runtime configuration. Edit this file only.
   Nothing here is secret: the Supabase publishable ("anon") key is designed to live in public
   pages; the database rules (db/supabase-schema.sql: anonymous visitors may INSERT, nothing else)
   protect the data. Still, this folder syncs to OneDrive, so the key is NOT typed in here:
   website/deploy.py writes url + key into the deployed copy from the secrets .env
   (SUPABASE_URL, SUPABASE_ANON_KEY). Locally the site runs in "local" mode. */
window.SEASHELL_CONFIG = {
  // "auto": inside a claude.ai artifact use its db (private preview), else Supabase when url+key
  // are set, else localStorage. Or force one: "supabase" | "artifact" | "local".
  adapter: "auto",

  supabase: {
    url: "https://hyylgliqpzvaykttkkko.supabase.co",            // filled at deploy: https://<project>.supabase.co
    anonKey: "sb_publishable_CXtrSxJXfjEnD127JcLbIg_JqtLXXes"         // filled at deploy: the publishable key (sb_publishable_...) or legacy anon JWT
  },

  // Tag stored with every row, so campaigns can be told apart ("site-v2", "pitch-qr").
  source: "site-v2",

  // The price shown on the page; stored with every buy_click so H66 ("they buy at 199") can be read.
  price: 199,
  currency: "EUR"
};
