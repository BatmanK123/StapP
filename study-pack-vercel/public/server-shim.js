/* Connects the app to its own server (the /api folder) instead of Claude's built-in runtime. */
(function () {
  var LS = window.localStorage;
  function get(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function del(k) { try { LS.removeItem(k); } catch (e) {} }
  var st = { token: get("sp-token"), refresh: get("sp-refresh"), exp: +get("sp-exp") || 0, ownerKey: get("sp-owner"), ownerOk: false, ticket: null };
  var qs = new URLSearchParams(location.search), SESSION = qs.get("session_id");

  function hdr(extra) {
    var h = { "content-type": "application/json" };
    if (st.ownerKey) h["x-owner-key"] = st.ownerKey;
    if (st.token) h.authorization = "Bearer " + st.token;
    if (st.ticket) h["x-ticket"] = st.ticket;
    for (var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  async function post(path, body, headers, signal) {
    var r = await fetch("/api/" + path, { method: "POST", headers: headers || { "content-type": "application/json" }, body: JSON.stringify(body || {}), signal: signal });
    var d = null; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: (d && d.error) || "http_" + r.status, message: (d && d.detail) || "", status: r.status };
    return d;
  }
  async function syncPlan(session) {
    try {
      var d = await post("plan", session ? { session_id: session } : { refresh: st.refresh });
      st.token = d.token; st.refresh = d.refresh; st.exp = Date.now() / 1000 + 3500;
      set("sp-token", d.token); set("sp-refresh", d.refresh); set("sp-exp", String(st.exp)); set("study-plan", d.plan);
      if (window.setPlan) window.setPlan(d.plan);
      return d.plan;
    } catch (e) {
      if (e && e.status === 401) { st.refresh = null; st.token = null; del("sp-refresh"); del("sp-token"); set("study-plan", "basic"); if (window.setPlan) window.setPlan("basic"); }
      return null;
    }
  }
  async function fresh() { if (st.refresh && st.exp - Date.now() / 1000 < 300) await syncPlan(); }
  async function api(path, body, signal) { await fresh(); return post(path, body, hdr(), signal); }

  var ready = (async function () {
    if (st.ownerKey) {
      try { var w = await post("whoami", {}, { "content-type": "application/json", "x-owner-key": st.ownerKey }); st.ownerOk = !!w.owner; } catch (e) {}
      if (!st.ownerOk) { st.ownerKey = null; del("sp-owner"); }
    }
    if (SESSION) await syncPlan(SESSION);
    else if (st.refresh) await syncPlan();
    else set("study-plan", "basic");
  })();

  function b64(blob) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1]); }; r.onerror = no; r.readAsDataURL(blob); }); }
  async function run(prompt, o, json) {
    o = o || {}; await ready;
    var imgs = [], list = o.images || [];
    for (var i = 0; i < list.length; i++) imgs.push({ media_type: list[i].type || "image/jpeg", data: await b64(list[i]) });
    return api("ai", { prompt: prompt, images: imgs, json: !!json, kind: /^Translate every value/.test(prompt) ? "translate" : "pack" }, o.signal);
  }
  function sample(prompt, o) { return run(prompt, o, false); }
  sample.json = async function (prompt, o) {
    var d = await run(prompt, o, true), t = String(d.text || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim(), i = t.search(/[\[{]/);
    if (i > 0) t = t.slice(i);
    return JSON.parse(t);
  };
  sample.limits = async function () { return { maxPromptBytes: 262144, images: { maxCount: 3, maxInputBytes: 20000000, mediaTypes: ["image/jpeg", "image/png", "image/webp"] } }; };

  window.claude = { use: async function (n) {
    if (n === "sample") return sample;
    if (n === "user") { await ready; return { isOwner: function () { return st.ownerOk; } }; }
    return null;
  } };

  window.spPackStart = async function () {
    await ready;
    try {
      var d = await api("pack-start", {});
      st.ticket = d.ticket;
      if (window.dayKey) set("study-usage", JSON.stringify({ d: window.dayKey(), n: d.used }));
      if (window.renderSubs) window.renderSubs();
    } catch (e) {
      if (e && e.code === "limit" && window.dayKey) set("study-usage", JSON.stringify({ d: window.dayKey(), n: 999 }));
      throw e;
    }
  };
  window.spCheckout = async function (plan) { var d = await api("checkout", { plan: plan }); if (!d.url) throw 0; location.href = d.url; };
  window.spPortal = async function () { try { var d = await post("portal", { refresh: st.refresh }); location.href = d.url; } catch (e) { window.status("", ""); } };
  window.spOwnerLogin = async function () {
    var k = prompt(window.tr("own_login")); if (!k) return; k = k.trim();
    try { var w = await post("whoami", {}, { "content-type": "application/json", "x-owner-key": k }); if (w.owner) { set("sp-owner", k); location.reload(); } else window.status(window.tr("own_bad"), "err"); }
    catch (e) { window.status(window.tr("own_bad"), "err"); }
  };
  function addNotes(t) { var n = document.getElementById("notes"); n.value = (n.value && !/\s$/.test(n.value) ? n.value + "\n\n" : n.value) + t; n.dispatchEvent(new Event("input")); }
  window.spVideoLink = async function (u) {
    window.status(window.tr("vid_link_busy"), "ok");
    try { var d = await api("video", { url: u }); addNotes(d.text); window.status(window.tr("vid_link_ok"), "ok"); }
    catch (e) { window.status(window.tr(e.code === "no_captions" ? "vid_nocap" : e.code === "unsupported" ? "vid_unsup" : e.status === 403 ? "gate_vid" : "vid_fail"), "err"); }
  };
  window.spTranscribe = async function (f) {
    if (f.size > 4300000) { window.status(window.tr("aud_big"), "err"); return; }
    window.status(window.tr("aud_busy"), "ok");
    try {
      await ready; await fresh();
      var r = await fetch("/api/transcribe", { method: "POST", headers: hdr({ "content-type": f.type || "audio/mpeg" }), body: f });
      var d = await r.json(); if (!r.ok) throw { status: r.status };
      addNotes(d.text); window.status(window.tr("aud_ok"), "ok");
    } catch (e) { window.status(window.tr(e && e.status === 403 ? "gate_voice" : "aud_fail"), "err"); }
  };
  window.addEventListener("load", function () {
    if (!SESSION) return;
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    ready.then(function () {
      var p = get("study-plan");
      if (p && p !== "basic" && window.openPage) { window.openPage("subs"); if (window.sbMsg) window.sbMsg(window.tr("sb_thx", { n: window.tr("sb_" + p) })); }
    });
  });
})();
