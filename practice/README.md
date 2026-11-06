# Baseline: the practice

Everything for the optimisation business, kept apart from the personal dashboard.

| File | What it is |
|---|---|
| [`BUSINESS_PLAN.md`](BUSINESS_PLAN.md) | Positioning, **pricing suggestions**, **bloodwork panel**, the **dashboard parameter list** by tier, how to turn the personal dashboard into a client product, a launch checklist and regulatory notes |
| [`site/index.html`](site/index.html) | The website: carbon, cream and black, geometric |
| [`site/dashboard.html`](site/dashboard.html) | Client dashboard prototype with demo data. **Configure** (top right) switches modules on and off, applies presets and sets per-client targets |

## Preview

No build step. Open `site/index.html` in a browser, or serve the folder:

```bash
cd practice/site && python3 -m http.server 8080
# http://localhost:8080
```

## Changing things

- **Name:** "Baseline" is a working name. Search and replace it in `site/`.
- **Prices:** in the Pricing and Assessment sections of `site/index.html`.
- **Dashboard modules:** each card is an entry in `MODULES` in `site/dashboard.js`. Presets
  are in `PRESETS` and default targets in `DEFAULT_TARGETS`. The prototype saves each
  client's choices in the browser. The real product would store them on the server and let
  only the doctor change them.
- **Placeholders to fill in:** practice and HPCSA numbers in the footer, the booking link
  (`mailto:hello@example.com`), and the privacy page.
