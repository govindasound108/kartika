#!/usr/bin/env python3
"""Da eseguire prima di ogni commit che modifica index.html.
Scrive in index.html un codice (BUILD_ID) calcolato sul contenuto del file:
cambia ogni volta che cambia qualcosa, così il tasto "aggiorna" riconosce
ogni novità anche se il numero di versione (APP_VER) resta uguale."""
import hashlib, re, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "index.html"
s = p.read_text(encoding="utf-8")
pat = re.compile(r'var BUILD_ID = "[^"]*";')
assert len(pat.findall(s)) == 1, "riga BUILD_ID non trovata o duplicata"
h = hashlib.sha1(pat.sub('var BUILD_ID = "x";', s).encode("utf-8")).hexdigest()[:10]
p.write_text(pat.sub(f'var BUILD_ID = "{h}";', s), encoding="utf-8")
print("BUILD_ID =", h)
