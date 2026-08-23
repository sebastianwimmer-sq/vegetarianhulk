# Logbuch — Kurzbefehl auf dem iPhone einrichten

Einmal einrichten, danach passiert alles von allein: Sobald ein Workout endet,
landen die Zahlen im Logbuch auf `vegetarianhulk.de/gipfelbuch/`.

> ⚠️ **Erst nach dem Deploy sinnvoll.** Der Endpunkt existiert erst, wenn der
> Worker live ist — also nach dem Cloudflare-Umzug
> (`docs/dns-umzug-cloudflare.md`) und Task 10. Vorher schlägt jeder Test fehl.

## Was du brauchst

- Das Secret. Kommt separat, nie in derselben Nachricht wie der Link.
- Zwei Minuten.

## Teil 1 — Kurzbefehl anlegen

1. App **Kurzbefehle** öffnen → Reiter **Kurzbefehle** → oben rechts **+**.

2. Aktion suchen: **Gesundheitsdaten finden** (englisch: *Find Health Samples*).
   Einstellen:
   - **Art / Type:** Trainings beziehungsweise Workouts
   - **Sortieren nach:** Enddatum, absteigend
   - **Limit:** 1

3. Aktion **Inhalte von URL abrufen** (englisch: *Get Contents of URL*) hinzufügen.
   - **URL:** `https://vegetarianhulk.de/gipfelbuch/api/logbook/activity`
   - **Methode:** POST
   - **Header:** Schlüssel `X-VH-Log-Secret`, Wert = dein Secret
   - **Anfragetext / Request Body:** **JSON**

4. Im JSON-Bereich diese Felder anlegen. Als Wert jeweils die Variable des
   gefundenen Trainings antippen und die passende Eigenschaft wählen:

   | Schlüssel | Typ | Wert aus dem Training | Pflicht |
   |---|---|---|---|
   | `workout` | Text | Trainingsart | **ja** |
   | `started_at` | Text | Startdatum | **ja** |
   | `duration_s` | Zahl | Dauer in Sekunden | **ja** |
   | `distance_m` | Zahl | Distanz in Metern | nein |
   | `elevation_m` | Zahl | Höhenmeter aufwärts | nein |
   | `kcal` | Zahl | Aktive Energie | nein |
   | `avg_hr` | Zahl | Ø Herzfrequenz | nein |

5. Kurzbefehl **Logbuch senden** nennen und sichern.

### Wenn ein Feld nicht auswählbar ist

Kein Drama — leer lassen. Nur `workout`, `started_at` und `duration_s` sind
Pflicht. Am ehesten fehlt **Höhenmeter**: nicht jede Trainingsart zeichnet sie
auf, und Kurzbefehle geben sie nicht überall heraus. Dann zeigt das Band bei
dieser Einheit eben Distanz und Dauer. Bei Bergtouren ist die Zahl in der Regel
da, und genau dort zählt sie.

### Wenn die Bezeichnungen leicht abweichen

Apple benennt Felder je nach iOS-Version um. Nimm die nächstliegende
Bezeichnung — die Zuordnung passiert ohnehin serverseitig, und eine unbekannte
Trainingsart landet als „Training" statt verloren zu gehen. Wenn du nicht
weiterkommst, schick mir einen Screenshot des Kurzbefehls.

## Teil 2 — Automation anlegen

1. Reiter **Automation** → **+** → **Training** beziehungsweise **Workout** wählen.
2. **Wenn:** Beliebiges Training · **Endet**.
3. **Sofort ausführen** einschalten, **Vor dem Ausführen fragen** ausschalten.
   Ohne das kommt bei jedem Workout eine Rückfrage, und du bestätigst sie nie.
4. Als Aktion den Kurzbefehl **Logbuch senden** wählen. Fertig.

## Teil 3 — Prüfen

Kurzbefehl einmal von Hand ausführen (Play-Knopf), dann
`https://vegetarianhulk.de/gipfelbuch/` öffnen. Die letzte Einheit muss oben
stehen.

## Wenn nichts ankommt

| Symptom | Ursache |
|---|---|
| Gar nichts passiert nach dem Training | In der Automation ist „Vor dem Ausführen fragen" noch an |
| **401** | Secret im Header stimmt nicht. Groß- und Kleinschreibung beachten, keine Leerzeichen am Rand |
| **422** | Ein Pflichtfeld ist leer: `workout`, `started_at` oder `duration_s` |
| **400** | Der Anfragetext steht nicht auf JSON |
| **503** | Schreibzugriffe sind abgeschaltet oder das Secret fehlt serverseitig |
| Doppelte Einträge | Kann nicht passieren. Gleiche Sportart plus gleiche Startzeit wird erkannt und nicht zweimal gespeichert — auch wenn der Kurzbefehl bei schlechtem Netz mehrfach sendet |

## Was gespeichert wird

Sportart, Startzeit, Dauer und die optionalen Messwerte oben. **Keine
GPS-Route, keine Streckendaten, keine IP-Adresse.** Was nicht in der Tabelle
steht, verlässt dein iPhone nicht.
