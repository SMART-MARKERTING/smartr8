# Google Places Autocomplete Setup

Address autocomplete on the HELOC, Cash-Out, Rate Reduction, and Purchase funnels is powered by the Google Maps Places API. Follow these steps to enable it.

## 1. Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Sign in with a Google account that has billing access
3. Click the project dropdown at the top, then "New Project"
4. Name it "Smartr8 Forms" and click Create (takes 15-30 seconds)
5. Make sure the new project is selected in the top dropdown

## 2. Enable Required APIs

6. In the left sidebar, click "APIs and Services" then "Library"
7. Search "Places API", click it, click ENABLE
8. Go back to Library
9. Search "Maps JavaScript API", click it, click ENABLE

## 3. Create an API Key

10. In the left sidebar: APIs and Services > Credentials
11. Click "+ CREATE CREDENTIALS" at the top, then "API key"
12. A popup shows your API key. Copy it.
13. Click "Edit API key" (pencil icon) on the new key

## 4. Restrict the Key

14. Under "Application restrictions", select "HTTP referrers (websites)"
15. Click "ADD AN ITEM" and add each of these:
    - `https://smartr8.com/*`
    - `https://www.smartr8.com/*`
    - `https://*.pages.dev/*`
    - `http://localhost:*`
16. Under "API restrictions", select "Restrict key"
17. Check: Places API AND Maps JavaScript API
18. Click Save

## 5. Add Billing

19. In Google Cloud Console, go to "Billing"
20. Add a payment method
21. Google provides $200/month free credit, which covers approximately 10,000 address lookups per month. You will not be charged unless you exceed that limit.

## 6. Add the Key to Replit

22. Open the Secrets tab in your Replit project
23. Key: `VITE_GOOGLE_PLACES_API_KEY`
24. Value: paste your API key
25. Save

> Note: The Vite prefix `VITE_` is required for the key to be accessible in the browser bundle. The key name in the spec references `GOOGLE_PLACES_API_KEY`, but in this Vite project it must be `VITE_GOOGLE_PLACES_API_KEY`.

## 7. Verify

After adding the secret and restarting the dev server, visit any funnel page (/heloc, /apply/cash-out, etc.) and start typing an address in Step 2. You should see autocomplete suggestions appear.

If the API key is missing or invalid, the address field falls back to a standard text input with a note for the user.
