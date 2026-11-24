const ICONS = {
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z"/>',
  gift:
    '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3.5 9h17M8 9C6 9 4.5 7.6 4.5 5.7S5.9 2.5 7.8 2.5C10.2 2.5 12 9 12 9s1.8-6.5 4.2-6.5c1.9 0 3.3 1.3 3.3 3.2S18 9 16 9"/>',
  bell:
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  user:
    '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  share:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  shield:
    '<path d="M12 3 5 6v5c0 4.4 2.9 8.4 7 10 4.1-1.6 7-5.6 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-3.7"/>',
  cup:
    '<path d="M5 8h10v4.5A5.5 5.5 0 0 1 9.5 18h0A4.5 4.5 0 0 1 5 13.5V8Z"/><path d="M15 9h1.5a2.5 2.5 0 0 1 0 5H15"/><path d="M7 3.5c0 .8-.8 1.2-.8 2s.8 1.2.8 2M11 3.5c0 .8-.8 1.2-.8 2s.8 1.2.8 2"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plant:
    '<path d="M12 21V10M12 13c-3.5 0-6-2.5-6-6 3.5 0 6 2.5 6 6ZM12 11c3.5 0 6-2.5 6-6-3.5 0-6 2.5-6 6Z"/>',
  auto:
    '<path d="M4 15h16l-1.6-5.2a2 2 0 0 0-1.9-1.4H7.5a2 2 0 0 0-1.9 1.4L4 15Z"/><path d="M6.5 15v3M17.5 15v3M7.5 8.4V6h9v2.4"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/>',
  sparkle: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/>',
  smile:
    '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.7 2 5.3 2 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
};

function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

const WISHES = [
  {
    name: "Moonlight",
    initial: "M",
    tone: "sage",
    meta: "Bengaluru · 2m",
    time: "2m",
    message: "A warm chai for a long day",
    mood: "Long day",
    icon: "cup",
    amount: "₹35",
  },
  {
    name: "PaperPlanes",
    initial: "P",
    tone: "sky",
    meta: "Indiranagar · 8m",
    time: "8m",
    message: "A tiny treat after a big week",
    mood: "Tiny treat",
    icon: "sparkle",
    amount: "You choose",
  },
  {
    name: "SundayChai",
    initial: "S",
    tone: "butter",
    meta: "Jayanagar · 14m",
    time: "14m",
    message: "Something cold for this heat",
    mood: "Chai & snack",
    icon: "sun",
    amount: "₹25",
  },
];

const CONCEPTS = [
  {
    id: "a",
    letter: "A",
    name: "Neighbourhood Postcard",
    tagline: "warm · crafted · calm",
    description:
      "Warm paper, deep green ink and illustrated everyday moments. Calm and crafted, with just enough playfulness in the stamps, notes and doodles.",
    bestFor: "a grown-up, trustworthy kind of fun.",
    palette: ["#FFF8EC", "#173B33", "#1F6B51", "#F2B544", "#E86A4A", "#DCEBDD"],
  },
  {
    id: "b",
    letter: "B",
    name: "Sticker Scrapbook",
    tagline: "social · tactile · playful",
    description:
      "Sticker-book energy: torn paper edges, bright pastel accents, hand-written notes and slightly imperfect cards. It feels like something a friend made for you.",
    bestFor: "maximum friendliness and shareability.",
    palette: ["#FFF7E8", "#2D2A26", "#2F7D5A", "#FFD66B", "#F26B5E", "#A9D6E5"],
  },
  {
    id: "c",
    letter: "C",
    name: "Afterglow",
    tagline: "bold · graphic · street",
    description:
      "Deep green hero panels, oversized display type and marigold/coral blocks with street-poster energy. Clean, graphic and unapologetically modern.",
    bestFor: "the sharpest, most design-forward expression.",
    palette: ["#FFF3D6", "#0F3D33", "#FFC93C", "#FF6B4A", "#CFE8DD", "#F5C6D6"],
  },
];

function statusbar() {
  return `<div class="statusbar" aria-hidden="true">
    <span>9:41</span>
    <span class="status-icons">
      <span class="status-signal"><span></span><span></span><span></span><span></span></span>
      <span class="status-battery"></span>
    </span>
  </div>`;
}

