/*!
 * sid-sync.js — synchronise la progression d'une simulation entre appareils.
 *
 * À charger dans le site d'une simulation (Potions, Techniques,
 * 3D-game-world), une seule ligne dans le <head> :
 *
 *   <script src="https://sid-quest.vercel.app/sid-sync.js" async></script>
 *
 * (async : le site ne l'attend jamais, même si le S.I.D. est injoignable.)
 *
 * Le script ne fait rien quand le site est ouvert hors du S.I.D. Quand il est
 * ouvert depuis le S.I.D. (paramètre sid_run dans l'adresse) :
 *   1. il récupère la progression enregistrée sur le compte du membre et la
 *      fusionne avec celle de l'appareil (localStorage) ;
 *   2. il renvoie au S.I.D. chaque modification des clés suivies, quelques
 *      secondes après, et au plus tard quand on quitte la page.
 *
 * Seules les clés de progression sont suivies (niveaux, délais entre
 * tentatives, histoires terminées, sauvegardes). Les réglages propres à
 * l'appareil (qualité graphique…) et les tentatives en cours ne le sont pas.
 *
 * Aucune donnée ne part ailleurs que vers le S.I.D. qui sert ce fichier, et
 * aucun point ne se gagne par cette voie : seuls les résultats comptent.
 */
