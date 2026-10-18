SCRATCHKE V2 — SINGLE HTML / SEPARATE SCREENS

Files in this package:
- index.html: the only HTML page
- style.css: visual design
- app.js: application logic

What changed:
- Opening Admin dashboard hides the customer home/scratch-card screen.
- Only one admin section (Overview, Registered users, Play records, Transactions, Funding records, or Record receipt) is visible at a time.
- Returning to ScratchKE or clicking the brand returns to the customer screen.
- Existing Supabase configuration and existing UI/features were preserved from the supplied source files.

IMPORTANT:
- This is a front-end packaging change, not a live deployment. Upload these three files together to your existing Netlify site only after testing.
- I have not tested live Supabase permissions, the M-Pesa sandbox worker, or database RPCs from this package.
- Keep the Supabase publishable key only; never put a service-role key in browser code.
- Demo credits are not real money.
