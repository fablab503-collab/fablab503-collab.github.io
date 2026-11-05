/* ==========================================================================
   KILNFORM STUDIO — Vanilla JS Configurator, SVG Vessel Engine & Bag State
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "kilnform_bag_v1";

  const COLORS = [
    {
      id: "obsidian",
      name: "Obsidian Basalt",
      base: "#232326",
      hi: "#4a4a50",
      shadow: "#0f0f12",
      rim: "#36363b",
      inner: "#18181b",
      textFill: "#e8e8ed"
    },
    {
      id: "chalk",
      name: "Chalk Ivory",
      base: "#eceae4",
      hi: "#ffffff",
      shadow: "#c5c1b8",
      rim: "#dedad0",
      inner: "#d8d4ca",
      textFill: "#3a3834"
    },
    {
      id: "celadon",
      name: "Sage Celadon",
      base: "#8fa396",
      hi: "#b7c9bd",
      shadow: "#5e7165",
      rim: "#7f9487",
      inner: "#6c7f73",
      textFill: "#1d2620"
    },
    {
      id: "terracotta",
      name: "Sienna Clay",
      base: "#b85d43",
      hi: "#da7f65",
      shadow: "#7d3723",
      rim: "#9e4931",
      inner: "#873d28",
      textFill: "#fff4ef"
    },
    {
      id: "cobalt",
      name: "Cobalt Mist",
      base: "#3c5a78",
      hi: "#6486a8",
      shadow: "#22364a",
      rim: "#314b66",
      inner: "#294057",
      textFill: "#eef6ff"
    },
    {
      id: "ochre",
      name: "Dune Ochre",
      base: "#c8a97e",
      hi: "#e3caa5",
      shadow: "#947750",
      rim: "#b5956b",
      inner: "#9e8058",
      textFill: "#2b2115"
    }
  ];

  const FAMILIES = {
    pebble: {
      id: "pebble",
      name: "Pebble",
      category: "cups",
      shapeLabel: "Wide Low-Profile Cup",
      shapeType: "wide",
      tagline: "Thick-walled espresso & cortado vessel that anchors heat.",
      defaultSize: "90ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 0,
      dishwasher: "Yes — top & bottom rack",
      microwave: "Yes — up to 240 °C",
      feature: "Heavy thermal foot"
    },
    flute: {
      id: "flute",
      name: "Flute",
      category: "cups",
      shapeLabel: "Tall Architectural Cup",
      shapeType: "tall",
      tagline: "Slender vertical silhouette with a tapered lip for filter coffee.",
      defaultSize: "250ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 4,
      dishwasher: "Yes — top & bottom rack",
      microwave: "Yes — up to 240 °C",
      feature: "Fine 2.5 mm drinking rim"
    },
    cairn: {
      id: "cairn",
      name: "Cairn",
      category: "cups",
      shapeLabel: "Wide Studio Bowl Cup",
      shapeType: "wide-bowl",
      tagline: "Generous wide-mouth stoneware shaped for latte art and matcha.",
      defaultSize: "400ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 7,
      dishwasher: "Yes — top & bottom rack",
      microwave: "Yes — up to 240 °C",
      feature: "Curved barista interior"
    },
    roam: {
      id: "roam",
      name: "Roam",
      category: "cups",
      shapeLabel: "Tumbler with Lid",
      shapeType: "tumbler",
      tagline: "Hand-thrown stoneware tumbler paired with a press-fit splash lid.",
      defaultSize: "400ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 12,
      dishwasher: "Yes — body & silicone gasket",
      microwave: "Yes (remove lid first)",
      feature: "Press-fit sip lid included"
    },
    hearth: {
      id: "hearth",
      name: "Hearth",
      category: "cups",
      shapeLabel: "Extra-Big Handled Mug",
      shapeType: "mug",
      tagline: "Oversized studio mug with a three-finger ergonomic stoneware loop.",
      defaultSize: "600ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 14,
      dishwasher: "Yes — top & bottom rack",
      microwave: "Yes — up to 240 °C",
      feature: "Forged three-finger handle"
    },
    nomad: {
      id: "nomad",
      name: "Nomad",
      category: "cups",
      shapeLabel: "Insulated Travel Cup",
      shapeType: "travel",
      tagline: "Double-wall ceramic travel vessel with leak-resistant lock cap.",
      defaultSize: "600ml",
      allowedSizes: ["90ml", "250ml", "400ml", "600ml"],
      baseDelta: 18,
      dishwasher: "Yes — top rack safe",
      microwave: "Yes (remove lock cap)",
      feature: "Double-wall air chamber + cap"
    },
    terra: {
      id: "terra",
      name: "Terra Planter",
      category: "pots",
      shapeLabel: "Plant Pot with Drainage Saucer",
      shapeType: "pot",
      tagline: "Extra-big architectural plant vessel with center drainage hole and fitted saucer.",
      defaultSize: "3L",
      allowedSizes: ["1L", "3L", "8L"],
      baseDelta: 30,
      dishwasher: "Saucer dishwasher safe",
      microwave: "Not applicable (Botanical vessel)",
      feature: "Center drainage + fitted saucer"
    }
  };

  const SIZES = {
    "90ml": {
      id: "90ml",
      label: "Small · 90 ml",
      shortLabel: "90 ml",
      tierName: "Small Espresso",
      capacity: "90 ml (3 oz)",
      height: "58 mm",
      diameter: "64 mm",
      price: 18,
      scale: 0.76
    },
    "250ml": {
      id: "250ml",
      label: "Medium · 250 ml",
      shortLabel: "250 ml",
      tierName: "Medium Cup",
      capacity: "250 ml (8.5 oz)",
      height: "96 mm",
      diameter: "78 mm",
      price: 22,
      scale: 0.88
    },
    "400ml": {
      id: "400ml",
      label: "Big · 400 ml",
      shortLabel: "400 ml",
      tierName: "Big Cup",
      capacity: "400 ml (13.5 oz)",
      height: "118 mm",
      diameter: "88 mm",
      price: 26,
      scale: 0.98
    },
    "600ml": {
      id: "600ml",
      label: "Extra-Big · 600 ml",
      shortLabel: "600 ml",
      tierName: "Extra-Big Mug",
      capacity: "600 ml (20 oz)",
      height: "142 mm",
      diameter: "96 mm",
      price: 32,
      scale: 1.08
    },
    "1L": {
      id: "1L",
      label: "1 L Pot",
      shortLabel: "1 L",
      tierName: "Desk Plant Pot",
      capacity: "1.0 Litre",
      height: "140 mm",
      diameter: "135 mm",
      price: 18,
      scale: 0.82
    },
    "3L": {
      id: "3L",
      label: "3 L Pot",
      shortLabel: "3 L",
      tierName: "Medium Plant Pot",
      capacity: "3.0 Litres",
      height: "195 mm",
      diameter: "185 mm",
      price: 38,
      scale: 0.96
    },
    "8L": {
      id: "8L",
      label: "8 L Pot",
      shortLabel: "8 L",
      tierName: "Floor Plant Pot",
      capacity: "8.0 Litres",
      height: "265 mm",
      diameter: "250 mm",
      price: 82,
      scale: 1.12
    }
  };

  const FINISHES = {
    matte: {
      id: "matte",
      name: "Matte Raw Stoneware",
      desc: "Velvety micro-pebbled mineral touch",
      priceDelta: 0
    },
    glossy: {
      id: "glossy",
      name: "Glossy Vitreous Glaze",
      desc: "High-fire glass sheen with luminous depth",
      priceDelta: 4
    }
  };

  /* ------------------------------------------------------------------------
     SVG Vessel Renderer (Clean, minimal, soft shading + live engraving)
     ------------------------------------------------------------------------ */
  function escapeXML(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderVesselSVG(opts) {
    const family = FAMILIES[opts.familyId] || FAMILIES.flute;
    const size = SIZES[opts.sizeId] || SIZES[family.defaultSize];
    const color = COLORS.find((c) => c.id === opts.colorId) || COLORS[0];
    const isGlossy = opts.finishId === "glossy";
    const engraving = (opts.engraving || "").trim().slice(0, 18);
    const uid = "v_" + Math.random().toString(36).slice(2, 8);
    const scale = size.scale || 1;

    // Geometry coordinates around center (200, 195)
    let topW = 68;
    let botW = 52;
    let topY = 92;
    let botY = 268;
    let hasHandle = false;
    let hasLid = false;
    let isTravel = false;
    let isPot = false;

    switch (family.shapeType) {
      case "wide":
        topW = 78;
        botW = 62;
        topY = 136;
        botY = 264;
        break;
      case "tall":
        topW = 62;
        botW = 48;
        topY = 82;
        botY = 272;
        break;
      case "wide-bowl":
        topW = 86;
        botW = 50;
        topY = 114;
        botY = 266;
        break;
      case "tumbler":
        topW = 68;
        botW = 54;
        topY = 94;
        botY = 270;
        hasLid = true;
        break;
      case "mug":
        topW = 72;
        botW = 62;
        topY = 96;
        botY = 270;
        hasHandle = true;
        break;
      case "travel":
        topW = 66;
        botW = 50;
        topY = 76;
        botY = 276;
        hasLid = true;
        isTravel = true;
        break;
      case "pot":
        topW = 92;
        botW = 68;
        topY = 88;
        botY = 262;
        isPot = true;
        break;
    }

    const midY = Math.round((topY + botY) * 0.52);
    const engraveY = isPot ? topY + 66 : midY + 6;

    // Handle SVG markup
    const handleMarkup = hasHandle
      ? `<path d="M ${200 + topW - 6} ${topY + 34}
                  C ${200 + topW + 52} ${topY + 30},
                    ${200 + botW + 52} ${botY - 32},
                    ${200 + botW - 4} ${botY - 36}"
               fill="none"
               stroke="url(#${uid}_body)"
               stroke-width="18"
               stroke-linecap="round" />
         <path d="M ${200 + topW - 6} ${topY + 34}
                  C ${200 + topW + 46} ${topY + 32},
                    ${200 + botW + 46} ${botY - 34},
                    ${200 + botW - 4} ${botY - 36}"
               fill="none"
               stroke="${color.hi}"
               stroke-opacity="${isGlossy ? 0.45 : 0.18}"
               stroke-width="4"
               stroke-linecap="round" />`
      : "";

    // Botanical leaves + drainage saucer for Terra Planter
    const plantLeavesMarkup = isPot
      ? `<g class="botanical-leaves">
           <path d="M200 ${topY + 4} C188 ${topY - 46}, 142 ${topY - 64}, 134 ${topY - 26} C128 ${topY + 2}, 172 ${topY + 10}, 200 ${topY + 4} Z" fill="#4f7a5a" opacity="0.9"/>
           <path d="M200 ${topY + 4} C214 ${topY - 56}, 264 ${topY - 68}, 268 ${topY - 26} C270 ${topY + 4}, 224 ${topY + 10}, 200 ${topY + 4} Z" fill="#659370" opacity="0.95"/>
           <path d="M200 ${topY + 6} C196 ${topY - 68}, 208 ${topY - 82}, 222 ${topY - 46} C232 ${topY - 20}, 210 ${topY + 4}, 200 ${topY + 6} Z" fill="#3b5e44"/>
         </g>`
      : "";

    const saucerMarkup = isPot
      ? `<g class="drainage-saucer">
           <path d="M ${200 - botW - 22} ${botY - 6}
                    L ${200 + botW + 22} ${botY - 6}
                    L ${200 + botW + 14} ${botY + 16}
                    Q 200 ${botY + 28} ${200 - botW - 14} ${botY + 16} Z"
                 fill="url(#${uid}_saucer)" />
           <ellipse cx="200" cy="${botY - 6}" rx="${botW + 22}" ry="9" fill="${color.rim}" />
           <circle cx="200" cy="${botY + 7}" r="3.5" fill="${color.shadow}" opacity="0.65" />
         </g>`
      : "";

    // Fluted vertical ribs for Terra Planter or Flute
    const flutesMarkup =
      isPot || family.id === "flute"
        ? [-0.6, -0.3, 0, 0.3, 0.6]
            .map((t) => {
              const x1 = 200 + t * (topW - 14);
              const x2 = 200 + t * (botW - 12);
              return `<line x1="${x1}" y1="${topY + 14}" x2="${x2}" y2="${botY - 14}" stroke="${color.shadow}" stroke-opacity="0.18" stroke-width="2" stroke-linecap="round"/>`;
            })
            .join("")
        : "";

    // Press-fit lid / travel lock cap
    const lidMarkup = hasLid
      ? `<g class="vessel-lid">
           <path d="M ${200 - topW - 3} ${topY}
                    L ${200 - topW + 6} ${topY - 18}
                    L ${200 + topW - 6} ${topY - 18}
                    L ${200 + topW + 3} ${topY} Z"
                 fill="#2c2c2e" />
           <ellipse cx="200" cy="${topY - 18}" rx="${topW - 6}" ry="11" fill="#3a3a3c" />
           ${
             isTravel
               ? `<rect x="182" y="${topY - 30}" width="36" height="12" rx="6" fill="#1d1d1f" stroke="#636366" stroke-width="1.5"/>`
               : `<ellipse cx="226" cy="${topY - 18}" rx="10" ry="3.5" fill="#111113"/>`
           }
         </g>`
      : "";

    // Travel silicone grip band
    const gripBandMarkup = isTravel
      ? `<path d="M ${200 - topW + 5} ${topY + 46}
                  Q 200 ${topY + 58} ${200 + topW - 5} ${topY + 46}
                  L ${200 + topW - 9} ${topY + 104}
                  Q 200 ${topY + 116} ${200 - topW + 9} ${topY + 104} Z"
               fill="${color.shadow}" fill-opacity="0.48" />`
      : "";

    // Glossy specular highlight vs matte subtle sheen
    const glossMarkup = isGlossy
      ? `<path d="M ${200 - topW * 0.58} ${topY + 18}
                  Q 200 ${topY + 24} ${200 - topW * 0.34} ${topY + 18}
                  L ${200 - botW * 0.34} ${botY - 18}
                  Q 200 ${botY - 14} ${200 - botW * 0.58} ${botY - 18} Z"
               fill="url(#${uid}_gloss)" />`
      : `<path d="M ${200 - topW * 0.52} ${topY + 22}
                  L ${200 - botW * 0.52} ${botY - 22}"
               stroke="${color.hi}" stroke-opacity="0.16" stroke-width="10" stroke-linecap="round" />`;

    const engravingMarkup = engraving
      ? `<defs>
           <path id="${uid}_textcurve" d="M ${200 - topW + 12} ${engraveY} Q 200 ${engraveY + 14} ${200 + topW - 12} ${engraveY}" />
         </defs>
         <text fill="${color.textFill}" opacity="0.86" font-size="13" font-weight="600" letter-spacing="1.6" text-anchor="middle">
           <textPath href="#${uid}_textcurve" startOffset="50%">${escapeXML(engraving.toUpperCase())}</textPath>
         </text>`
      : "";

    return `
      <svg viewBox="0 0 400 340" role="img" aria-label="${escapeXML(family.name + " " + size.shortLabel + " in " + color.name)}">
        <defs>
          <linearGradient id="${uid}_body" x1="0%" y1="0%" x2="100%" y2="8%">
            <stop offset="0%" stop-color="${color.hi}" />
            <stop offset="28%" stop-color="${color.base}" />
            <stop offset="76%" stop-color="${color.base}" />
            <stop offset="100%" stop-color="${color.shadow}" />
          </linearGradient>
          <linearGradient id="${uid}_saucer" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${color.base}" />
            <stop offset="50%" stop-color="${color.hi}" />
            <stop offset="100%" stop-color="${color.shadow}" />
          </linearGradient>
          <linearGradient id="${uid}_gloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.52" />
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
          </linearGradient>
          <radialGradient id="${uid}_shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.28" />
            <stop offset="70%" stop-color="#000000" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0" />
          </radialGradient>
        </defs>

        <g transform="translate(200, 185) scale(${scale}) translate(-200, -185)">
          <!-- Ambient contact shadow -->
          <ellipse cx="200" cy="${botY + (isPot ? 20 : 8)}" rx="${botW + 34}" ry="16" fill="url(#${uid}_shadow)" />

          ${plantLeavesMarkup}
          ${handleMarkup}

          <!-- Vessel main body -->
          <path d="M ${200 - topW} ${topY}
                   L ${200 - botW} ${botY - 12}
                   Q 200 ${botY + 14} ${200 + botW} ${botY - 12}
                   L ${200 + topW} ${topY} Z"
                fill="url(#${uid}_body)" />

          <!-- Unfinished stoneware raw foot ring -->
          <path d="M ${200 - botW + 4} ${botY - 10}
                   Q 200 ${botY + 13} ${200 + botW - 4} ${botY - 10}
                   L ${200 + botW - 8} ${botY - 3}
                   Q 200 ${botY + 18} ${200 - botW + 8} ${botY - 3} Z"
                fill="#c8b9a6" opacity="0.85" />

          ${flutesMarkup}
          ${gripBandMarkup}
          ${glossMarkup}
          ${saucerMarkup}

          <!-- Vessel top mouth & interior -->
          <ellipse cx="200" cy="${topY}" rx="${topW}" ry="14" fill="${color.rim}" />
          <ellipse cx="200" cy="${topY}" rx="${topW - 6}" ry="11" fill="${color.inner}" />

          ${lidMarkup}
          ${engravingMarkup}
        </g>
      </svg>
    `;
  }

  /* ------------------------------------------------------------------------
     Bag State (localStorage)
     ------------------------------------------------------------------------ */
  function loadBag() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveBag(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {
      // Ignore storage quota errors in private browsing
    }
    renderBagUI();
  }

  function addToBag(item) {
    const items = loadBag();
    const existingIndex = items.findIndex(
      (x) =>
        x.familyId === item.familyId &&
        x.sizeId === item.sizeId &&
        x.colorId === item.colorId &&
        x.finishId === item.finishId &&
        x.engraving === item.engraving
    );
    if (existingIndex > -1) {
      items[existingIndex].quantity += item.quantity;
    } else {
      items.push(item);
    }
    saveBag(items);
  }

  function removeFromBag(index) {
    const items = loadBag();
    items.splice(index, 1);
    saveBag(items);
  }

  function clearBag() {
    saveBag([]);
  }

  function renderBagUI() {
    const items = loadBag();
    const totalCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const totalPrice = items.reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1),
      0
    );

    const badge = document.getElementById("bag-count-badge");
    if (badge) {
      if (totalCount > 0) {
        badge.textContent = String(totalCount);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    const listEl = document.getElementById("bag-drawer-list");
    const emptyEl = document.getElementById("bag-drawer-empty");
    const footerEl = document.getElementById("bag-drawer-footer");
    const totalEl = document.getElementById("bag-drawer-total");

    if (!listEl || !emptyEl || !footerEl || !totalEl) return;

    if (items.length === 0) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      footerEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    footerEl.hidden = false;
    totalEl.textContent = "€" + totalPrice.toFixed(2);

    listEl.innerHTML = items
      .map((item, idx) => {
        const lineTotal = (Number(item.unitPrice) * Number(item.quantity)).toFixed(2);
        const engraveNote = item.engraving
          ? ` · Engraved “${escapeXML(item.engraving)}”`
          : "";
        return `
          <li class="bag-item">
            <div>
              <strong>${escapeXML(item.familyName)} (${escapeXML(item.sizeLabel)})</strong>
              <div class="bag-item__meta">
                ${escapeXML(item.colorName)} · ${escapeXML(item.finishName)}${engraveNote} · Qty ${Number(item.quantity)}
              </div>
              <button type="button" class="bag-item__remove" data-remove-index="${idx}">Remove</button>
            </div>
            <div><strong>€${lineTotal}</strong></div>
          </li>
        `;
      })
      .join("");
  }

  /* ------------------------------------------------------------------------
     Global Navigation & Bag Drawer Listeners
     ------------------------------------------------------------------------ */
  function initGlobalUI() {
    const nav = document.querySelector(".global-nav");
    const menuBtn = document.getElementById("mobile-menu-btn");
    const bagBtn = document.getElementById("nav-bag-btn");
    const bagDrawer = document.getElementById("bag-drawer");
    const bagCloseBtn = document.getElementById("bag-drawer-close");
    const bagClearBtn = document.getElementById("bag-clear-btn");
    const bagList = document.getElementById("bag-drawer-list");

    if (menuBtn && nav) {
      menuBtn.addEventListener("click", () => {
        const open = nav.classList.toggle("is-menu-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    if (bagBtn && bagDrawer) {
      bagBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = bagDrawer.classList.toggle("is-open");
        bagBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }

    if (bagCloseBtn && bagDrawer && bagBtn) {
      bagCloseBtn.addEventListener("click", () => {
        bagDrawer.classList.remove("is-open");
        bagBtn.setAttribute("aria-expanded", "false");
      });
    }

    if (bagClearBtn) {
      bagClearBtn.addEventListener("click", () => {
        clearBag();
      });
    }

    if (bagList) {
      bagList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-remove-index]");
        if (btn) {
          const idx = Number(btn.getAttribute("data-remove-index"));
          removeFromBag(idx);
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (
        bagDrawer &&
        bagDrawer.classList.contains("is-open") &&
        !bagDrawer.contains(e.target) &&
        e.target !== bagBtn
      ) {
        bagDrawer.classList.remove("is-open");
        if (bagBtn) bagBtn.setAttribute("aria-expanded", "false");
      }
    });

    renderBagUI();
  }

  /* ------------------------------------------------------------------------
     Compare Tabs Filter (on index.html & customize.html)
     ------------------------------------------------------------------------ */
  function initCompareTabs() {
    const tabs = document.querySelectorAll(".compare-tab");
    const cards = document.querySelectorAll(".compare-card[data-category]");
    if (!tabs.length || !cards.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const filter = tab.getAttribute("data-filter");
        tabs.forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
        cards.forEach((card) => {
          const cat = card.getAttribute("data-category");
          if (filter === "all" || cat === filter) {
            card.hidden = false;
          } else {
            card.hidden = true;
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Apple-Store-Like Configurator (customize.html)
     ------------------------------------------------------------------------ */
  function initConfigurator() {
    const root = document.getElementById("configurator-app");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const initialFamily = FAMILIES[params.get("family")] ? params.get("family") : "flute";
    const famObj = FAMILIES[initialFamily];
    const paramSize = params.get("size");
    const initialSize =
      paramSize && famObj.allowedSizes.includes(paramSize)
        ? paramSize
        : famObj.defaultSize;
    const initialColor =
      COLORS.find((c) => c.id === params.get("color"))?.id || "obsidian";

    const state = {
      familyId: initialFamily,
      sizeId: initialSize,
      colorId: initialColor,
      finishId: "matte",
      engraving: "",
      quantity: 1
    };

    const familyContainer = document.getElementById("cfg-family-list");
    const sizeContainer = document.getElementById("cfg-size-list");
    const colorContainer = document.getElementById("cfg-color-list");
    const finishContainer = document.getElementById("cfg-finish-list");
    const engravingInput = document.getElementById("cfg-engraving-input");
    const engravingCounter = document.getElementById("cfg-engraving-counter");
    const qtyInput = document.getElementById("cfg-qty-input");
    const qtyDecBtn = document.getElementById("cfg-qty-dec");
    const qtyIncBtn = document.getElementById("cfg-qty-inc");
    const previewStage = document.getElementById("cfg-preview-canvas");
    const addToBagBtn = document.getElementById("cfg-add-btn");
    const stickyAddBtn = document.getElementById("sticky-add-btn");
    const toastEl = document.getElementById("cfg-toast");

    function computeUnitPrice(familyId, sizeId, finishId, engravingText) {
      const fam = FAMILIES[familyId];
      const sz = SIZES[sizeId];
      const fin = FINISHES[finishId];
      const engraveFee = (engravingText || "").trim().length > 0 ? 6 : 0;
      return sz.price + fam.baseDelta + fin.priceDelta + engraveFee;
    }

    function renderFamilies() {
      familyContainer.innerHTML = Object.values(FAMILIES)
        .map((fam) => {
          const defaultSz = SIZES[fam.defaultSize];
          const fromPrice = defaultSz.price + fam.baseDelta;
          const pressed = fam.id === state.familyId ? "true" : "false";
          return `
            <button type="button" class="family-option" data-family="${fam.id}" aria-pressed="${pressed}">
              <div>
                <span class="family-option__name">${escapeXML(fam.name)} · ${escapeXML(fam.shapeLabel)}</span>
                <span class="family-option__desc">${escapeXML(fam.tagline)}</span>
              </div>
              <span class="family-option__price">From €${fromPrice}</span>
            </button>
          `;
        })
        .join("");
    }

    function renderSizes() {
      const fam = FAMILIES[state.familyId];
      if (!fam.allowedSizes.includes(state.sizeId)) {
        state.sizeId = fam.defaultSize;
      }
      sizeContainer.innerHTML = fam.allowedSizes
        .map((szId) => {
          const sz = SIZES[szId];
          const price = sz.price + fam.baseDelta;
          const pressed = sz.id === state.sizeId ? "true" : "false";
          return `
            <button type="button" class="size-pill" data-size="${sz.id}" aria-pressed="${pressed}">
              <span class="size-pill__cap">${escapeXML(sz.shortLabel)}</span>
              <span class="size-pill__sub">${escapeXML(sz.height)} · €${price}</span>
            </button>
          `;
        })
        .join("");
    }

    function renderColors() {
      const activeColor = COLORS.find((c) => c.id === state.colorId) || COLORS[0];
      const labelEl = document.getElementById("cfg-color-name");
      if (labelEl) labelEl.textContent = activeColor.name;

      colorContainer.innerHTML = COLORS.map((col) => {
        const pressed = col.id === state.colorId ? "true" : "false";
        return `
          <button
            type="button"
            class="color-swatch-btn"
            style="background: radial-gradient(circle at 32% 30%, ${col.hi}, ${col.base} 65%, ${col.shadow});"
            data-color="${col.id}"
            aria-label="${escapeXML(col.name)}"
            aria-pressed="${pressed}"
            title="${escapeXML(col.name)}"
          ></button>
        `;
      }).join("");
    }

    function renderFinishes() {
      finishContainer.innerHTML = Object.values(FINISHES)
        .map((fin) => {
          const pressed = fin.id === state.finishId ? "true" : "false";
          const feeLabel = fin.priceDelta > 0 ? `+€${fin.priceDelta}` : "Included";
          return `
            <button type="button" class="finish-card" data-finish="${fin.id}" aria-pressed="${pressed}">
              <span class="finish-card__name">${escapeXML(fin.name)} (${feeLabel})</span>
              <span class="finish-card__meta">${escapeXML(fin.desc)}</span>
            </button>
          `;
        })
        .join("");
    }

    function updateStageAndSummary() {
      const fam = FAMILIES[state.familyId];
      const sz = SIZES[state.sizeId];
      const col = COLORS.find((c) => c.id === state.colorId) || COLORS[0];
      const fin = FINISHES[state.finishId];
      const unitPrice = computeUnitPrice(
        state.familyId,
        state.sizeId,
        state.finishId,
        state.engraving
      );
      const totalPrice = unitPrice * state.quantity;

      // Render SVG preview
      previewStage.innerHTML = renderVesselSVG(state);

      // Update header & badges
      const titleEl = document.getElementById("cfg-dynamic-title");
      const topPriceEl = document.getElementById("cfg-top-price");
      const badgesEl = document.getElementById("cfg-stage-badges");
      const dishEl = document.getElementById("cfg-stage-care");

      if (titleEl) {
        titleEl.textContent = `Customize ${fam.name} (${sz.shortLabel})`;
      }
      if (topPriceEl) {
        topPriceEl.textContent = `€${unitPrice.toFixed(2)} each · Total €${totalPrice.toFixed(2)}`;
      }
      if (badgesEl) {
        badgesEl.innerHTML = `
          <span class="spec-pill">${escapeXML(fam.shapeLabel)}</span>
          <span class="spec-pill">${escapeXML(sz.capacity)}</span>
          <span class="spec-pill">Height ${escapeXML(sz.height)}</span>
          <span class="spec-pill">Ø ${escapeXML(sz.diameter)}</span>
        `;
      }
      if (dishEl) {
        dishEl.textContent = fam.feature;
      }

      // Summary card lines
      const sumTitle = document.getElementById("cfg-sum-title");
      const sumLines = document.getElementById("cfg-sum-lines");
      const sumTotal = document.getElementById("cfg-sum-total");
      if (sumTitle) {
        sumTitle.textContent = `${fam.name} ${sz.shortLabel} in ${col.name}`;
      }
      if (sumLines) {
        const engraveLine = state.engraving.trim()
          ? `<li>Personal Engraving: <strong>“${escapeXML(state.engraving.trim().toUpperCase())}”</strong> (+€6.00)</li>`
          : `<li>Personal Engraving: None (Free option available)</li>`;
        sumLines.innerHTML = `
          <li>Shape & Family: <strong>${escapeXML(fam.name)} — ${escapeXML(fam.shapeLabel)}</strong></li>
          <li>Capacity & Dimensions: <strong>${escapeXML(sz.capacity)} (${escapeXML(sz.height)} tall)</strong></li>
          <li>Glaze & Finish: <strong>${escapeXML(col.name)} · ${escapeXML(fin.name)}</strong></li>
          ${engraveLine}
          <li>Dishwasher: <strong>${escapeXML(fam.dishwasher)}</strong> · Microwave: <strong>${escapeXML(fam.microwave)}</strong></li>
          <li>Quantity: <strong>${state.quantity}</strong> × €${unitPrice.toFixed(2)}</li>
        `;
      }
      if (sumTotal) {
        sumTotal.textContent = `€${totalPrice.toFixed(2)}`;
      }

      // Sticky bottom buy bar
      const stickyTitle = document.getElementById("sticky-summary-title");
      const stickySub = document.getElementById("sticky-summary-sub");
      const stickyPrice = document.getElementById("sticky-summary-price");

      if (stickyTitle) {
        stickyTitle.textContent = `${fam.name} · ${sz.shortLabel} · ${col.name}`;
      }
      if (stickySub) {
        const engText = state.engraving.trim()
          ? ` · Engraved “${state.engraving.trim().toUpperCase()}”`
          : "";
        stickySub.textContent = `${fin.name}${engText} · Qty ${state.quantity} · Kiln-fired in 3–5 days`;
      }
      if (stickyPrice) {
        stickyPrice.textContent = `€${totalPrice.toFixed(2)}`;
      }
    }

    function handleAddCurrentToBag() {
      const fam = FAMILIES[state.familyId];
      const sz = SIZES[state.sizeId];
      const col = COLORS.find((c) => c.id === state.colorId) || COLORS[0];
      const fin = FINISHES[state.finishId];
      const unitPrice = computeUnitPrice(
        state.familyId,
        state.sizeId,
        state.finishId,
        state.engraving
      );

      addToBag({
        familyId: fam.id,
        familyName: fam.name,
        sizeId: sz.id,
        sizeLabel: sz.shortLabel,
        colorId: col.id,
        colorName: col.name,
        finishId: fin.id,
        finishName: fin.name,
        engraving: state.engraving.trim().toUpperCase(),
        quantity: state.quantity,
        unitPrice: unitPrice
      });

      if (toastEl) {
        toastEl.textContent = `Added ${state.quantity} × ${fam.name} (${sz.shortLabel}) to your Bag.`;
        setTimeout(() => {
          toastEl.textContent = "";
        }, 3500);
      }

      const bagDrawer = document.getElementById("bag-drawer");
      const bagBtn = document.getElementById("nav-bag-btn");
      if (bagDrawer) {
        bagDrawer.classList.add("is-open");
        if (bagBtn) bagBtn.setAttribute("aria-expanded", "true");
      }
    }

    // Event delegation
    familyContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-family]");
      if (!btn) return;
      state.familyId = btn.getAttribute("data-family");
      const fam = FAMILIES[state.familyId];
      if (!fam.allowedSizes.includes(state.sizeId)) {
        state.sizeId = fam.defaultSize;
      }
      renderFamilies();
      renderSizes();
      updateStageAndSummary();
    });

    sizeContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-size]");
      if (!btn) return;
      state.sizeId = btn.getAttribute("data-size");
      renderSizes();
      updateStageAndSummary();
    });

    colorContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-color]");
      if (!btn) return;
      state.colorId = btn.getAttribute("data-color");
      renderColors();
      updateStageAndSummary();
    });

    finishContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-finish]");
      if (!btn) return;
      state.finishId = btn.getAttribute("data-finish");
      renderFinishes();
      updateStageAndSummary();
    });

    if (engravingInput) {
      engravingInput.addEventListener("input", () => {
        state.engraving = engravingInput.value.slice(0, 18);
        if (engravingCounter) {
          engravingCounter.textContent = `${state.engraving.length}/18`;
        }
        updateStageAndSummary();
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("change", () => {
        const val = Math.max(1, Math.min(24, parseInt(qtyInput.value, 10) || 1));
        state.quantity = val;
        qtyInput.value = String(val);
        updateStageAndSummary();
      });
    }

    if (qtyDecBtn && qtyInput) {
      qtyDecBtn.addEventListener("click", () => {
        state.quantity = Math.max(1, state.quantity - 1);
        qtyInput.value = String(state.quantity);
        updateStageAndSummary();
      });
    }

    if (qtyIncBtn && qtyInput) {
      qtyIncBtn.addEventListener("click", () => {
        state.quantity = Math.min(24, state.quantity + 1);
        qtyInput.value = String(state.quantity);
        updateStageAndSummary();
      });
    }

    if (addToBagBtn) {
      addToBagBtn.addEventListener("click", handleAddCurrentToBag);
    }
    if (stickyAddBtn) {
      stickyAddBtn.addEventListener("click", handleAddCurrentToBag);
    }

    renderFamilies();
    renderSizes();
    renderColors();
    renderFinishes();
    updateStageAndSummary();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initGlobalUI();
    initCompareTabs();
    initConfigurator();
  });
})();
