import { portrait } from "./portraits.js";
import { mountStage } from "./stage.js";
const base = document.documentElement.dataset.base || "";
const $ = (s) => document.querySelector(s);
const state = {
  mode: "login",
  me: null,
  characters: [],
  peerId: null,
  messages: [],
  drafts: {},
  pending: new Set(),
  epoch: 0,
  loading: false,
  history: false,
};
const auth = $("#auth"),
  app = $("#app"),
  form = $("#auth-form"),
  people = $("#people"),
  log = $("#log");
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-mode]");
  if (button && !form.inert) {
    state.mode = button.dataset.mode;
    renderAuth();
  }
});
form.onsubmit = submitAuth;
$("#logout").onclick = async () => {
  const r = await request("/api/auth/logout", {});
  if (r.ok) showAuth();
  else note(r.body.error);
};
$("#mode-manual").onclick = () => setMode("manual");
$("#mode-auto").onclick = () => setMode("auto");
$("#composer").onsubmit = (e) => {
  e.preventDefault();
  send(false);
};
$("#auto").onclick = () => send(true);
$("#close-thread").onclick = closeThread;
$("#history-toggle").onclick = () => {
  state.history = !state.history;
  log.dataset.signature = "";
  renderThread();
};
$("#members-toggle").onclick = () =>
  toggleRoster(!app.classList.contains("roster-open"));
people.onclick = (e) => {
  const b = e.target.closest("[data-id]");
  if (b) openThread(b.dataset.id);
};
people.onkeydown = (e) => {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key))
    return;
  e.preventDefault();
  const buttons = [...people.querySelectorAll("button")],
    i = buttons.indexOf(document.activeElement);
  buttons[
    (i +
      (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1) +
      buttons.length) %
      buttons.length
  ]?.focus();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.me) {
    e.preventDefault();
    closeThread();
  }
});
$("#draft").oninput = () => {
  if (state.peerId) state.drafts[state.peerId] = $("#draft").value;
  count();
};
renderAuth();
boot();