function brand() {
  return `<span class="brand"><span class="brand-mark">${icon("heart")}</span><span class="brand-word">Kindly</span></span>`;
}

function avatar(initial, tone = "coral", extra = "") {
  return `<span class="avatar tone-${tone} ${extra}">${initial}</span>`;
}

function homeAppbar() {
  return `<header class="appbar">
    ${brand()}
    <div class="appbar-actions">
      <button class="icon-btn" type="button" aria-label="Updates">${icon("bell")}</button>
      ${avatar("C", "coral", "avatar-btn")}
    </div>
  </header>`;
}

function detailAppbar(title = "wish", right = "share") {
  return `<header class="appbar detail-bar">
    <button class="icon-btn" type="button" aria-label="Back">${icon("arrowLeft")}</button>
    <span class="mini-title">${title}</span>
    <button class="icon-btn" type="button" aria-label="${right === "share" ? "Share" : "More"}">${icon(right)}</button>
  </header>`;
}

function tabbar(active) {
  const tabs = [
    ["discover", "Discover", "compass"],
    ["wish", "Wish", "gift"],
    ["updates", "Updates", "bell"],
    ["me", "Me", "user"],
  ];
  return `<nav class="tabbar" aria-label="Main navigation">
    ${tabs
      .map(
        ([id, label, iconName]) => `<button class="tab ${active === id ? "is-active" : ""}" type="button" aria-label="${label}">
          ${icon(iconName)}<span>${label}</span>
        </button>`,
      )
      .join("")}
  </nav>`;
}

function sectionHead(title, action) {
  return `<div class="section-head"><h2>${title}</h2><button class="text-btn" type="button">${action}</button></div>`;
}

function wishCard(wish) {
  return `<article class="wish-card">
    <div class="wish-top">
      ${avatar(wish.initial, wish.tone)}
      <div class="wish-who"><strong>${wish.name}</strong><span>${wish.meta}</span></div>
      <span class="wish-time">${wish.time}</span>
    </div>
    <p class="wish-message">${wish.message}</p>
    <div class="wish-bottom">
      <span class="mood-chip">${icon(wish.icon)} ${wish.mood}</span>
      <span class="amount">${wish.amount}</span>
    </div>
  </article>`;
}

function heroArt(kind) {
  if (kind === "a") {
    return `<div class="hero-art art-a" aria-hidden="true">
      <span class="sun-face"><span class="sun-smile"></span></span>
      <div class="postcard">
        <span class="postcard-stamp">${icon("heart")}</span>
        <span class="postcard-icon">${icon("cup")}</span>
        <p class="hand-note">have a<br>good day</p>
        <span class="postcard-line"></span>
      </div>
      <span class="doodle-leaf">${icon("plant")}</span>
      <span class="doodle-spark">${icon("sparkle")}</span>
    </div>`;
  }
  if (kind === "b") {
    return `<div class="hero-art art-b" aria-hidden="true">
      <span class="tape tape-1"></span>
      <span class="sticker sticker-sun">${icon("sun")}</span>
      <span class="sticker sticker-gift">${icon("gift")}</span>
      <span class="sticker sticker-smile">${icon("smile")}</span>
      <span class="sticker sticker-heart">${icon("heart")}</span>
      <span class="mini-note">pass it on <span>♡</span></span>
      <span class="doodle-line"></span>
    </div>`;
  }
  return `<div class="hero-art art-c" aria-hidden="true">
    <span class="art-arch"></span>
    <span class="art-sun"><span class="art-smile"></span></span>
    <span class="art-auto">${icon("auto")}</span>
    <span class="art-spark">${icon("sparkle")}</span>
    <span class="art-caption">Bengaluru / after work</span>
  </div>`;
}

function authArt() {
  return `<div class="auth-art" aria-hidden="true">
    <span class="sticker-sun">${icon("sun")}</span>
    <span class="sticker-cup">${icon("cup")}</span>
    <span class="auth-note">someone&rsquo;s day</span>
  </div>`;
}

