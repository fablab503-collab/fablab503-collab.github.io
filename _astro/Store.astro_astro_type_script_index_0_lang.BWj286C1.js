var e=document.getElementById(`store-app`),t=JSON.parse(e.dataset.cfg||`{}`),n=document.getElementById(`store-grid`),r=document.getElementById(`store-pills`),i=document.getElementById(`store-q`),a=document.getElementById(`store-count`),o=document.getElementById(`store-banner`),s=document.getElementById(`store-dialog`),c=document.getElementById(`store-dlg-body`),l=[],u=`all`,d=e=>String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`),f=e=>/^#[0-9a-f]{3,8}$/i.test(e)?e:`#888888`;function p(e){return String(e).padStart(3,`0`)}function m(){let e={};for(let t of l)e[t.cat]=(e[t.cat]||0)+1;let n=[`<button type="button" class="pill ${u===`all`?`active`:``}" data-cat="all">${d(t.allLabel)}</button>`];for(let[r,i]of Object.entries(t.cats||{}))e[r]&&n.push(`<button type="button" class="pill ${u===r?`active`:``}" data-cat="${d(r)}">${d(i)} (${e[r]})</button>`);r.innerHTML=n.join(``)}function h(){let e=i.value.trim().toLowerCase(),r=l.filter(t=>u!==`all`&&t.cat!==u?!1:!e||t.title.toLowerCase().includes(e)||t.slug.includes(e)||t.tags.some(t=>t.toLowerCase().includes(e))||t.items.some(t=>t.l.toLowerCase().includes(e)));a.textContent=String(t.countTpl||`{n} / {total}`).replace(`{n}`,String(r.length)).replace(`{total}`,String(l.length)),n.innerHTML=r.length===0?`<p class="small">${d(t.noMatch)}</p>`:r.map(e=>`
      <article class="scard" data-num="${e.num}">
        <img class="scard-cov" src="/store-assets/covers/${d(e.slug)}.webp" alt="${d(e.title)}" loading="lazy" decoding="async" data-preview="${e.num}" />
        <div class="scard-body">
          <div class="scard-meta">
            <span>#${p(e.num)}</span>
            <span>${d(e.zip_mb)} MB · €1.99</span>
          </div>
          <h2 class="scard-title">${d(e.title)}</h2>
          <p class="scard-tags">${d(e.tags.join(` · `))}</p>
          <div class="scard-actions">
            <a class="btn btn-primary" href="/api/store/buy?pack=${encodeURIComponent(e.slug)}">${d(t.buyBtn)}</a>
            <button type="button" class="btn btn-secondary" data-preview="${e.num}">${d(t.previewBtn)}</button>
            ${e.gumroad_url?`<a class="btn btn-secondary" href="${d(e.gumroad_url)}" target="_blank" rel="noopener">${d(t.gumroadBtn)}</a>`:``}
          </div>
        </div>
      </article>
    `).join(``)}function g(e){let n=l.find(t=>t.num===e);if(!n)return;let r=n.has_sprite?`/store-assets/sprites/${encodeURIComponent(n.slug)}_sprite.webp`:``,i=n.items.map(e=>{let t=``;if(r){let i=e.i-1,a=i%11,o=Math.floor(i/11),s=n.cat===`eink`?`image-rendering:pixelated;`:``;t=`<div class="dsp" style="background-image:url('${r}');background-position:-${a*80}px -${o*80}px;${s}"></div>`}else t=n.cat===`ui-gradient`&&e.sw?.length?`<div class="dsw" style="background:linear-gradient(135deg,${e.sw.map(f).join(`,`)})"></div>`:e.sw?.length?`<div class="dsw">${e.sw.map(e=>`<span style="background:${f(e)}"></span>`).join(``)}</div>`:`<div class="dtag">${d(e.a||`Skill`)}</div>`;return`<div class="dtile"><strong>#${p(e.i)}</strong> ${d(e.l)}${t}</div>`}).join(``),a=`/store-assets/covers/${encodeURIComponent(n.slug)}.webp`,o=`/store-assets/posters/${encodeURIComponent(n.slug)}.webp`;c.innerHTML=`
      <div class="dlg-head">
        <h2>#${p(n.num)} — ${d(n.title)}</h2>
        <div class="dlg-actions">
          <a class="btn btn-primary" href="/api/store/buy?pack=${encodeURIComponent(n.slug)}">${d(t.buyBtn)}</a>
          <a class="btn btn-secondary" href="${o}" target="_blank" rel="noopener">${d(t.posterLabel)}</a>
          <button type="button" class="btn btn-secondary" data-close="1">${d(t.closeBtn)}</button>
        </div>
      </div>
      <div class="dlg-media">
        <img src="${a}" alt="${d(n.title)}" />
        <a href="${o}" target="_blank" rel="noopener"><img src="${o}" alt="101 items poster" /></a>
      </div>
      <h3>${d(t.itemsHeading)}</h3>
      <div class="dlg-items">${i}</div>
    `,typeof s.showModal==`function`?s.showModal():s.setAttribute(`open`,``)}r.addEventListener(`click`,e=>{let t=e.target.closest(`button[data-cat]`);if(t){u=t.dataset.cat||`all`;for(let e of r.querySelectorAll(`.pill`))e.classList.toggle(`active`,e===t);h()}}),i.addEventListener(`input`,h),n.addEventListener(`click`,e=>{let t=e.target.closest(`[data-preview]`);t&&g(Number(t.dataset.preview))}),s.addEventListener(`click`,e=>{let t=e.target;(t===s||t.closest(`[data-close]`))&&s.close()});async function _(){let e=new URLSearchParams(location.search),n=e.get(`session_id`)||``,r=e.get(`activating`),i=e.get(`pack`)||``;if(r&&i){let e=l.find(e=>e.slug===i);o.hidden=!1,o.innerHTML=`<p>${d(t.orderActivating)}</p>${e?.gumroad_url?`<a class="btn btn-secondary" href="${d(e.gumroad_url)}" target="_blank" rel="noopener">${d(t.gumroadBtn)}</a>`:``}`}else if(/^cs_(live|test)_/.test(n)){o.hidden=!1,o.textContent=t.orderChecking;for(let e=0;e<12;e++){try{let e=await fetch(`/api/store/order?session_id=${encodeURIComponent(n)}`);if(e.ok){let n=await e.json();if(n.paid&&n.downloadUrl){o.classList.add(`ok`),o.innerHTML=`
              <div class="store-banner-row">
                <div><strong>${d(t.orderReady)}</strong> ${d(n.title)} (${d(n.zipMb)} MB)</div>
                <a class="btn btn-primary" href="${d(n.downloadUrl)}">${d(t.orderDownload)} (${d(n.zipMb)} MB)</a>
              </div>
            `;let e=document.createElement(`a`);e.href=n.downloadUrl,e.download=`${n.slug}.zip`,document.body.appendChild(e),e.click(),e.remove();return}}}catch{}await new Promise(e=>setTimeout(e,1200))}o.textContent=t.orderPending}}(async()=>{l=await(await fetch(`/store-assets/catalog.json`)).json(),m(),h(),_()})();