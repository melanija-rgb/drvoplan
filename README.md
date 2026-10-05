# DRVOPLAN

Početna stranica za model DP A-frame 45. Upiti sa forme idu na Netlify Function i čuvaju se u Netlify Blobs.

## Admin i upiti

Admin stranica je na `/admin` (https://drvoplan.netlify.app/admin). Lozinka nije u kodu.

Produkcija već ima ove varijable, u svim kontekstima:

- `ADMIN_PASSWORD` — lozinka za prijavu
- `ADMIN_SESSION_SECRET` — tajna kojom se potpisuje sesija (HttpOnly kolačić, oko 7 dana)

Ako lozinku treba promijeniti:

```bash
npx netlify-cli env:set ADMIN_PASSWORD "nova-jaka-lozinka"
```

Sesiju rotirajte posebno, da stari kolačići prestanu važiti:

```bash
npx netlify-cli env:set ADMIN_SESSION_SECRET "dugacak-nasumican-niz"
```

Ako `ADMIN_SESSION_SECRET` nije postavljen, sesija se potpisuje vrijednošću `ADMIN_PASSWORD`.

Objavu i dalje radi CLI, ne Git integracija:

```bash
npm run build
npx netlify-cli deploy --prod
```

`netlify.toml` već uključuje `netlify/functions`. Lokalno:

```bash
npx netlify-cli dev
```

Lokalni `.env` nije u repou. Ne upisujte lozinku u kod.