(function () {
  "use strict";

  var NS = "sidsync:";
  var DEBOUNCE_MS = 1500;
  var RELOAD_WINDOW_MS = 5000;
  var loadedAt = Date.now();

  // Clés suivies, par simulation.
  var RULES = {
    // Potions : sq_<empreinte de l'e-mail>_prog_<épreuve>, sq_<…>_cd_…
    intelligence: function (k) { return /^sq_[^_]+_(prog|cd)_/.test(k) || /^sq_[^_]+_cd_global$/.test(k); },
    // Techniques
    techniques: function (k) { return k === "sqt_prog" || k === "sqt_cd"; },
    // 3D-game-world : histoires terminées, fins, sauvegardes
    donjons: function (k) { return k === "mv-done" || /^mv-(end|s)\d+$/.test(k); },
  };

  var ls;
  var ss;
  try { ls = window.localStorage; ls.getItem(NS); } catch (e) { return; }
  try { ss = window.sessionStorage; } catch (e) { ss = null; }

  function ssGet(k) { try { return ss ? ss.getItem(NS + k) : null; } catch (e) { return null; } }
  function ssSet(k, v) { try { if (ss) ss.setItem(NS + k, v); } catch (e) {} }

  // --- Jeton de partie --------------------------------------------------------
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  var urlToken = params.get("sid_run");
  var token = urlToken && /^[0-9a-f]{64}$/.test(urlToken) ? urlToken : null;
  // Les sites retirent les paramètres de l'adresse en changeant de page :
  // on garde le jeton pour la durée de l'onglet.
  if (token) ssSet("token", token);
  else token = ssGet("token");
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;

  // Toujours le S.I.D. qui sert ce fichier (jamais une adresse venue de l'URL).
  var script = document.currentScript;
  var origin;
  try { origin = new URL(script && script.src ? script.src : "https://sid-quest.vercel.app/").origin; } catch (e) { return; }
  var API = origin + "/api/simulations/progress";

  var rawSet = Storage.prototype.setItem;
  var rawRemove = Storage.prototype.removeItem;
  var rawGet = Storage.prototype.getItem;

  function lsGet(k) { try { return rawGet.call(ls, k); } catch (e) { return null; } }
  function lsSet(k, v) { try { rawSet.call(ls, k, v); } catch (e) {} }
  function lsDel(k) { try { rawRemove.call(ls, k); } catch (e) {} }

  var kind = null;      // connu après la première réponse du S.I.D.
  var tracked = null;   // fonction clé → suivie ?
  var ready = false;    // fusion initiale terminée
  var pending = {};     // clé → valeur (null = supprimée) à envoyer
  var early = {};       // clés modifiées par le site avant la fusion initiale
  var timer = null;

  function baseKey() { return NS + kind + ":base"; }
  function ownerKey() { return NS + kind + ":owner"; }
  function readBase() { try { return JSON.parse(lsGet(baseKey()) || "{}") || {}; } catch (e) { return {}; } }
  function writeBase(b) { lsSet(baseKey(), JSON.stringify(b)); }

  function localTrackedKeys() {
    var out = [];
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (k && tracked(k)) out.push(k);
    }
    return out;
  }

  // --- Fusion quand l'appareil et le compte ont tous deux changé -------------
  function parse(v) { try { return JSON.parse(v); } catch (e) { return undefined; } }

  function resolve(local, remote) {
    if (local == null) return remote;
    if (remote == null) return local;
    var a = parse(local), b = parse(remote);
    // Nombres (niveau atteint, fin d'un délai) : le plus grand.
    if (typeof a === "number" && typeof b === "number") return a >= b ? local : remote;
    // Listes (histoires terminées) : l'union.
    if (Array.isArray(a) && Array.isArray(b)) {
      var u = a.slice();
      for (var i = 0; i < b.length; i++) if (u.indexOf(b[i]) === -1) u.push(b[i]);
      return JSON.stringify(u);
    }
    // Sauvegardes : la plus avancée.
    if (a && b && typeof a === "object" && typeof b === "object") {
      var pa = +(a.playTime || 0), pb = +(b.playTime || 0);
      if (pa !== pb) return pa > pb ? local : remote;
      var ca = +(a.chapter || 0), cb = +(b.chapter || 0);
      if (ca !== cb) return ca > cb ? local : remote;
    }
    return local;
  }

  // --- Envoi des modifications ------------------------------------------------
  function body() {
    var set = {}, remove = [], n = 0;
    for (var k in pending) {
      if (!Object.prototype.hasOwnProperty.call(pending, k)) continue;
      if (pending[k] === null) remove.push(k); else set[k] = pending[k];
      n++;
    }
    return n ? { token: token, set: set, remove: remove } : null;
  }

  function flush(beacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!ready) return;
    var b = body();
    if (!b) return;
    var sent = pending;
    pending = {};
    var text = JSON.stringify(b);

    if (beacon && navigator.sendBeacon) {
      // Pas de réponse lisible : la base n'est pas mise à jour, la clé sera
      // revérifiée (et renvoyée si besoin) au prochain chargement.
      try { if (navigator.sendBeacon(API, new Blob([text], { type: "text/plain" }))) return; } catch (e) {}
    }

    fetch(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: text, keepalive: text.length < 60000 })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.ok) throw new Error("refus");
        var base = readBase();
        for (var k in sent) {
          if (!Object.prototype.hasOwnProperty.call(sent, k)) continue;
          if (sent[k] === null) delete base[k]; else base[k] = sent[k];
        }
        writeBase(base);
      })
      .catch(function () {
        // Réessai au prochain envoi ; les modifications plus récentes priment.
        for (var k in sent) {
          if (Object.prototype.hasOwnProperty.call(sent, k) && !Object.prototype.hasOwnProperty.call(pending, k)) pending[k] = sent[k];
        }
      });
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { flush(false); }, DEBOUNCE_MS);
  }

  function noteChange(k, v) {
    if (!ready) { early[k] = true; return; }
    if (!tracked(k)) return;
    pending[k] = v;
    schedule();
  }

  // Le site écrit dans localStorage comme d'habitude : on observe.
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === ls) noteChange(String(k), String(v));
  };
  Storage.prototype.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === ls) noteChange(String(k), null);
  };

  window.addEventListener("pagehide", function () { flush(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });

  // --- Fusion initiale -------------------------------------------------------
  function start(res) {
    kind = res.kind;
    tracked = RULES[kind];
    if (!tracked) return;

    var remote = res.data && typeof res.data === "object" ? res.data : {};
    var account = typeof res.account === "string" ? res.account : "";
    var owner = lsGet(ownerKey());
    // Un autre membre a joué sur cet appareil : sa progression est déjà sur
    // son compte, on repart de celle du membre actuel.
    var switched = !!owner && owner !== account;
    var base = switched ? {} : readBase();

    var keys = {};
    var i, k;
    var local = localTrackedKeys();
    for (i = 0; i < local.length; i++) keys[local[i]] = true;
    for (k in remote) if (Object.prototype.hasOwnProperty.call(remote, k) && tracked(k)) keys[k] = true;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) keys[k] = true;

    var changedHere = false;
    var newBase = {};
    for (k in keys) {
      if (!Object.prototype.hasOwnProperty.call(keys, k) || !tracked(k)) continue;
      var l = lsGet(k);
      var r = Object.prototype.hasOwnProperty.call(remote, k) ? remote[k] : null;
      var b = Object.prototype.hasOwnProperty.call(base, k) ? base[k] : null;
      var value;

      if (switched && !early[k]) value = r;            // compte de l'autre membre : le compte gagne
      else if (l === b) value = r;                     // rien changé ici : le compte gagne
      else if (r === b || r === l) value = l;          // rien changé ailleurs : l'appareil gagne
      else value = resolve(l, r);                      // changé des deux côtés

      if (value !== l) {
        changedHere = true;
        if (value === null) lsDel(k); else lsSet(k, value);
      }
      if (value !== r) pending[k] = value;             // le compte doit être mis à jour
      if (r !== null) newBase[k] = r;
    }

    // La base reflète ce que le compte contient ; elle avance quand un envoi est confirmé.
    writeBase(newBase);
    lsSet(ownerKey(), account);
    ready = true;
    flush(false);

    // Afficher la progression récupérée : on recharge une seule fois, et
    // seulement si le joueur n'a encore rien commencé.
    if (changedHere) {
      var busy = false;
      for (k in early) if (Object.prototype.hasOwnProperty.call(early, k) && tracked(k)) busy = true;
      if (lsGet("sq_actif") || lsGet("sqt_actif")) busy = true;
      // Au-delà de quelques secondes, le joueur a peut-être commencé : on ne
      // recharge pas, la progression s'affichera à la prochaine ouverture.
      if (Date.now() - loadedAt > RELOAD_WINDOW_MS) busy = true;
      if (!busy && ssGet("reloaded") !== token) {
        ssSet("reloaded", token);
        location.reload();
      }
    }
  }

  fetch(API + "?token=" + token, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) { if (res && res.ok) start(res); })
    .catch(function () { /* hors ligne : le site fonctionne comme avant */ });
})();
