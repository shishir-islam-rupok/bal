# file shift

Private browser-based tools for everyday file work. Image conversion runs locally in the browser, so selected images are not uploaded.

## Development

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm run lint
npm run build
```

## AdSense deployment checklist

Before deploying, replace these placeholders:

1. In `public/ads.txt`, add the exact publisher record from Google AdSense:
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
2. In `public/robots.txt`, replace `https://YOUR-DOMAIN.example/sitemap.xml` with the live sitemap URL.
3. In `public/sitemap.xml`, replace `https://YOUR-DOMAIN.example/` with the canonical production URL.
4. Add the AdSense script and ad slots only after receiving a publisher ID. Keep advertisements clearly separated from upload and download controls.
5. Publish accurate Privacy, Terms, and Contact pages before requesting review. AdSense approval is determined by Google and cannot be guaranteed by code alone.

Do not deploy the placeholder values as if they were production configuration.
