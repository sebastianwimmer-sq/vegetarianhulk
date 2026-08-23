# DNS-Umzug zu Cloudflare — Anleitung und Sicherung

Stand der Aufnahme: 23.08.2026, ausgelesen mit `dig` gegen die produktive Zone.

## ⚠️ Das größte Risiko ist nicht die Website, sondern die E-Mail

Auf `vegetarianhulk.de` liegt ein echtes Postfach bei united-domains
(`mx00.udag.de` / `mx01.udag.de`, dazu `autoconfig` und `autodiscover`).
Fehlt nach dem Umzug ein MX-Eintrag, hört Mail an `@vegetarianhulk.de`
**stillschweigend** auf zu funktionieren — es kommt keine Fehlermeldung, die
Nachrichten laufen einfach ins Leere.

Deshalb gilt: erst alle Records bei Cloudflare anlegen, dann die Nameserver
umstellen. Nie umgekehrt.

## Aufgenommene Records (Soll-Zustand nach dem Umzug)

| Typ | Name | Wert | Proxy |
|---|---|---|---|
| A | `@` | `185.199.108.153` | zunächst aus |
| A | `@` | `185.199.109.153` | zunächst aus |
| A | `@` | `185.199.110.153` | zunächst aus |
| A | `@` | `185.199.111.153` | zunächst aus |
| CNAME | `www` | `sebastianwimmer-sq.github.io` | zunächst aus |
| MX | `@` | `10 mx00.udag.de` | — |
| MX | `@` | `20 mx01.udag.de` | — |
| TXT | `@` | `v=spf1 include:_smtp.udag.de ~all` | — |
| TXT | `@` | `brevo-code:c8c774c16dc73361f76297cb33c7ca37` | — |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | — |
| A | `autoconfig` | `89.31.143.90` | **immer aus** |
| A | `autodiscover` | `89.31.143.90` | **immer aus** |

> Diese Liste stammt aus DNS-Abfragen und findet nur, wonach gefragt wurde.
> **Maßgeblich ist die Record-Liste in der united-domains-Oberfläche** — dort
> stehen auch Einträge, die von außen nicht auffindbar sind, etwa DKIM-Selektoren
> von Brevo. Vor dem Umzug abtippen oder abfotografieren.

## Vorgehen

### Schritt 1 — Zone bei Cloudflare anlegen
Bei Cloudflare einloggen, **Add a domain**, `vegetarianhulk.de` eintragen,
**Free** wählen. Cloudflare scannt die bestehenden Records und schlägt sie vor.

### Schritt 2 — Records prüfen, nicht vertrauen
Die vorgeschlagene Liste gegen die Tabelle oben **und** gegen die
united-domains-Oberfläche abgleichen. Fehlendes ergänzen, besonders MX, SPF,
DMARC, DKIM. Alle Wolken-Symbole auf **grau (DNS only)** stellen.

### Schritt 3 — Nameserver umstellen
Cloudflare nennt zwei Nameserver (Form `xyz.ns.cloudflare.com`). Bei
united-domains unter **Domain → Nameserver** die drei `ns.udag.*` durch diese
zwei ersetzen und speichern.

### Schritt 4 — Warten und prüfen
Die Umstellung braucht bis zu 24 Stunden. Solange beide Seiten identische
Records haben, ist jede Antwort korrekt und nichts geht kaputt.

```bash
dig +short NS vegetarianhulk.de          # soll auf cloudflare.com zeigen
dig +short MX vegetarianhulk.de          # mx00/mx01.udag.de muss stehen
curl -sI https://vegetarianhulk.de | head -3
```

### Schritt 5 — E-Mail von Hand testen
Von einer fremden Adresse eine Mail an `@vegetarianhulk.de` schicken und
prüfen, ob sie ankommt. **Erst wenn das klappt, ist der Umzug durch.**

### Schritt 6 — später, erst beim Bau des Portals
Apex und `www` auf **orange (proxied)** stellen, SSL/TLS auf **Full**, dann die
Worker-Route eintragen. `autoconfig` und `autodiscover` bleiben dauerhaft grau —
Mail-Clients vertragen keinen Proxy.

Dieser Schritt wird bewusst getrennt gemacht, damit sich ein Problem eindeutig
zuordnen lässt: Schritt 1 bis 5 ändern nichts am Verhalten der Seite, Schritt 6
schon.

## Was sich dadurch nebenbei öffnet

Mit proxiertem Apex sind auf der GitHub-Pages-Seite erstmals echte
Security-Header möglich (CSP, HSTS, X-Frame-Options per Transform Rule) — der
offene Punkt aus dem Website-Launch-Check.

## Rollback

Nameserver bei united-domains auf `ns.udag.de`, `ns.udag.net`, `ns.udag.org`
zurückstellen. Die alte Zone liegt dort weiter und greift nach der Propagierung
wieder. Deshalb bei united-domains **nichts löschen**, bevor der Umzug
mindestens eine Woche stabil läuft.
