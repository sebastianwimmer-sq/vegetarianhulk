/* Ausgelagert aus danke.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt. */
// Footer-Jahr dynamisch
  (function () {
    var el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  })();

  // Pillar-Personalisierung anhand ?tag=
  var params = new URLSearchParams(location.search);
  var tag = params.get('tag');

  var TAG_CONTENT = {
    discipline: {
      eyebrow: 'Pillar — Disziplin',
      headline: 'Du willst die Architektur, die dich trägt.',
      body: 'Disziplin ist kein Talent. Sie ist ein Ritual. Ich schick dir die nächsten Wochen das was bei mir wirklich funktioniert — Morgen-Routine, Streak-Recovery, Comeback-Patterns. Keine Coach-Bro-Sprüche.',
    },
    vegetarian: {
      eyebrow: 'Pillar — Vegetarisch + Stark',
      headline: 'Du willst den Live-Beweis sehen.',
      body: '10 Jahre vegetarisch, 9 Jahre im Gym. Ich teile was wirklich auf dem Teller landet — Macros, einfache Routinen, was 2016 angefangen hat und heute noch trägt. Plant-based + Kraft = kein Widerspruch.',
    },
    faith: {
      eyebrow: 'Pillar — Faith',
      headline: 'Du willst den tieferen Anker.',
      body: 'Faith trifft Disziplin. Bibel-Verse die mich tragen, Sunday-Reset-Routinen, Anker-Praxis. Schlachter 2000. Nicht performativ — gelebt. Du musst nicht christ sein um mitzulesen.',
    },
  };

  if (tag && TAG_CONTENT[tag]) {
    var c = TAG_CONTENT[tag];
    document.getElementById('tag-eyebrow').textContent = c.eyebrow;
    document.getElementById('tag-headline').textContent = c.headline;
    document.getElementById('tag-body').textContent = c.body;
    document.getElementById('tag-detail').style.display = 'block';
    document.getElementById('thanks-title').textContent = 'Notiert.';
    document.getElementById('thanks-sub').textContent = 'Ich passe meine Mails an das an, was dich gerade trägt.';
  }

  /* ── Double-Opt-In: der Klick in der Bestätigungsmail landet hier ──
     Der Worker haengt ?bestaetigung=ok|abgelaufen|fehler an. Vorher gab es
     dafuer keinen Empfaenger: der Link fuehrte auf die Startseite und der
     Mensch sah nirgends, ob sein Klick gewirkt hat.
     Laeuft NACH der Pillar-Logik, weil die Bestaetigung der konkretere
     Moment ist und deren Ueberschrift ueberschreiben darf. */
  var ZUSTAENDE = {
    ok: {
      kicker: '— Bestätigt —',
      titel: 'Du bist dabei.',
      sub: 'Deine Adresse ist bestätigt. Der Berg-Starter ist unterwegs in deine Inbox.',
      klasse: 'ty-status--ok',
      status: '<b>Alles erledigt.</b> <span>Du musst nichts weiter tun. Wenn in ein paar Minuten nichts da ist: einmal im Spam nachsehen.</span>',
      seitentitel: 'Bestätigt · VegetarianHulk'
    },
    'ok-ohne-starter': {
      kicker: '— Bestätigt —',
      titel: 'Du bist dabei.',
      sub: 'Deine Adresse ist bestätigt und eingetragen. Beim Versand des Berg-Starters hat es allerdings gehakt.',
      klasse: 'ty-status--tun',
      status: '<b>Der Starter kommt von Hand.</b> <span>Du bist auf der Liste, daran ändert sich nichts. Wenn er in einer Stunde nicht da ist, schreib mir kurz — dann schicke ich ihn direkt.</span>',
      cta: { text: '→ Starter anfordern', href: 'mailto:info@vegetarianhulk.de?subject=Berg-Starter%20bitte' },
      seitentitel: 'Bestätigt · VegetarianHulk'
    },
    abgelaufen: {
      kicker: '— Link abgelaufen —',
      titel: 'Der Link war zu alt.',
      sub: 'Bestätigungslinks gelten sieben Tage. Trag dich einfach nochmal ein, dann kommt sofort ein frischer.',
      klasse: 'ty-status--tun',
      status: '<b>Noch ein Schritt.</b> <span>Deine Adresse wurde nicht gespeichert — der Link muss neu angefordert werden.</span>',
      cta: { text: '→ Nochmal eintragen', href: '/newsletter/' },
      seitentitel: 'Link abgelaufen · VegetarianHulk'
    },
    fehler: {
      kicker: '— Hat nicht geklappt —',
      titel: 'Da ging etwas schief.',
      sub: 'Dein Klick kam an, aber die Eintragung hat nicht funktioniert. Das lag an mir, nicht an dir.',
      klasse: 'ty-status--tun',
      status: '<b>Bitte einmal melden.</b> <span>Schreib kurz an info@vegetarianhulk.de — dann trage ich dich von Hand ein und der Starter geht sofort raus.</span>',
      cta: { text: '→ Kurz Bescheid geben', href: 'mailto:info@vegetarianhulk.de?subject=Best%C3%A4tigung%20hat%20nicht%20geklappt' },
      seitentitel: 'Bestätigung fehlgeschlagen · VegetarianHulk'
    }
  };

  var z = ZUSTAENDE[params.get('bestaetigung')];
  if (z) {
    document.getElementById('thanks-kicker').textContent = z.kicker;
    document.getElementById('thanks-title').textContent = z.titel;
    document.getElementById('thanks-sub').textContent = z.sub;
    document.title = z.seitentitel;

    var box = document.getElementById('thanks-status');
    /* Feste Vorlagen aus dieser Datei, kein Fremdtext — der Parameter waehlt
       nur aus, er wird nie selbst eingesetzt. Der Text kommt in EIN Kind,
       damit Flex daraus keine zweite Spalte macht. */
    document.getElementById('thanks-status-text').innerHTML = z.status;
    box.classList.add(z.klasse);
    box.hidden = false;

    if (z.cta) {
      var knopf = document.getElementById('thanks-primary');
      knopf.textContent = z.cta.text;
      knopf.href = z.cta.href;
      knopf.removeAttribute('target');
      knopf.removeAttribute('rel');
    }
  }