function homeScreen(concept) {
  return `<div class="phone-screen">
    ${statusbar()}
    <div class="app-scroll">
      ${homeAppbar()}
      <main class="home">
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">${concept.id === "c" ? "Bengaluru · no agenda" : "Bengaluru · just because"}</p>
            <h1>A little something for someone&rsquo;s day.</h1>
            <p class="lede">Small gifts, zero pressure. Send ₹10&ndash;₹100 directly over UPI.</p>
            <div class="cta-row">
              <button class="btn btn-primary" type="button">Find a wish ${icon("arrowRight")}</button>
              <button class="btn btn-ghost" type="button">Share a wish</button>
            </div>
            <div class="trust-chip">${icon("shield")} Direct UPI · no fees</div>
          </div>
          ${heroArt(concept.id)}
        </section>
        <section class="feed-section">
          ${sectionHead("Little wishes, right now", "See all")}
          <div class="wish-list">${WISHES.slice(0, 2).map(wishCard).join("")}</div>
        </section>
        <div class="week-note"><span class="week-kicker">this week</span><strong>128 little lifts</strong><span>across Bengaluru</span></div>
      </main>
    </div>
    ${tabbar("discover")}
  </div>`;
}

function wishScreen() {
  return `<div class="phone-screen">
    ${statusbar()}
    <div class="app-scroll">
      ${detailAppbar("wish", "share")}
      <main class="wish-screen">
        <div class="wish-profile">
          ${avatar("M", "sage")}
          <div class="wish-profile-copy"><strong>Moonlight</strong><span>Bengaluru · today</span></div>
          <span class="mood-chip">${icon("cup")} Long day</span>
        </div>
        <article class="note-card">
          <span class="note-label">a little note</span>
          <p class="note-message">Tired from the day, buy me a coffee</p>
          <div class="note-bottom">
            <div class="note-meta"><span class="mood-chip">${icon("cup")} Long day</span></div>
            <span class="note-amount">₹35 <small>suggested</small></span>
          </div>
          <div class="note-art">${icon("cup")}<span>just because</span></div>
        </article>
        <section class="send-card">
          <p class="send-kicker">send a little lift</p>
          <p class="send-copy">You choose any whole amount from ₹10 to ₹100.</p>
          <button class="btn btn-primary" type="button">Send a gift ${icon("arrowRight")}</button>
          <div class="trust-line">${icon("shield")} Direct UPI. Kindly never holds your money.</div>
        </section>
        <div class="quiet-links"><button type="button">Report</button><span>·</span><button type="button">Block</button></div>
      </main>
    </div>
    ${tabbar("discover")}
  </div>`;
}

function signinScreen() {
  return `<div class="phone-screen auth-screen">
    ${statusbar()}
    <div class="auth-top">${brand()}<span class="age-chip">18+</span></div>
    <main class="auth-main">
      ${authArt()}
      <p class="eyebrow">hello, you</p>
      <h1 class="auth-title">Come as you are.</h1>
      <p class="lede">No real names, no spotlight. Your phone gets you in and your identity stays yours.</p>
      <div class="phone-field"><span>+91</span><input aria-label="Mobile number" placeholder="98765 43210" /></div>
      <button class="btn btn-primary btn-wide" type="button">Send me a code ${icon("arrowRight")}</button>
      <p class="fine-print">${icon("lock")} 18+ · your phone stays private · browsing is always open</p>
      <div class="auth-bottom">${icon("heart")} No campaigns. No targets. Just because.</div>
    </main>
  </div>`;
}

function giftScreen() {
  return `<div class="phone-screen">
    ${statusbar()}
    <div class="app-scroll">
      ${detailAppbar("send a gift", "dots")}
      <main class="gift-main">
        <div class="step-row">
          <span class="step is-active"><b>1</b> Amount</span><span class="step-line"></span>
          <span class="step"><b>2</b> Note</span><span class="step-line"></span>
          <span class="step"><b>3</b> UPI</span>
        </div>
        <h1 class="gift-title">Pick a little amount.</h1>
        <p class="lede">Every gift is whole rupees, ₹10&ndash;₹100.</p>
        <div class="amount-grid">
          <button class="amount-tile" type="button">₹10</button>
          <button class="amount-tile is-selected" type="button">₹25</button>
          <button class="amount-tile" type="button">₹50</button>
          <button class="amount-tile" type="button">₹100</button>
        </div>
        <label class="field-label" for="custom-amount">Another amount</label>
        <div class="amount-input"><span>₹</span><input id="custom-amount" value="25" /></div>
        <label class="field-label" for="gift-note">Add a tiny note <span>optional</span></label>
        <div class="note-input" id="gift-note">Something warm for your day&hellip;</div>
        <div class="summary">
          <div class="summary-copy">You pay Moonlight directly <span>UPI · no platform custody</span></div>
          <strong>₹25</strong>
        </div>
        <button class="btn btn-primary btn-wide" type="button">Continue to UPI ${icon("arrowRight")}</button>
        <div class="trust-line">${icon("shield")} No fees. No wallet. No middleman.</div>
        <div class="gift-next">
          ${icon("lock")}
          <div><strong>What happens next</strong><p>Open your UPI app, pay Moonlight directly, then tell us how it went.</p></div>
        </div>
      </main>
    </div>
  </div>`;
}

