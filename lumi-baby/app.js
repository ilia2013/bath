/* Lumi Baby — логіка магазину.
   Що редагувати:
   1. CONFIG   — контакти, поріг безкоштовної доставки, адреса для надсилання замовлень.
   2. PRODUCTS — товари: назва, ціна, розміри. Щоб замість ілюстрації показати фото,
                 додайте товару поле img: "photos/назва-файлу.jpg". */
(function () {
  "use strict";

  var CONFIG = {
    phone: "+380 00 000 00 00",          // ваш номер телефону
    email: "hello@lumibaby.example",     // ваша пошта
    instagram: "https://instagram.com/", // посилання на Instagram
    telegram: "https://t.me/",           // посилання на Telegram
    freeShippingFrom: 1500,              // безкоштовна доставка від, ₴
    heroImage: "photos/banner.jpg",                      // фото для головного банера, напр. "photos/banner.jpg". Поки порожньо — показується ілюстрація.
    orderEndpoint: ""                    // URL, куди надсилати замовлення (CRM, бот, форма). Поки порожньо — замовлення нікуди не йде.
  };

  var AGES = {
    baby:    { t: "0–12 місяців", n: "Немовлята",   h: "зріст 56–80 см" },
    toddler: { t: "1–3 роки",     n: "Малюки",      h: "зріст 86–98 см" },
    kid:     { t: "3–6 років",    n: "Дошкільнята", h: "зріст 104–122 см" }
  };

  var TONES = { oat: "#D9A066", milk: "#FBF6EE", sage: "#A3A77F", clay: "#7A4444", stone: "#C9B49A", mist: "#E0B5A8" };
  var TONE_NAMES = { oat: "карамельний", milk: "молочний", sage: "оливковий", clay: "бордовий", stone: "пісочний", mist: "пудровий" };

  var PRODUCTS = [
    { id: "body-lon", name: "Боді з довгим рукавом", art: "body", tone: "milk", price: 449, ages: ["baby"], sizes: [56, 62, 68, 74, 80], isNew: true,
      fabric: "100% бавовна, інтерлок", desc: "Базове боді на кожен день. Кнопки на плечі та внизу, щоб перевдягати без сліз. Шви пласкі, бирка зовні." },
    { id: "sleepsuit", name: "Чоловічок на кнопках", art: "sleepsuit", tone: "oat", price: 599, ages: ["baby"], sizes: [56, 62, 68, 74, 80], isNew: true,
      fabric: "100% бавовна, інтерлок", desc: "Чоловічок із закритими ніжками для сну та прогулянок. Кнопки по всій довжині, м'яка горловина." },
    { id: "hat-knit", name: "В'язана шапочка", art: "hat", tone: "clay", price: 289, ages: ["baby", "toddler"], sizes: ["0–6 міс", "6–12 міс", "1–3 роки"], isNew: true,
      fabric: "50% меринос, 50% бавовна", desc: "Тепла шапочка з м'якої пряжі, яка не колеться. Добре тримається на голові й закриває вушка." },
    { id: "pants-muslin", name: "Муслінові штанці", art: "pants", tone: "sage", price: 399, ages: ["baby", "toddler"], sizes: [74, 80, 86, 92, 98], isNew: true,
      fabric: "100% бавовна, муслін", desc: "Легкі вільні штанці на м'якій резинці. Муслін дихає і стає м'якшим після кожного прання." },
    { id: "dress-linen", name: "Лляна сукня", art: "dress", tone: "oat", price: 649, ages: ["toddler", "kid"], sizes: [92, 98, 104, 110, 116, 122],
      fabric: "100% льон, пом'якшений", desc: "Сукня вільного крою з короткими рукавами. Пом'якшений льон не сковує рухів і підходить для спекотних днів." },
    { id: "sweat", name: "Світшот із футера", art: "sweat", tone: "stone", price: 549, ages: ["toddler", "kid"], sizes: [86, 92, 98, 104, 110, 116, 122],
      fabric: "95% бавовна, 5% еластан, футер", desc: "Щільний світшот на прохолодну погоду. Спущене плече, еластичні манжети, широка горловина." },
    { id: "cardigan", name: "В'язаний кардиган", art: "cardigan", tone: "milk", price: 729, ages: ["baby", "toddler", "kid"], sizes: [80, 86, 92, 98, 104, 110, 116],
      fabric: "100% бавовна, в'язка", desc: "Кардиган на ґудзиках, який легко накинути поверх боді чи сукні. В'язка середньої щільності." },
    { id: "swaddle", name: "Муслінові пелюшки, 2 шт", art: "swaddle", tone: "mist", price: 359, ages: ["baby"], sizes: ["100×100 см"],
      fabric: "100% бавовна, муслін", desc: "Дві великі пелюшки: сповивати, накривати коляску, стелити на пеленальний столик." },
    { id: "booties", name: "М'які пінетки", art: "booties", tone: "oat", price: 249, ages: ["baby"], sizes: ["0–3 міс", "3–6 міс", "6–12 міс"],
      fabric: "100% бавовна, велюр", desc: "Пінетки на м'якій підошві з резинкою на щиколотці. Не спадають і не тиснуть." },
    { id: "joggers", name: "Джогери з манжетами", art: "pants", tone: "stone", price: 479, ages: ["kid"], sizes: [104, 110, 116, 122],
      fabric: "95% бавовна, 5% еластан, футер", desc: "Зручні штани для садочка та прогулянок. Широка резинка на поясі, манжети внизу." },
    { id: "longsleeve", name: "Лонгслів у рубчик", art: "sweat", tone: "sage", price: 429, ages: ["toddler", "kid"], sizes: [92, 98, 104, 110, 116, 122],
      fabric: "95% бавовна, 5% еластан, рубчик", desc: "Тонкий лонгслів, який добре тягнеться. Носити окремо або під світшот." },
    { id: "romper-linen", name: "Лляний пісочник", art: "romper", tone: "clay", price: 569, ages: ["baby", "toddler"], sizes: [68, 74, 80, 86, 92, 98],
      fabric: "100% льон, пом'якшений", desc: "Пісочник на бретелях із ґудзиками. Вільний крій для активних літніх днів." }
  ];

  var SIZE_ROWS = [
    ["0–1 міс", 56, "36–38"], ["1–3 міс", 62, "38–40"], ["3–6 міс", 68, "40–44"], ["6–9 міс", 74, "44–46"],
    ["9–12 міс", 80, "46–48"], ["12–18 міс", 86, "48–50"], ["1,5–2 роки", 92, "50–52"], ["2–3 роки", 98, "52–54"],
    ["3–4 роки", 104, "54–56"], ["4–5 років", 110, "56–58"], ["5–6 років", 116, "58–60"], ["6 років", 122, "60–62"]
  ];

  /* ---------- ілюстрації ---------- */
  var ART = {
    body: '<path class="f" d="M78 40Q100 58 122 40L150 50 184 120 164 130 142 92V150Q124 160 116 196H84Q76 160 58 150V92L36 130 16 120 50 50Z"/><path class="d" d="M72 43Q100 67 128 43M21 113 41 124M179 113 159 124"/><circle class="dot" cx="90" cy="189" r="2"/><circle class="dot" cx="100" cy="189" r="2"/><circle class="dot" cx="110" cy="189" r="2"/>',
    sleepsuit: '<path class="f" d="M78 30Q100 46 122 30L150 40 182 104 162 114 142 80V140L150 214Q150 224 138 224H118L104 160H96L82 224H62Q50 224 50 214L58 140V80L38 114 18 104 50 40Z"/><path class="d" d="M100 40V160M73 33Q100 55 127 33"/><circle class="dot" cx="100" cy="62" r="2"/><circle class="dot" cx="100" cy="84" r="2"/><circle class="dot" cx="100" cy="106" r="2"/><circle class="dot" cx="100" cy="128" r="2"/><circle class="dot" cx="100" cy="150" r="2"/>',
    hat: '<circle class="f" cx="100" cy="50" r="15"/><path class="f" d="M44 152Q44 64 100 64 156 64 156 152Z"/><rect class="f" x="34" y="148" width="132" height="32" rx="6"/><path class="d" d="M56 154V174M78 154V174M100 154V174M122 154V174M144 154V174"/>',
    pants: '<path class="f" d="M58 40H142L156 210H112L100 100 88 210H44Z"/><path class="d" d="M57 54H143M45.5 196H89.5M110.5 196H154.5M95 54 93 74M105 54 107 74"/>',
    dress: '<path class="f" d="M80 36Q100 52 120 36L146 48 160 78 140 86 134 76 168 206H32L66 76 60 86 40 78 54 48Z"/><path class="d" d="M74 39Q100 63 126 39M62 92H138M36 193H164"/>',
    sweat: '<path class="f" d="M76 44Q100 60 124 44L152 54 186 150 164 158 144 104V196H56V104L36 158 14 150 48 54Z"/><path class="d" d="M70 47Q100 69 130 47M56 182H144M18 139 40 147M182 139 160 147"/>',
    cardigan: '<path class="f" d="M80 44 100 86 120 44 152 54 186 150 164 158 144 104V196H56V104L36 158 14 150 48 54Z"/><path class="d" d="M100 86V196M56 182H144M18 139 40 147M182 139 160 147"/><circle class="dot" cx="107" cy="106" r="2.2"/><circle class="dot" cx="107" cy="130" r="2.2"/><circle class="dot" cx="107" cy="154" r="2.2"/><circle class="dot" cx="107" cy="176" r="2.2"/>',
    swaddle: '<rect class="f" x="40" y="66" width="120" height="118" rx="4"/><path class="d" d="M40 104H160M40 144H160M52 86H148M52 124H148M52 164H148"/><path class="f" d="M92 60H108V190H92Z"/>',
    booties: '<g transform="translate(-6 -30)"><path class="f" d="M40 110H76V150Q100 150 100 174 100 190 84 190H48Q36 190 36 178Z"/><path class="d" d="M39.5 126H76"/></g><g transform="translate(70 -30)"><path class="f" d="M40 110H76V150Q100 150 100 174 100 190 84 190H48Q36 190 36 178Z"/><path class="d" d="M39.5 126H76"/></g>',
    romper: '<path class="f" d="M70 40H84Q100 62 116 40H130L134 90 150 96 154 190H112L100 150 88 190H46L50 96 66 90Z"/><path class="d" d="M58 110H142"/><circle class="dot" cx="77" cy="50" r="2.2"/><circle class="dot" cx="123" cy="50" r="2.2"/>'
  };
  function art(kind, tone) {
    return '<svg class="art" viewBox="0 0 200 240" fill="' + TONES[tone] + '" aria-hidden="true">' + ART[kind] + "</svg>";
  }
  function media(p) {
    return p.img ? '<img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy">' : art(p.art, p.tone);
  }
  function heroArt() {
    function g(kind, tone, x, y, s) {
      return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + TONES[tone] + '">' + ART[kind] + "</g>";
    }
    function peg(x, y) { return '<rect class="f" x="' + x + '" y="' + y + '" width="7" height="24" rx="2" fill="#E9C9A0"/>'; }
    return '<svg class="art" viewBox="0 0 600 560" aria-hidden="true">' +
      '<path class="d" d="M-10 96Q300 168 610 96" style="opacity:.8"/>' +
      g("body", "milk", 34, 108, 0.86) + g("dress", "oat", 214, 128, 0.86) + g("pants", "sage", 398, 100, 0.86) +
      peg(97, 126) + peg(138, 132) + peg(282, 146) + peg(318, 146) + peg(460, 124) + peg(500, 118) +
      g("hat", "clay", 60, 372, 0.6) + g("booties", "oat", 390, 388, 0.62) +
      "</svg>";
  }

  /* ---------- допоміжне ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $("#app");
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uah(n) { return n.toLocaleString("uk-UA") + " ₴"; }
  function byId(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function sizeLabel(s) { return /^\d+$/.test(String(s)) ? s + " см" : s; }
  function sizeRange(p) {
    if (p.sizes.length === 1) return sizeLabel(p.sizes[0]);
    var a = p.sizes[0], b = p.sizes[p.sizes.length - 1];
    return typeof a === "number" ? a + "–" + b + " см" : a.split("–")[0] + " – " + b;
  }
  var toastT;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- стан ---------- */
  var state = { age: "all", sort: "new", size: null, qty: 1, order: null };
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem("lumi-cart") || "[]").filter(function (i) { return byId(i.id); }); } catch (e) { cart = []; }
  function saveCart() { try { localStorage.setItem("lumi-cart", JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartSum() { return cart.reduce(function (s, i) { return s + i.qty * byId(i.id).price; }, 0); }

  /* ---------- фрагменти ---------- */
  function card(p, i) {
    return '<a class="card" href="#p-' + p.id + '">' +
      '<div class="panel">' + (p.isNew ? '<span class="badge">Нове</span>' : "") + media(p) + '<span class="hint">Обрати розмір</span></div>' +
      '<div class="card-info"><div><h3>' + esc(p.name) + '</h3><span class="sz">' + sizeRange(p) + '</span></div><span class="price">' + uah(p.price) + "</span></div></a>";
  }
  function crumbs(items) {
    return '<nav class="crumbs" aria-label="Навігація"><a href="#home">Головна</a>' + items.map(function (it) {
      return "<span>/</span>" + (it[1] ? '<a href="' + it[1] + '"' + (it[2] ? ' data-age="' + it[2] + '"' : "") + ">" + it[0] + "</a>" : "<span>" + it[0] + "</span>");
    }).join("") + "</nav>";
  }
  var FAQ = [
    ["Як швидко ви відправляєте замовлення?", "Відправляємо протягом 1–3 робочих днів після підтвердження. Номер накладної Нової пошти надсилаємо в SMS або месенджер."],
    ["Як можна оплатити?", "Під час отримання на відділенні Нової пошти або карткою онлайн після підтвердження замовлення менеджером."],
    ["Що робити, якщо розмір не підійшов?", "Протягом 14 днів можна обміняти річ на інший розмір або повернути кошти. Річ має бути без слідів носіння, з бирками."],
    ["Як обрати розмір?", "Орієнтуйтеся на зріст дитини, а не на вік. Якщо зріст між двома розмірами, беріть більший. Повна таблиця є на сторінці «Розміри»."]
  ];
  function faqHtml() {
    return '<div class="acc">' + FAQ.map(function (f) { return "<details><summary>" + f[0] + "</summary><p>" + f[1] + "</p></details>"; }).join("") + "</div>";
  }

  /* ---------- сторінки ---------- */
  function home() {
    var news = PRODUCTS.filter(function (p) { return p.isNew; }).slice(0, 4);
    return '<section class="hero"><div class="hero-pic">' + (CONFIG.heroImage ? '<img src="' + CONFIG.heroImage + '" alt="">' : heroArt()) + "</div>" +
      '<div class="hero-text"><span class="up muted">Осінь–зима 2026</span><h1 class="display">Нова колекція</h1>' +
      '<p class="lead">М\'які тканини, теплі відтінки та зручні силуети для дітей від 0 до 6 років</p>' +
      '<div class="cta"><a class="btn" href="#catalog" data-age="all">Дивитися колекцію</a><a class="link" href="#sizes">Таблиця розмірів</a></div></div></section>' +

      '<section class="sec" style="padding-bottom:0"><div class="w"><div class="sec-h"><h2 class="h-sec">Обирайте <em>за віком</em></h2></div><div class="ages">' +
      Object.keys(AGES).map(function (k) {
        var a = AGES[k], pic = { baby: ["body", "milk"], toddler: ["romper", "oat"], kid: ["dress", "clay"] }[k];
        return '<a class="age" href="#catalog" data-age="' + k + '"><b>' + a.t + '</b><span class="h">' + a.n + " · " + a.h + '</span><span class="arr" aria-hidden="true">→</span>' + art(pic[0], pic[1]) + "</a>";
      }).join("") + "</div></div></section>" +

      '<section class="sec"><div class="w"><div class="sec-h"><h2 class="h-sec">Новинки</h2><a class="link" href="#catalog" data-age="all">Усі товари</a></div>' +
      '<div class="grid">' + news.map(card).join("") + "</div></div></section>" +

      '<section class="sec line"><div class="w story"><h2 class="h-sec">Одяг, у якому <em>добре рости</em></h2>' +
      '<div class="story-text"><p>Lumi означає «світло». Ми збираємо колекцію зручних речей, які легко поєднуються між собою і подобаються дітям.</p>' +
      "<p>Обираємо натуральні тканини, теплі відтінки та зручні силуети. Речі мають пласкі шви та зовнішні бирки, щоб ніщо не терло ніжну шкіру.</p>" +
      '<p><a class="link" href="#about">Більше про нас</a></p></div></div></section>' +

      '<section class="sec"><div class="w"><div class="perks">' +
      '<div class="perk"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h11v10H2zM13 9h5l4 4v3h-9z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></span><b>Відправка за 1–3 дні</b><span>Новою поштою по всій Україні</span></div>' +
      '<div class="perk"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M15 15h3"/></svg></span><b>Оплата при отриманні</b><span>Або карткою онлайн</span></div>' +
      '<div class="perk"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/></svg></span><b>Обмін і повернення</b><span>Протягом 14 днів</span></div>' +
      '<div class="perk"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span><b>М\'які тканини</b><span>Пласкі шви, бирки зовні</span></div>' +
      "</div></div></section>" +

      '<section class="sec line"><div class="w faq"><h2 class="h-sec">Часті <em>запитання</em></h2>' + faqHtml() + "</div></section>";
  }

  function catalog() {
    var list = PRODUCTS.filter(function (p) { return state.age === "all" || p.ages.indexOf(state.age) > -1; });
    if (state.sort === "asc") list = list.slice().sort(function (a, b) { return a.price - b.price; });
    if (state.sort === "desc") list = list.slice().sort(function (a, b) { return b.price - a.price; });
    var a = AGES[state.age];
    function chip(k, label) { return '<button class="chip" data-chip="' + k + '" aria-pressed="' + (state.age === k) + '">' + label + "</button>"; }
    function opt(v, label) { return '<option value="' + v + '"' + (state.sort === v ? " selected" : "") + ">" + label + "</option>"; }
    return '<div class="w page">' + crumbs([["Каталог"]]) +
      '<div class="page-top"><h1 class="page-h">' + (a ? a.n : "Каталог") + '</h1><p class="muted">' + (a ? a.t + " · " + a.h : "Одяг для дітей від народження до шести років") + "</p></div>" +
      '<div class="tools"><div class="chips" role="group" aria-label="Вік">' + chip("all", "Усі") + chip("baby", "0–12 міс") + chip("toddler", "1–3 роки") + chip("kid", "3–6 років") + "</div>" +
      '<label class="sort" for="sort">Сортування <select id="sort">' + opt("new", "Спочатку новинки") + opt("asc", "Від дешевших") + opt("desc", "Від дорожчих") + "</select></label></div>" +
      (list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<p class="empty">У цій категорії поки немає товарів.</p>') + "</div>";
  }

  function product(p) {
    var age = p.ages[0];
    var one = p.sizes.length === 1;
    if (one) state.size = p.sizes[0];
    var related = PRODUCTS.filter(function (x) { return x.id !== p.id && x.ages.some(function (g) { return p.ages.indexOf(g) > -1; }); }).slice(0, 4);
    return '<div class="w page">' + crumbs([["Каталог", "#catalog", "all"], [AGES[age].n, "#catalog", age], [esc(p.name)]]) +
      '<div class="pd"><div class="pd-media"><div class="panel">' + (p.isNew ? '<span class="badge">Нове</span>' : "") + media(p) + "</div></div>" +
      '<div class="pd-info"><div><h1 class="pd-title">' + esc(p.name) + '</h1></div><div class="pd-price">' + uah(p.price) + "</div>" +
      '<p class="pd-desc">' + esc(p.desc) + "</p>" +
      '<div><div class="field-h"><span class="up">Розмір' + (typeof p.sizes[0] === "number" ? " · зріст, см" : "") + '</span><a class="link" href="#sizes">Таблиця розмірів</a></div>' +
      '<div class="sizes" role="group" aria-label="Розмір">' + p.sizes.map(function (s) {
        return '<button class="size" data-size="' + esc(s) + '" aria-pressed="' + (String(state.size) === String(s)) + '">' + esc(s) + "</button>";
      }).join("") + '</div><p class="err" id="size-err" role="alert"></p></div>' +
      '<div class="buy"><div class="qty" aria-label="Кількість"><button data-pq="-1" aria-label="Менше">−</button><span id="pq">' + state.qty + '</span><button data-pq="1" aria-label="Більше">+</button></div>' +
      '<button class="btn" data-add="' + p.id + '">Додати в кошик</button></div>' +
      '<dl class="facts"><div><dt>Склад</dt><dd>' + esc(p.fabric) + "</dd></div><div><dt>Колір</dt><dd>" + TONE_NAMES[p.tone] + "</dd></div>" +
      "<div><dt>Догляд</dt><dd>Прання до 30°, без відбілювача</dd></div><div><dt>Доставка</dt><dd>Нова пошта, відправка за 1–3 дні</dd></div></dl>" +
      '<div class="acc"><details><summary>Оплата</summary><p>Під час отримання на відділенні Нової пошти або карткою онлайн після підтвердження замовлення.</p></details>' +
      "<details><summary>Обмін і повернення</summary><p>Протягом 14 днів, якщо річ не була у використанні та збережено бирки.</p></details></div>" +
      "</div></div>" +
      (related.length ? '<section class="sec" style="padding-bottom:0"><div class="sec-h"><h2 class="h-sec">Також <em>пасуватиме</em></h2></div><div class="grid">' + related.map(card).join("") + "</div></section>" : "") +
      "</div>";
  }

  function sumHtml() {
    var sum = cartSum(), free = sum >= CONFIG.freeShippingFrom;
    return '<aside class="sum"><h2 class="up">Ваше замовлення</h2><div>' + cart.map(function (i) {
      var p = byId(i.id);
      return '<div class="ci"><div class="panel">' + media(p) + '</div><div class="ci-main"><div class="ci-top"><span>' + esc(p.name) + '</span><span class="price">' + uah(p.price * i.qty) + '</span></div><span class="ci-meta">' + esc(sizeLabel(i.size)) + " · " + i.qty + " шт</span></div></div>";
    }).join("") + '</div><div class="sum-rows"><div><span class="muted">Товари</span><span>' + uah(sum) + '</span></div><div><span class="muted">Доставка</span><span>' + (free ? "Безкоштовно" : "За тарифами Нової пошти") + '</span></div><div class="big"><span>Разом</span><span>' + uah(sum) + "</span></div></div></aside>";
  }
  function fld(id, label, attrs, full) {
    return '<div class="fld' + (full ? " full" : "") + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" ' + (attrs || "") + '><span class="msg"></span></div>';
  }
  function checkout() {
    if (!cart.length) return '<div class="w page"><div class="done"><h1 class="page-h">Кошик порожній</h1><p class="muted">Додайте товари, щоб оформити замовлення.</p><a class="btn" href="#catalog" data-age="all">До каталогу</a></div></div>';
    return '<div class="w page">' + crumbs([["Оформлення замовлення"]]) +
      '<div class="page-top"><h1 class="page-h">Оформлення <em>замовлення</em></h1></div><div class="co">' +
      '<form class="form" id="order" novalidate>' +
      '<fieldset class="fs"><legend class="up">Контактні дані</legend><div class="fs-g">' + fld("c-name", "Ім'я", 'autocomplete="given-name" required') + fld("c-last", "Прізвище", 'autocomplete="family-name" required') +
      fld("c-phone", "Телефон", 'type="tel" inputmode="tel" autocomplete="tel" placeholder="+380" required', true) + "</div></fieldset>" +
      '<fieldset class="fs"><legend class="up">Доставка Новою поштою</legend><div class="fs-g">' + fld("c-city", "Місто або село", 'autocomplete="address-level2" required') + fld("c-np", "Номер відділення або поштомата", "required") + "</div></fieldset>" +
      '<fieldset class="fs"><legend class="up">Оплата</legend><div class="fs-g"><div class="radios">' +
      '<label class="radio on" for="pay-cod"><input type="radio" name="pay" id="pay-cod" value="Оплата при отриманні" checked><span>Оплата при отриманні<small>Оплачуєте на відділенні після огляду посилки</small></span></label>' +
      '<label class="radio" for="pay-card"><input type="radio" name="pay" id="pay-card" value="Карткою онлайн"><span>Карткою онлайн<small>Менеджер надішле реквізити після підтвердження</small></span></label></div></div></fieldset>' +
      '<fieldset class="fs"><legend class="up">Коментар</legend><div class="fs-g"><div class="fld full"><label for="c-note">Побажання до замовлення (необов\'язково)</label><textarea id="c-note" name="c-note" rows="2"></textarea></div></div></fieldset>' +
      '<div><button class="btn wide" type="submit" id="order-btn">Підтвердити замовлення</button><p class="err" id="order-err" role="alert" style="margin-top:12px"></p></div>' +
      "</form>" + sumHtml() + "</div></div>";
  }
  function done() {
    var o = state.order;
    if (!o) return checkout();
    return '<div class="w page"><div class="done"><span class="up muted">Замовлення № ' + o.no + '</span><h1 class="page-h">Дякуємо, <em>' + esc(o.name) + '</em></h1>' +
      '<p class="muted">Ми отримали ваше замовлення на суму ' + uah(o.sum) + ". Менеджер зателефонує на номер " + esc(o.phone) + ", щоб підтвердити деталі та відправлення.</p>" +
      '<a class="btn" href="#home">На головну</a></div></div>';
  }

  var PAGES = {
    delivery: ["Доставка <em>і оплата</em>", '<section><h2>Доставка</h2><ul><li>Відправляємо Новою поштою на відділення або в поштомат по всій Україні.</li><li>Замовлення передаємо перевізнику протягом 1–3 робочих днів після підтвердження.</li><li>Доставка безкоштовна для замовлень від ' + CONFIG.freeShippingFrom + ' ₴. Для менших сум вартість розраховується за тарифами Нової пошти.</li><li>Номер накладної надсилаємо в SMS або месенджер.</li></ul></section><section><h2>Оплата</h2><ul><li>Під час отримання на відділенні, після огляду посилки.</li><li>Карткою онлайн: менеджер надішле реквізити після підтвердження замовлення.</li></ul></section>'],
    returns: ["Обмін <em>і повернення</em>", "<section><h2>Умови</h2><p>Обміняти або повернути річ можна протягом 14 днів від дня отримання.</p><ul><li>Річ не була у використанні та не прана.</li><li>Збережено бирки й упаковку.</li></ul></section><section><h2>Як оформити</h2><ul><li>Напишіть нам у месенджер або зателефонуйте й назвіть номер замовлення.</li><li>Надішліть річ Новою поштою на адресу, яку повідомить менеджер.</li><li>Після отримання посилки ми відправимо інший розмір або повернемо кошти.</li></ul></section>"],
    about: ["Про <em>Lumi Baby</em>", "<section><p>Lumi Baby — невеликий український онлайн-магазин одягу для дітей від народження до шести років.</p><p>Ми добираємо речі з натуральних тканин у теплих природних відтінках. Зручні силуети легко поєднуються між собою та переходять від старшої дитини до молодшої.</p></section><section><h2>На що ми зважаємо</h2><ul><li>Тканина: бавовна, муслін, льон, м'яка в'язка.</li><li>Деталі: пласкі шви, зовнішні бирки, зручні кнопки.</li><li>Розміри: за зростом дитини, із запасом на ріст.</li></ul></section>"]
  };
  function textPage(key) {
    var p = PAGES[key];
    return '<div class="w page">' + crumbs([[p[0].replace(/<\/?em>/g, "")]]) + '<div class="text"><h1 class="page-h">' + p[0] + '</h1><div class="prose">' + p[1] + "</div></div></div>";
  }
  function sizes() {
    return '<div class="w page">' + crumbs([["Таблиця розмірів"]]) + '<div class="text"><h1 class="page-h">Таблиця <em>розмірів</em></h1><div class="prose">' +
      "<section><p>Розмір дитячого одягу відповідає зросту в сантиметрах. Виміряйте дитину та оберіть найближче більше значення.</p></section>" +
      '<div class="tbl-wrap"><table><thead><tr><th>Вік</th><th>Зріст, см</th><th>Обхват грудей, см</th></tr></thead><tbody>' +
      SIZE_ROWS.map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td></tr>"; }).join("") +
      "</tbody></table></div><section><h2>Порада</h2><p>Якщо зріст між двома розмірами, беріть більший: діти ростуть швидко, а вільний крій не заважає рухам.</p></section></div></div></div>";
  }
  function contacts() {
    return '<div class="w page">' + crumbs([["Контакти"]]) + '<div class="text"><h1 class="page-h">Контакти</h1><div class="prose">' +
      "<section><h2>Телефон</h2><p>" + esc(CONFIG.phone) + "</p></section><section><h2>Пошта</h2><p>" + esc(CONFIG.email) + "</p></section>" +
      '<section><h2>Месенджери</h2><p><a class="link" href="' + CONFIG.instagram + '" target="_blank" rel="noopener">Instagram</a> &nbsp; <a class="link" href="' + CONFIG.telegram + '" target="_blank" rel="noopener">Telegram</a></p></section>' +
      "<section><h2>Графік</h2><p>Понеділок–субота, 9:00–19:00</p></section></div></div></div>";
  }

  /* ---------- маршрути ---------- */
  var lastRoute = null;
  function route() {
    var h = (location.hash || "#home").slice(1) || "home";
    var html, title = "Lumi Baby";
    if (h.indexOf("p-") === 0 && byId(h.slice(2))) {
      var p = byId(h.slice(2));
      if (lastRoute !== h) { state.size = null; state.qty = 1; }
      html = product(p); title = p.name + " — Lumi Baby";
    } else if (h === "catalog") { html = catalog(); title = "Каталог — Lumi Baby"; }
    else if (h === "checkout") { html = checkout(); title = "Оформлення — Lumi Baby"; }
    else if (h === "done") html = done();
    else if (h === "sizes") html = sizes();
    else if (h === "contacts") html = contacts();
    else if (PAGES[h]) html = textPage(h);
    else { h = "home"; html = home(); }
    app.innerHTML = html;
    document.title = title;
    if (lastRoute !== h) window.scrollTo(0, 0);
    lastRoute = h;
    closeMenu();
  }

  /* ---------- кошик ---------- */
  function renderCart() {
    $("#cart-n").textContent = cartCount();
    var body = $("#cart-body"), foot = $("#cart-foot");
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty"><p>У кошику поки порожньо.</p><a class="btn ghost" href="#catalog" data-age="all" data-close>До каталогу</a></div>';
      foot.innerHTML = ""; return;
    }
    body.innerHTML = cart.map(function (i, n) {
      var p = byId(i.id);
      return '<div class="ci"><a class="panel" href="#p-' + p.id + '" data-close>' + media(p) + '</a><div class="ci-main">' +
        '<div class="ci-top"><a href="#p-' + p.id + '" data-close>' + esc(p.name) + '</a><span class="price">' + uah(p.price * i.qty) + "</span></div>" +
        '<span class="ci-meta">Розмір: ' + esc(sizeLabel(i.size)) + "</span>" +
        '<div class="ci-bot"><div class="qty sm"><button data-cq="-1" data-i="' + n + '" aria-label="Менше">−</button><span>' + i.qty + '</span><button data-cq="1" data-i="' + n + '" aria-label="Більше">+</button></div>' +
        '<button class="rm" data-rm="' + n + '">Видалити</button></div></div></div>';
    }).join("");
    var sum = cartSum(), left = CONFIG.freeShippingFrom - sum;
    foot.innerHTML = '<div class="ship">' + (left > 0 ? "До безкоштовної доставки залишилось " + uah(left) : "Доставка цього замовлення безкоштовна") +
      '<div class="bar"><i style="width:' + Math.min(100, Math.round(sum / CONFIG.freeShippingFrom * 100)) + '%"></i></div></div>' +
      '<div class="total"><span>Разом</span><span class="price">' + uah(sum) + "</span></div>" +
      '<a class="btn wide" href="#checkout" data-close>Оформити замовлення</a>';
  }
  function openCart() { document.documentElement.style.overflow = "hidden"; $("#drawer").hidden = false; $("#overlay").hidden = false; $("#cart-close").focus(); }
  function closeCart() { document.documentElement.style.overflow = ""; $("#drawer").hidden = true; $("#overlay").hidden = true; }
  function closeMenu() { $("#menu").hidden = true; $("#burger").setAttribute("aria-expanded", "false"); }
  function cartChanged() {
    saveCart(); renderCart();
    if (lastRoute === "checkout") route();
  }

  /* ---------- замовлення ---------- */
  function submitOrder(form) {
    var ok = true, first = null;
    function check(id, test, msg) {
      var el = $("#" + id), wrap = el.parentNode, bad = !test(el.value.trim());
      wrap.classList.toggle("bad", bad); $(".msg", wrap).textContent = bad ? msg : "";
      if (bad) { ok = false; first = first || el; }
    }
    function filled(v) { return v.length > 1; }
    check("c-name", filled, "Вкажіть ім'я");
    check("c-last", filled, "Вкажіть прізвище");
    check("c-phone", function (v) { var d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 12; }, "Вкажіть номер у форматі +380 XX XXX XX XX");
    check("c-city", filled, "Вкажіть населений пункт");
    check("c-np", function (v) { return v.length > 0; }, "Вкажіть номер відділення");
    if (!ok) { first.focus(); return; }

    var order = {
      no: String(Date.now()).slice(-6),
      name: $("#c-name").value.trim(), last: $("#c-last").value.trim(), phone: $("#c-phone").value.trim(),
      city: $("#c-city").value.trim(), np: $("#c-np").value.trim(),
      pay: form.querySelector('input[name="pay"]:checked').value, note: $("#c-note").value.trim(),
      items: cart.map(function (i) { var p = byId(i.id); return { id: i.id, name: p.name, size: sizeLabel(i.size), qty: i.qty, price: p.price }; }),
      sum: cartSum()
    };
    function finish() { state.order = order; cart = []; saveCart(); renderCart(); location.hash = "done"; }
    if (!CONFIG.orderEndpoint) { finish(); return; }
    var btn = $("#order-btn"); btn.disabled = true; btn.textContent = "Надсилаємо…";
    fetch(CONFIG.orderEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); finish(); })
      .catch(function () {
        btn.disabled = false; btn.textContent = "Підтвердити замовлення";
        $("#order-err").textContent = "Не вдалося надіслати замовлення. Перевірте з'єднання і спробуйте ще раз або зателефонуйте нам: " + CONFIG.phone;
      });
  }

  /* ---------- події ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-age],[data-chip],[data-size],[data-pq],[data-add],[data-cq],[data-rm],[data-close]");
    if (!t) return;
    var d = t.dataset;
    if ("close" in d) closeCart();
    if (d.age) { state.age = d.age; if (lastRoute === "catalog") { e.preventDefault(); route(); window.scrollTo(0, 0); } }
    else if (d.chip) { state.age = d.chip; route(); }
    else if (d.size) { state.size = d.size; t.parentNode.querySelectorAll(".size").forEach(function (b) { b.setAttribute("aria-pressed", b === t); }); $("#size-err").textContent = ""; }
    else if (d.pq) { state.qty = Math.max(1, Math.min(20, state.qty + Number(d.pq))); $("#pq").textContent = state.qty; }
    else if (d.add) {
      if (state.size === null) { $("#size-err").textContent = "Оберіть розмір, щоб додати товар у кошик"; return; }
      var hit = cart.filter(function (i) { return i.id === d.add && String(i.size) === String(state.size); })[0];
      if (hit) hit.qty += state.qty; else cart.push({ id: d.add, size: state.size, qty: state.qty });
      cartChanged(); openCart();
    }
    else if (d.cq) { var it = cart[Number(d.i)]; it.qty += Number(d.cq); if (it.qty < 1) cart.splice(Number(d.i), 1); cartChanged(); }
    else if (d.rm) { cart.splice(Number(d.rm), 1); cartChanged(); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "sort") { state.sort = e.target.value; route(); }
    if (e.target.name === "pay") document.querySelectorAll(".radio").forEach(function (l) { l.classList.toggle("on", l.contains(e.target)); });
  });
  document.addEventListener("submit", function (e) { if (e.target.id === "order") { e.preventDefault(); submitOrder(e.target); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeCart(); closeMenu(); } });
  $("#cart-open").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  $("#burger").addEventListener("click", function () {
    var m = $("#menu"); m.hidden = !m.hidden; this.setAttribute("aria-expanded", String(!m.hidden));
  });
  window.addEventListener("hashchange", route);

  $("#f-phone").textContent = CONFIG.phone;
  $("#f-email").textContent = CONFIG.email;
  $("#f-insta").href = CONFIG.instagram;
  $("#f-tg").href = CONFIG.telegram;
  renderCart();
  route();
})();
