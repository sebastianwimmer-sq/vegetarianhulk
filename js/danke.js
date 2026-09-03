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
