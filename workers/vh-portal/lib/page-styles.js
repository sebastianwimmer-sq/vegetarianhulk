// Gestaltung des Logbuch-Bandes.
//
// Erbt v3 vollstaendig: --bg-deep, --paper, --gold, --royal, --leaf, --mono,
// --grain, --ease-lux und .hsep kommen aus /v3.css. Hier stehen nur die
// seitenlokalen .gb-Klassen. Bewusst KEINE eigenen Farben oder Schriften —
// jede Abweichung waere ein Fremdkoerper.
//
// Hierarchie statt Kachelraster: die Jahres-Hoehenmeter sind die eine grosse
// Zahl, alles andere ordnet sich darunter. Zeilen sind ein Register, keine
// Karten.

export const PAGE_STYLES = `
.gb-wrap{
  max-width:min(1080px,92vw);
  margin:0 auto;
  padding:clamp(56px,11vh,120px) 0 clamp(48px,9vh,96px);
}

.gb-kicker{
  display:flex; align-items:center; gap:10px;
  font-family:var(--mono); font-size:var(--t-label); font-weight:700;
  letter-spacing:2.4px; text-transform:uppercase; color:var(--gold);
  margin:0 0 18px;
}
.gb-dot{
  width:7px; height:7px; border-radius:50%; background:var(--leaf);
  box-shadow:0 0 0 4px rgba(126,208,155,.14);
  animation:gb-breathe 3.4s var(--ease-lux) infinite;
}
@keyframes gb-breathe{
  0%,100%{opacity:.55; transform:scale(.86)}
  50%    {opacity:1;   transform:scale(1)}
}

.gb-title{
  font-family:'Playfair Display',serif; font-weight:600;
  font-size:clamp(38px,7.2vw,72px); line-height:.98; letter-spacing:-.015em;
  margin:0 0 20px; text-wrap:balance;
}
.gb-lead{
  max-width:56ch; margin:0 0 clamp(40px,7vh,72px);
  color:var(--paper-dim); font-size:clamp(16px,2vw,18px); line-height:1.6;
}

/* ---- Die eine grosse Zahl ---- */
/* Keine eigene Unterkante: die Oberkante der ersten Registerzeile ist die
   Trennlinie. Zwei Haarlinien mit Luft dazwischen lesen sich als Versehen. */
.gb-hero{
  display:flex; flex-wrap:wrap; align-items:flex-end; gap:clamp(20px,5vw,56px);
}
.gb-hero__main{flex:0 0 auto}
.gb-hero__label{
  display:block; font-family:var(--mono); font-size:var(--t-label); font-weight:700;
  letter-spacing:2px; text-transform:uppercase; color:var(--paper-faint);
  margin:0 0 6px;
}
.gb-hero__value{
  display:block; font-family:'Playfair Display',serif; font-weight:600;
  font-size:clamp(64px,15vw,148px); line-height:.82; letter-spacing:-.03em;
  font-variant-numeric:tabular-nums; color:var(--paper);
}
.gb-hero__unit{
  font-family:var(--mono); font-size:clamp(13px,1.6vw,16px); font-weight:700;
  letter-spacing:2px; color:var(--gold); margin-left:.5em; vertical-align:.9em;
}

.gb-side{
  display:flex; flex-wrap:wrap; gap:clamp(18px,4vw,44px);
  padding-bottom:6px;
}
.gb-side__item{min-width:78px}
.gb-side__label{
  display:block; font-family:var(--mono); font-size:10px; font-weight:700;
  letter-spacing:1.8px; text-transform:uppercase; color:var(--paper-faint);
  margin:0 0 4px;
}
.gb-side__value{
  display:block; font-family:var(--mono); font-size:clamp(20px,3vw,28px);
  font-weight:700; line-height:1; font-variant-numeric:tabular-nums;
  color:var(--paper);
}
.gb-side__value small{
  font-size:.5em; font-weight:600; letter-spacing:1.4px;
  color:var(--paper-faint); margin-left:.35em;
}

/* ---- Register ---- */
.gb-rows{list-style:none; margin:clamp(30px,5vh,48px) 0 0; padding:0}
.gb-row{
  display:grid; grid-template-columns:74px 1fr auto; align-items:baseline;
  gap:16px; padding:15px 12px 15px 4px;
  border-bottom:1px solid rgba(243,235,217,.09);
  transition:background .32s var(--ease-lux), border-color .32s var(--ease-lux);
}
.gb-row:first-child{border-top:1px solid rgba(186,155,95,.28)}
.gb-row:hover{
  background:rgba(243,235,217,.035);
  border-bottom-color:rgba(186,155,95,.42);
}
.gb-row__date{
  font-family:var(--mono); font-size:12px; font-weight:700; letter-spacing:.6px;
  color:var(--paper-faint); font-variant-numeric:tabular-nums; white-space:nowrap;
}
.gb-row__kind{
  font-size:16px; font-weight:500; color:var(--paper);
}
.gb-row__facts{
  display:flex; align-items:baseline; justify-content:flex-end; flex-wrap:wrap;
  font-family:var(--mono); font-size:12.5px; font-weight:700;
  letter-spacing:.4px; font-variant-numeric:tabular-nums; color:var(--meta-green);
}
.gb-row__facts .hsep{opacity:.34}

.gb-foot{
  margin:clamp(28px,5vh,44px) 0 0;
  font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:1.4px;
  text-transform:uppercase; color:var(--paper-faint);
}

/* ---- Leerzustand: handschriftlich, keine graue Box ---- */
/* Breite an den Text gebunden: eine volle Kastenbreite mit einem Drittel
   Inhalt liest sich als Platzhalter, nicht als eingelegte Notiz. */
.gb-empty{
  display:inline-block; max-width:100%;
  margin:clamp(34px,6vh,56px) 0 0; padding:clamp(26px,5vw,44px) clamp(22px,4vw,40px);
  border:1px dashed rgba(186,155,95,.34); border-radius:2px;
  background:rgba(243,235,217,.028);
}
.gb-empty p{
  font-family:'Caveat',cursive; font-size:clamp(22px,3.4vw,30px); line-height:1.35;
  color:var(--leaf); margin:0; max-width:34ch;
}
.gb-empty span{
  display:block; margin-top:14px; font-family:var(--mono); font-size:11px;
  font-weight:600; letter-spacing:1.4px; text-transform:uppercase;
  color:var(--paper-faint);
}

@media (max-width:560px){
  .gb-row{grid-template-columns:60px 1fr; row-gap:6px}
  .gb-row__facts{grid-column:1 / -1; justify-content:flex-start}
}

@media (prefers-reduced-motion: reduce){
  .gb-dot{animation:none}
  .gb-row{transition:none}
}
`;