function spaceScreen() {
  return `<div class="phone-screen">
    ${statusbar()}
    <div class="app-scroll">
      ${homeAppbar()}
      <main class="space-main">
        <div>
          <p class="eyebrow">your little corner</p>
          <h1 class="space-title">Hi, ChaiLover.</h1>
          <p class="space-sub">Your UPI ID stays private. Your kindness doesn&rsquo;t have to.</p>
        </div>
        <div class="space-profile">
          ${avatar("C", "coral")}
          <div class="space-profile-copy"><strong>ChaiLover</strong><span>Bengaluru · joined today</span></div>
          <button class="space-share" type="button">Edit</button>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong>3</strong><span>day streak</span></div>
          <div class="stat"><strong>42</strong><span>karma</span></div>
          <div class="stat"><strong>6</strong><span>little gifts</span></div>
        </div>
        <div class="badge-row">
          <span class="badge">${icon("heart")} First gift</span>
          <span class="badge">${icon("sun")} 3-day streak</span>
          <span class="badge">${icon("sparkle")} Thank you</span>
        </div>
        <div class="subhead"><h2>Your wish</h2><span class="live-chip">live</span></div>
        <div class="active-wish">
          <div class="active-wish-top"><span class="mood-chip">${icon("cup")} Long day</span><span class="amount">₹35</span></div>
          <p>A warm chai for a long day</p>
          <div class="active-wish-foot"><span>Visible to Bengaluru</span><span>ends today</span></div>
        </div>
        <div class="subhead"><h2>Recent little things</h2><button class="text-btn" type="button">See all</button></div>
        <div>
          <div class="gift-row"><div class="gift-row-copy"><strong>Sent to Moonlight</strong><span>confirmed · today</span></div><span class="gift-row-amount">₹25</span></div>
          <div class="gift-row"><div class="gift-row-copy"><strong>Received from KindSoul</strong><span>a tiny treat</span></div><span class="gift-row-amount">₹50</span></div>
        </div>
      </main>
    </div>
    ${tabbar("me")}
  </div>`;
}

function notificationItem(item) {
  return `<article class="notif ${item.unread ? "is-unread" : ""}">
    <span class="notif-icon">${icon(item.icon)}</span>
    <div class="notif-copy"><strong>${item.title}</strong><p>${item.body}</p></div>
    <span class="notif-time">${item.time}</span>
  </article>`;
}

function notificationsScreen() {
  return `<div class="phone-screen">
    ${statusbar()}
    <div class="app-scroll">
      ${homeAppbar()}
      <main class="notif-main">
        <div>
          <p class="eyebrow">your little inbox</p>
          <h1 class="space-title">Little updates.</h1>
        </div>
        <div class="filter-row">
          <button class="filter-chip is-active" type="button">All</button>
          <button class="filter-chip" type="button">Gifts</button>
          <button class="filter-chip" type="button">Wishes</button>
        </div>
        <div class="notif-list">
          ${notificationItem({
            unread: true,
            icon: "cup",
            title: "A gift landed",
            body: "Someone sent you ₹25 for a warm chai. Check your UPI app.",
            time: "2m",
          })}
          ${notificationItem({
            unread: false,
            icon: "heart",
            title: "Someone chose your wish",
            body: "Moonlight is sending a little something your way.",
            time: "1h",
          })}
          ${notificationItem({
            unread: false,
            icon: "sparkle",
            title: "A little joy confirmed",
            body: "Your gift to SundayChai was received. A tiny lift, delivered.",
            time: "yesterday",
          })}
        </div>
      </main>
    </div>
    ${tabbar("updates")}
  </div>`;
}

