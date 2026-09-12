---
title: "Eigene TLS-Zertifikate verwenden"
description: "Eigene PEM-Zertifikate an das Alfheim-Gateway übergeben — entweder aus dem mitgelieferten Verzeichnis oder von einem eigenen absoluten Host-Pfad."
---

Diese Anleitung ist für den Fall, dass du bereits Zertifikate für deine Domain
besitzt — ausgestellt von einer Unternehmens-CA, bei einer kommerziellen CA gekauft
oder von einer `certbot`-Instanz erzeugt, die Alfheim nicht verwaltet.

Der Installer bietet zwei Ablageorte an; beide erwarten dieselben zwei Dateinamen.

---

## Erforderliche Dateinamen

Unabhängig vom gewählten Ort muss das Verzeichnis genau Folgendes enthalten:

| Datei           | Inhalt                                                    |
| :-------------- | :-------------------------------------------------------- |
| `fullchain.pem` | Dein Zertifikat, gefolgt von allen Zwischenzertifikaten    |
| `privkey.pem`   | Der passende, unverschlüsselte private Schlüssel           |

Beide müssen **PEM-kodiert** sein, also mit `-----BEGIN` beginnen. Das sind genau
die Namen, die `certbot` in `/etc/letsencrypt/live/<domain>/` verwendet — ein
Let's-Encrypt-Verzeichnis lässt sich also direkt referenzieren.

Der Installer prüft all das, bevor ein Container startet, und bricht mit einer
konkreten Meldung ab, statt das Gateway zur Laufzeit scheitern zu lassen.

---

## Variante A: Das mitgelieferte Verzeichnis (Standard)

Alfheim liest aus `./data/caddy/certs/` innerhalb des Installationsverzeichnisses.
Wähle das, wenn die Zertifikate zu dieser Instanz gehören und du ein einziges
Verzeichnis sichern möchtest.

```bash
mkdir -p ~/alfheim/data/caddy/certs
cp fullchain.pem privkey.pem ~/alfheim/data/caddy/certs/
chmod 600 ~/alfheim/data/caddy/certs/privkey.pem
```

Führe den Installer aus und wähle **Custom certificates → Bundled directory**. Er
legt das Verzeichnis mit Modus `0700` an, falls es noch nicht existiert.

## Variante B: Ein eigener Host-Pfad

Wähle das, wenn die Zertifikate an anderer Stelle auf dem Host verwaltet werden —
etwa von einem System-`certbot`-Timer oder einem Konfigurationsmanagement-Werkzeug.

Der Pfad muss **absolut** sein. Ein relativer Pfad wird gegen das Arbeitsverzeichnis
des Docker-Daemons aufgelöst, nicht gegen deines, und ergäbe stillschweigend einen
leeren Mount; der Installer weist ihn deshalb direkt zurück.

Interaktiv: **Custom certificates → Custom absolute host path**. Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls custom \
  --cert-path /etc/letsencrypt/live/example.com
```

Das Verzeichnis wird schreibgeschützt nach `/etc/caddy/certs` in das Gateway
gemountet, und das gerenderte Caddyfile referenziert die Container-Pfade:

```caddyfile
https://example.com {
	tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/privkey.pem
	...
}
```

---

## Dateirechte

Der Installer warnt — scheitert aber nicht —, wenn `privkey.pem` über den Eigentümer
hinaus lesbar ist:

```
Warning: Private key /etc/.../privkey.pem is readable beyond its owner (mode 0644); consider chmod 600.
```

Es ist bewusst nur eine Warnung, weil manche Setups Schlüssel legitim über eine
Gruppe verwalten. Wenn du das nicht tust, zieh die Rechte an:

```bash
chmod 600 /etc/letsencrypt/live/example.com/privkey.pem
```

## Erneuern

Alfheim erneuert keine Zertifikate, die es nicht selbst ausgestellt hat. Nachdem
dein Erneuerungsprozess die Dateien ersetzt hat, lade das Gateway neu:

```bash
docker compose -f compose.prod.yaml restart caddy
```

Mit `certbot` lässt sich das als Deploy-Hook automatisieren:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/alfheim.sh >/dev/null <<'EOF'
#!/bin/sh
cd /home/youruser/alfheim && docker compose -f compose.prod.yaml restart caddy
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/alfheim.sh
```

> Lieber gar keine Erneuerung selbst verwalten? Nutze
> [Hetzner DNS-01](./hetzner-dns-tls.md) oder Cloudflare DNS-01 und lass Caddy
> automatisch ausstellen und erneuern.

---

## Prüfen

```bash
docker compose -f compose.prod.yaml exec caddy \
  caddy validate --config /etc/caddy/Caddyfile
```

Danach bestätigen, dass wirklich dein Zertifikat ausgeliefert wird:

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

## Fehlersuche

**`certificate chain not found at .../fullchain.pem`**
Das Verzeichnis enthält keine Datei mit exakt diesem Namen. Benenne deine Dateien um
oder richte `--cert-path` auf das Verzeichnis, das sie enthält.

**`... is not PEM encoded`**
Die Datei liegt als DER oder PKCS#12 vor. Konvertieren:

```bash
openssl x509 -inform der -in cert.der -out fullchain.pem
```

**`certificate path "certs/live" must be absolute`**
Verwende einen Pfad, der mit `/` beginnt.

**Das Gateway startet, liefert aber ein selbstsigniertes Zertifikat**
Der Bind-Mount ist leer. Prüfe, ob der Host-Pfad existiert und Docker ihn lesen kann
— ein Pfad im Home-Verzeichnis eines anderen Nutzers lässt sich oft nicht mounten.

## Siehe auch

* [Wildcard-TLS mit Hetzner DNS-01](./hetzner-dns-tls.md)
* [Installer-CLI-Referenz](../../en/reference/installer-cli.md)
* [Secrets Hardening](../../en/how-to/secrets-hardening.md)