function renderAuth() {
  document
    .querySelectorAll("nav button")
    .forEach((b) => {
      if (b.dataset.mode === state.mode) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  $("#auth-message").textContent = "";
  const m = state.mode,
    fields = [field("name", "英文名", "text", "username")];
  if (m === "register" || m === "reset")
    fields.push(
      field(
        "code",
        m === "register" ? "专属领取码" : "重置码",
        "text",
        m === "reset" ? "one-time-code" : "off",
      ),
    );
  if (m !== "forgot") {
    fields.push(
      field(
        "password",
        m === "login" ? "密码" : "设置密码（至少 10 位）",
        "password",
        m === "login" ? "current-password" : "new-password",
      ),
    );
    if (m !== "login")
      fields.push(field("confirm", "确认密码", "password", "new-password"));
  }
  form.innerHTML =
    fields.join("") +
    '<button class="primary" type="submit">' +
    {
      login: "进入胡同",
      register: "注册并领取角色",
      forgot: "找回密码",
      reset: "重置密码",
    }[m] +
    "</button>";
}
function field(id, label, type, auto) {
  return (
    '<label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" name="' +
    id +
    '" type="' +
    type +
    '" autocomplete="' +
    auto +
    '" required maxlength="' +
    (type === "password" ? 128 : 64) +
    '"' +
    (type === "password" ? ' minlength="10"' : "") +
    ">"
  );
}
async function submitAuth(e) {
  e.preventDefault();
  if (form.inert) return;
  const d = new FormData(form),
    mode = state.mode;
  if (d.has("confirm") && d.get("confirm") !== d.get("password")) {
    $("#auth-message").textContent = "两次密码不一致。";
    return;
  }
  form.inert = true;
  form.setAttribute("aria-busy", "true");
  const submit = form.querySelector("[type=submit]"),
    label = submit.textContent;
  submit.textContent = "请稍候…";
  const r = await request(
    "/api/auth/" +
      ({ forgot: "forgot-password", reset: "reset-password" }[mode] || mode),
    {
      name: d.get("name"),
      claimCode: d.get("code"),
      code: d.get("code"),
      password: d.get("password"),
    },
  );
  form.inert = false;
  form.removeAttribute("aria-busy");
  submit.textContent = label;
  if (!r.ok) {
    $("#auth-message").textContent = r.body.error;
    return;
  }
  if (mode === "forgot") {
    $("#auth-message").textContent = "请联系管理员核对身份，领取重置码。";
    return;
  }
  if (mode === "reset") {
    state.mode = "login";
    renderAuth();
    $("#auth-message").textContent = "密码已更新，请登录。";
    return;
  }
  form.reset();
  await boot(true);
}
async function boot(afterLogin = false) {
  const r = await request("/api/me", null, "GET");
  if (!r.ok) {
    showAuth();
    if (afterLogin || r.status !== 401) {
      $("#auth-message").textContent = afterLogin && r.status === 401
        ? "登录会话未能保存，请联系管理员检查线上账号存储。"
        : r.body.error || "暂时无法进入胡同，请稍后重试。";
    }
    return;
  }
  Object.assign(state, {
    me: r.body.member,
    characters: r.body.characters,
    llm: r.body.llm,
  });
  auth.classList.remove("open");
  app.hidden = false;
  $("#me-name").textContent = state.me.name;
  $("#who").textContent = state.me.name;
  portrait($("#me-sprite"), state.me.id);
  renderPeople();
  renderMode();
  renderThread();
  if (matchMedia("(max-width:767px)").matches) toggleRoster(true);
  connect();
  state.stage?.stop();
  state.stage = mountStage({
    canvas: $("#stage"),
    hint: $("#hint"),
    request,
    meId: state.me.id,
    onTalk: openThread,
    chatOpen: () => !$(".conversation").hidden,
    manual: () => state.me?.control === "human",
    place: $("#where"),
    notice: $("#world-log"),
  });
  clearInterval(state.timer);
  state.timer = setInterval(refreshPeople, 10000);
}
function showAuth() {
  ++state.epoch;
  state.me = null;
  state.peerId = null;
  state.messages = [];
  state.drafts = {};
  state.pending.clear();
  state.events?.close();
  state.stage?.stop();
  state.stage = null;
  clearInterval(state.timer);
  app.hidden = true;
  auth.classList.add("open");
  renderAuth();
}
function toggleRoster(open) {
  app.classList.toggle("roster-open", open);
  $("#members-toggle").setAttribute("aria-expanded", String(open));
  if (open) people.querySelector("button")?.focus();
}
function renderMode() {
  $("#mode-manual").setAttribute(
    "aria-pressed",
    String(state.me?.control === "human"),
  );
  $("#mode-auto").setAttribute(
    "aria-pressed",
    String(state.me?.control === "llm"),
  );
}
function renderPeople() {
  const signature = JSON.stringify(
    state.characters.map((p) => [
      p.id,
      p.control,
      p.watching,
      p.id === state.peerId,
    ]),
  );
  if (people.dataset.signature === signature) return;
  const focused = document.activeElement?.dataset.id;
  people.dataset.signature = signature;
  people.replaceChildren();
  for (const p of state.characters) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = p.id;
    if (p.id === state.peerId) b.setAttribute("aria-current", "true");
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 88;
    canvas.setAttribute("aria-hidden", "true");
    portrait(canvas, p.id);
    const copy = document.createElement("span");
    copy.className = "person-copy";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const meta = document.createElement("small");
    meta.textContent =
      p.control === "human" ? "在线" : p.watching ? "托管中" : "离线托管";
    copy.append(name, meta);
    b.append(canvas, copy);
    people.append(b);
  }
  if (focused) people.querySelector('[data-id="' + focused + '"]')?.focus();
}
function renderThread() {
  const p = state.characters.find((p) => p.id === state.peerId),
    busy = state.pending.has(state.peerId);
  $("#title").textContent = p ? p.name : "找谁聊聊？";
  $("#subtitle").textContent = p
    ? p.control === "human"
      ? "本人在线"
      : "托管中，回复会注明来源。"
    : "选择一位成员。";
  portrait($("#peer-sprite"), p?.id || "");
  $("#close-thread").hidden = !p;
  $(".conversation").hidden = !p;
  $("#auto").hidden = !p || p.control === "human" || !state.llm?.configured;
  $("#auto").disabled = busy || state.loading;
  $("#composer button[type=submit]").disabled = !p || busy || state.loading;
  $("#composer button[type=submit]").textContent = busy ? "发送中…" : "发送";
  $("#draft").disabled = !p || state.loading;
  $("#empty").hidden = Boolean(p && !state.loading && state.messages.length);
  $("#empty").firstElementChild.textContent = state.loading
    ? "正在读取消息…"
    : p
      ? "还没有消息，打个招呼吧。"
      : "选一位成员，开始聊天。";
  $("#empty .sub").hidden = Boolean(p);
  const shown = state.history ? state.messages : [];
  log.hidden = !state.history;
  $("#empty").hidden = !state.history || Boolean(p && !state.loading && state.messages.length);
  const signature =
    state.peerId + ":" + state.history + ":" + state.messages.map((m) => m.id).join(",");
  $("#history-toggle").hidden = !p;
  $("#history-toggle").textContent = state.history ? "收起记录" : "聊天记录";
  $("#history-toggle").setAttribute("aria-expanded", String(state.history));
  log.classList.toggle("expanded", state.history);
  if (log.dataset.signature !== signature) {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60,
      scroll = log.scrollTop;
    log.dataset.signature = signature;
    log.replaceChildren(...shown.map(bubble));
    log.scrollTop = atBottom || state.forceScroll ? log.scrollHeight : scroll;
    state.forceScroll = false;
  }
  count();
}
function bubble(m) {
  const item = document.createElement("article");
  item.className = m.senderId === state.me.id ? "mine" : "";
  const tag = document.createElement("span");
  tag.className = "tag";
  const name =
    m.senderId === state.me.id
      ? state.me.name
      : state.characters.find((p) => p.id === m.senderId)?.name;
  tag.textContent =
    name +
    (m.source === "llm" ? " · 自动回复" : "") +
    " " +
    new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(m.at);
  const body = document.createElement("p");
  body.textContent = m.body;
  item.append(tag, body);
  return item;
}
async function openThread(id) {
  if (state.peerId) state.drafts[state.peerId] = $("#draft").value;
  state.peerId = id;
  state.history = false;
  state.messages = [];
  state.loading = true;
  state.forceScroll = true;
  const epoch = ++state.epoch;
  $("#draft").value = state.drafts[id] || "";
  note("");
  toggleRoster(false);
  renderPeople();
  renderThread();
  state.stage?.halt();
  const r = await request("/api/chats/" + id + "/messages", null, "GET");
  if (epoch !== state.epoch || !state.me) return;
  state.loading = false;
  if (r.ok) state.messages = merge(r.body.messages, state.messages);
  else note(r.body.error);
  renderThread();
  $("#draft").focus();
}
function closeThread() {
  if (state.peerId) state.drafts[state.peerId] = $("#draft").value;
  ++state.epoch;
  state.peerId = null;
  state.messages = [];
  state.loading = false;
  note("");
  $("#draft").value = "";
  renderPeople();
  renderThread();
  if (matchMedia("(max-width:767px)").matches) toggleRoster(true);
  else state.stage?.focus();
}
async function send(auto) {
  const peer = state.peerId,
    text = $("#draft").value.trim(),
    owner = state.me?.id;
  if (!peer || state.pending.has(peer) || state.loading || (!text && !auto))
    return;
  state.pending.add(peer);
  note("");
  renderThread();
  const r = await request(
    "/api/chats/" + peer + "/" + (auto ? "auto" : "messages"),
    auto ? {} : { text },
  );
  state.pending.delete(peer);
  if (state.me?.id !== owner) return;
  if (r.ok) for (const message of r.body.messages || []) showSpeech(message);
  if (r.ok && !auto && state.drafts[peer]?.trim() === text) {
    state.drafts[peer] = "";
    if (state.peerId === peer) $("#draft").value = "";
  }
  if (state.peerId === peer) {
    if (r.ok) {
      state.messages = merge(state.messages, r.body.messages || []);
      state.forceScroll = true;
      note(r.body.llmError || "");
    } else note(r.body.error);
    renderThread();
    $("#draft").focus();
  }
  refreshPeople();
}
function merge(a, b) {
  return [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.at - b.at,
  );
}
function showSpeech(message) {
  state.stage?.speak({ actorId: message.senderId, text: message.body, id: message.id, source: message.source });
  if (message.senderId !== state.me?.id && !state.stage?.sameScene(message.senderId)) {
    if (state.peerId === message.senderId) state.history = true;
    else state.stage?.say(`${state.characters.find(p => p.id === message.senderId)?.name || '成员'} 发来一条私聊，可在成员列表中查看。`);
  }
}
async function setMode(mode) {
  const r = await request("/api/me/mode", { mode });
  if (!state.me) return;
  if (!r.ok) {
    note(r.body.error);
    return;
  }
  state.me = { ...state.me, ...r.body.member };
  renderMode();
  if (mode === "manual") await state.stage?.reclaim();
  else await state.stage?.halt();
}
function connect() {
  state.events?.close();
  const events = new EventSource(base + "/api/events");
  state.events = events;
  events.onopen = () => {
    $("#connection").textContent = "已连接";
    refreshPeople();
    resyncThread();
    state.stage?.refresh();
  };
  events.onerror = () => {
    $("#connection").textContent = "正在重连";
  };
  events.onmessage = (e) => {
    let p;
    try {
      p = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!state.me) return;
    if (p.type === "world") state.stage?.setActors(p.actors);
    if (p.type === "invite") showInvite(p.notice);
    if (p.type === "say") state.stage?.speak({ actorId: p.notice.actor, text: p.notice.text, id: p.notice.id });
    if (p.type === "presence") {
      state.characters = p.characters;
      renderPeople();
      renderThread();
    }
    if (p.type === "message") {
      showSpeech(p.message);
      if (p.peerId === state.peerId) {
        state.messages = merge(state.messages, [p.message]);
        renderThread();
      }
    }
  };
}
async function resyncThread() {
  const epoch = state.epoch,
    peer = state.peerId;
  if (!peer) return;
  const r = await request("/api/chats/" + peer + "/messages", null, "GET");
  if (r.ok && epoch === state.epoch && state.me) {
    state.messages = merge(r.body.messages, state.messages);
    renderThread();
  }
}
async function refreshPeople() {
  if (!state.me) return;
  const owner = state.me.id,
    r = await request("/api/me", null, "GET");
  if (state.me?.id !== owner) return;
  if (r.status === 401) {
    showAuth();
    $("#auth-message").textContent = "登录已失效，请重新登录。";
    return;
  }
  if (!r.ok) return;
  Object.assign(state, {
    me: r.body.member,
    characters: r.body.characters,
    llm: r.body.llm,
  });
  renderMode();
  renderPeople();
  renderThread();
}
function count() {
  $("#char-count").textContent = $("#draft").value.length + " / 200";
}
function note(text) {
  $("#warn").textContent = text || "";
}
function showInvite(notice) {
  let bar = document.querySelector("#invite");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "invite";
    document.querySelector(".hud").after(bar);
  }
  bar.hidden = false;
  bar.replaceChildren();
  const text = document.createElement("span");
  text.textContent = notice.activity === "deliver_coffee" ? "要去给 Sid 买咖啡吗？" : "有人约你一起走。";
  const yes = document.createElement("button");
  yes.type = "button";
  yes.textContent = "去";
  const no = document.createElement("button");
  no.type = "button";
  no.textContent = "不去";
  const answer = async (accept) => {
    bar.hidden = true;
    const r = await request("/api/world/respond", { eventId: notice.eventId, accept });
    if (!r.ok) state.stage?.say(r.body.error);
  };
  yes.onclick = () => answer(true);
  no.onclick = () => answer(false);
  bar.append(text, yes, no);
}
async function request(path, body, method) {
  try {
    const r = await fetch(base + path, {
      method: method || "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await r
      .json()
      .catch(() => ({ error: "暂时无法读取结果，请重试。" }));
    return { ok: r.ok, status: r.status, body: payload };
  } catch {
    return {
      ok: false,
      status: 0,
      body: { error: "没有连上胡同，请检查网络后重试。" },
    };
  }
}