function desktopHome(concept) {
  return `<div class="desktop-app" data-concept="${concept.id}">
    <header class="desktop-topbar">
      ${brand()}
      <nav class="desktop-nav" aria-label="Desktop navigation">
        <span>Discover</span><span>How it works</span><span>My Space</span>
      </nav>
      <span class="desktop-profile">${avatar("C", "coral", "small")} ChaiLover ${icon("dots")}</span>
    </header>
    <main class="desktop-main">
      <section class="desktop-hero">
        <div class="desktop-copy">
          <p class="eyebrow">${concept.id === "c" ? "Bengaluru · no agenda" : "Bengaluru · just because"}</p>
          <h1>A little something for someone&rsquo;s day.</h1>
          <p class="lede">Small gifts, zero pressure. Send ₹10&ndash;₹100 directly over UPI. No campaigns, no proof-of-use, no spotlight required.</p>
          <div class="cta-row">
            <button class="btn btn-primary" type="button">Find a wish ${icon("arrowRight")}</button>
            <button class="btn btn-ghost" type="button">Share a wish</button>
          </div>
          <div class="trust-chip">${icon("shield")} Direct UPI · no fees · Kindly never holds your money</div>
        </div>
        ${heroArt(concept.id)}
      </section>
      <div class="desktop-trustrow">
        <span><strong>128</strong> little lifts this week</span>
        <span><strong>₹10–₹100</strong> always whole rupees</span>
        <span><strong>Direct</strong> donor to recipient</span>
      </div>
      <section class="desktop-feed">
        ${sectionHead("Little wishes, right now", "See all wishes")}
        <div class="desktop-card-grid">${WISHES.map(wishCard).join("")}</div>
      </section>
    </main>
  </div>`;
}

const SCREENS = [
  { label: "Home", render: homeScreen },
  { label: "Wish detail", render: wishScreen },
  { label: "Sign in", render: signinScreen },
  { label: "Gift flow", render: giftScreen },
  { label: "My Space", render: spaceScreen },
  { label: "Notifications", render: notificationsScreen },
];

function phoneCell(content, label) {
  return `<div class="phone-cell">
    <div class="phone-frame">${content}</div>
    <div class="phone-caption">${label}</div>
  </div>`;
}

function conceptSection(concept) {
  return `<section class="concept-section ${concept.id === "a" ? "is-active" : ""}" data-concept="${concept.id}">
    <div class="concept-head">
      <div class="concept-copy">
        <p class="lab-kicker">Direction ${concept.letter}</p>
        <h2>${concept.name}</h2>
        <p>${concept.description}</p>
        <p class="best-for"><strong>Best for</strong> ${concept.bestFor}</p>
      </div>
      <div class="concept-kit">
        <div>
          <p class="kit-label">palette</p>
          <div class="swatches">
            ${concept.palette
              .map((color) => `<span class="swatch" style="background:${color}" title="${color}"></span>`)
              .join("")}
          </div>
        </div>
        <div class="kit-row">
          <div class="type-lockup">
            <span class="type-aa">Aa</span>
            <span class="type-label">Bricolage Grotesque<br />Plus Jakarta Sans</span>
          </div>
          <div class="kit-inline">
            <span class="mini-btn">Find a wish</span>
            <span class="mini-chip">just because</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stage">
      <div class="stage-label">Desktop home</div>
      <div class="desktop-stage"><div class="desktop-stage-inner">${desktopHome(concept)}</div></div>
    </div>
    <div class="stage">
      <div class="stage-label">Key mobile screens</div>
      <div class="phone-grid">${SCREENS.map((screen) => phoneCell(screen.render(concept), screen.label)).join("")}</div>
    </div>
  </section>`;
}

function renderLab() {
  const root = document.querySelector("#concepts");
  root.innerHTML = CONCEPTS.map(conceptSection).join("");

  const tabs = [...document.querySelectorAll("[data-concept-tab]")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.conceptTab;
      document.querySelectorAll(".concept-section").forEach((section) => {
        section.classList.toggle("is-active", section.dataset.concept === id);
      });
      tabs.forEach((item) => {
        const selected = item.dataset.conceptTab === id;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
    });
  });
}

renderLab();
