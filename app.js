(function () {
  "use strict";

  const FIELD_NAMES = ["NOME", "SOPRANNOME", "CITTA", "CATEGORIA", "FOTO"];
  const INITIAL_VISIBLE_COUNT = 50;
  const LOAD_MORE_COUNT = 50;
  const SCREENSAVER_STORAGE_KEY = "medaScreensaverSettings";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const config = window.DONOR_WALL_CONFIG || {};

  const state = {
    donors: [],
    filtered: [],
    visibleLimit: INITIAL_VISIBLE_COUNT,
    filters: {
      global: "",
      letter: "",
      name: "",
      nickname: "",
      city: "",
      category: ""
    }
  };

  const els = {
    alphabetBar: document.getElementById("alphabetBar"),
    globalSearch: document.getElementById("globalSearch"),
    nameFilter: document.getElementById("nameFilter"),
    nicknameFilter: document.getElementById("nicknameFilter"),
    cityFilter: document.getElementById("cityFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    resetButton: document.getElementById("resetButton"),
    results: document.getElementById("results"),
    resultCount: document.getElementById("resultCount"),
    titleCounter: document.getElementById("titleCounter"),
    sourceStatus: document.getElementById("sourceStatus"),
    cardTemplate: document.getElementById("cardTemplate"),
    detailDialog: document.getElementById("detailDialog"),
    detailContent: document.getElementById("detailContent"),
    closeDetail: document.getElementById("closeDetail"),
    settingsButton: document.getElementById("settingsButton"),
    settingsPanel: document.getElementById("settingsPanel"),
    closeSettings: document.getElementById("closeSettings"),
    screensaverEnabled: document.getElementById("screensaverEnabled"),
    screensaverMode: document.getElementById("screensaverMode"),
    screensaverIdle: document.getElementById("screensaverIdle"),
    screensaverSlide: document.getElementById("screensaverSlide"),
    screensaver: document.getElementById("screensaver"),
    screensaverContent: document.getElementById("screensaverContent")
  };

  let loadObserver;
  let inactivityTimer;
  let screensaverTimer;
  let lastScreensaverDonorId = "";

  const screensaverSettings = loadScreensaverSettings();

  const thankYouMessages = [
    "Grazie per aver contribuito alla tutela della memoria, della storia e dell'identita della nostra comunita.",
    "Grazie al tuo contributo, il patrimonio culturale locale puo essere conservato e trasmesso alle future generazioni.",
    "Ogni donazione rappresenta un gesto concreto di amore verso la storia e le tradizioni del territorio. Il Museo ringrazia.",
    "Grazie per aver aiutato il Museo a custodire e valorizzare la memoria collettiva della comunita di Aquilonia.",
    "Grazie per il tuo contributo alla salvaguardia della cultura e delle testimonianze del nostro territorio."
  ];

  const demoRecords = [
    {
      id: "demo-1",
      fields: {
        NOME: "Rossi Mario",
        SOPRANNOME: "Il Falegname",
        CITTA: "Aquilonia",
        CATEGORIA: "Oggetti domestici"
      }
    },
    {
      id: "demo-2",
      fields: {
        NOME: "Bianchi Anna",
        CITTA: "Napoli",
        CATEGORIA: "Fotografie"
      }
    },
    {
      id: "demo-3",
      fields: {
        NOME: "De Luca Antonio",
        SOPRANNOME: "Tonino",
        CITTA: "Aquilonia",
        CATEGORIA: "Documenti"
      }
    },
    {
      id: "demo-4",
      fields: {
        NOME: "Verdi Lucia",
        SOPRANNOME: "Lucietta",
        CITTA: "Lacedonia",
        CATEGORIA: "Strumenti di lavoro"
      }
    }
  ];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isPresent(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function getSurname(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "";
  }

  function getAttachmentUrl(value) {
    if (!isPresent(value)) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value[0]) {
      return (
        value[0].url ||
        value[0].thumbnails?.full?.url ||
        value[0].thumbnails?.large?.url ||
        value[0].thumbnails?.small?.url ||
        ""
      );
    }
    if (typeof value === "object") {
      return (
        value.url ||
        value.thumbnails?.full?.url ||
        value.thumbnails?.large?.url ||
        value.thumbnails?.small?.url ||
        ""
      );
    }
    return "";
  }

  function mapRecord(record) {
    const fields = record.fields || record;
    return {
      id: record.id || crypto.randomUUID(),
      NOME: fields.NOME || "",
      SOPRANNOME: fields.SOPRANNOME || "",
      CITTA: fields.CITTA || "",
      CATEGORIA: fields.CATEGORIA || "",
      FOTO: fields.FOTO || "",
      raw: fields
    };
  }

  function buildAlphabet() {
    letters.forEach((letter) => {
      const button = document.createElement("button");
      button.className = "letter-button";
      button.type = "button";
      button.dataset.letter = letter;
      button.textContent = letter;
      els.alphabetBar.appendChild(button);
    });
  }

  function bindEvents() {
    els.globalSearch.addEventListener("input", (event) => {
      state.filters.global = event.target.value;
      applyFilters();
    });
    els.nameFilter.addEventListener("input", (event) => {
      state.filters.name = event.target.value;
      applyFilters();
    });
    els.nicknameFilter.addEventListener("input", (event) => {
      state.filters.nickname = event.target.value;
      applyFilters();
    });
    els.cityFilter.addEventListener("input", (event) => {
      state.filters.city = event.target.value;
      applyFilters();
    });
    els.categoryFilter.addEventListener("change", (event) => {
      state.filters.category = event.target.value;
      applyFilters();
    });
    document.querySelector(".alphabet-wrap").addEventListener("click", (event) => {
      const button = event.target.closest("[data-letter]");
      if (!button) return;
      state.filters.letter = button.dataset.letter;
      updateActiveLetter();
      applyFilters();
    });
    els.resetButton.addEventListener("click", resetFilters);
    els.closeDetail.addEventListener("click", () => els.detailDialog.close());
    els.detailDialog.addEventListener("click", (event) => {
      if (event.target === els.detailDialog) {
        els.detailDialog.close();
      }
    });
    els.settingsButton.addEventListener("click", toggleSettingsPanel);
    els.closeSettings.addEventListener("click", closeSettingsPanel);
    els.screensaverEnabled.addEventListener("change", updateScreensaverSettings);
    els.screensaverMode.addEventListener("change", updateScreensaverSettings);
    els.screensaverIdle.addEventListener("change", updateScreensaverSettings);
    els.screensaverSlide.addEventListener("change", updateScreensaverSettings);
    ["pointerdown", "wheel", "scroll", "keydown", "input"].forEach((eventName) => {
      document.addEventListener(eventName, handleUserActivity, { passive: true });
    });
  }

  function loadScreensaverSettings() {
    const defaults = {
      enabled: true,
      mode: "detail",
      idleMs: 60000,
      slideMs: 10000
    };

    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem(SCREENSAVER_STORAGE_KEY) || "{}")
      };
    } catch {
      return defaults;
    }
  }

  function applyScreensaverSettingsToControls() {
    els.screensaverEnabled.checked = Boolean(screensaverSettings.enabled);
    els.screensaverMode.value = screensaverSettings.mode;
    els.screensaverIdle.value = String(screensaverSettings.idleMs);
    els.screensaverSlide.value = String(screensaverSettings.slideMs);
  }

  function updateScreensaverSettings() {
    screensaverSettings.enabled = els.screensaverEnabled.checked;
    screensaverSettings.mode = els.screensaverMode.value;
    screensaverSettings.idleMs = Number(els.screensaverIdle.value);
    screensaverSettings.slideMs = Number(els.screensaverSlide.value);
    localStorage.setItem(SCREENSAVER_STORAGE_KEY, JSON.stringify(screensaverSettings));
    if (!screensaverSettings.enabled) {
      stopScreensaver();
    }
    resetInactivityTimer();
  }

  function toggleSettingsPanel() {
    const shouldOpen = els.settingsPanel.hidden;
    els.settingsPanel.hidden = !shouldOpen;
    els.settingsButton.setAttribute("aria-expanded", String(shouldOpen));
    resetInactivityTimer();
  }

  function closeSettingsPanel() {
    els.settingsPanel.hidden = true;
    els.settingsButton.setAttribute("aria-expanded", "false");
    resetInactivityTimer();
  }

  function handleUserActivity() {
    if (!els.screensaver.hidden) {
      stopScreensaver();
    }
    resetInactivityTimer();
  }

  function resetInactivityTimer() {
    window.clearTimeout(inactivityTimer);
    if (!screensaverSettings.enabled || !state.donors.length) return;
    inactivityTimer = window.setTimeout(startScreensaver, screensaverSettings.idleMs);
  }

  function startScreensaver() {
    if (!screensaverSettings.enabled || !state.donors.length) return;
    closeSettingsPanel();
    renderScreensaverDonor();
    els.screensaver.hidden = false;
    document.body.classList.add("screensaver-active");
    window.clearInterval(screensaverTimer);
    screensaverTimer = window.setInterval(renderScreensaverDonor, screensaverSettings.slideMs);
  }

  function stopScreensaver() {
    window.clearInterval(screensaverTimer);
    screensaverTimer = undefined;
    els.screensaver.hidden = true;
    els.screensaverContent.replaceChildren();
    document.body.classList.remove("screensaver-active");
  }

  function renderScreensaverDonor() {
    const donor = getRandomScreensaverDonor();
    if (!donor) return;
    if (screensaverSettings.mode === "honor") {
      renderHonorGalleryDonor(donor);
      return;
    }

    const card = document.createElement("article");
    card.className = getAttachmentUrl(donor.FOTO) ? "screensaver-card" : "screensaver-card no-image";

    const imageUrl = getAttachmentUrl(donor.FOTO);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "screensaver-image";
      image.src = imageUrl;
      image.alt = donor.NOME ? `Foto di ${donor.NOME}` : "Foto donatore";
      card.appendChild(image);
    }

    const info = document.createElement("div");
    info.className = "screensaver-info";

    const title = document.createElement("h2");
    title.className = "screensaver-title";
    title.textContent = donor.NOME;
    info.appendChild(title);

    const thanks = document.createElement("p");
    thanks.className = "screensaver-thanks";
    thanks.textContent = getRandomThankYouMessage();
    info.appendChild(thanks);

    const list = document.createElement("dl");
    list.className = "screensaver-list";
    FIELD_NAMES.filter((fieldName) => fieldName !== "FOTO" && isPresent(donor[fieldName])).forEach(
      (fieldName) => {
        const row = document.createElement("div");
        row.className = "screensaver-row";

        const term = document.createElement("dt");
        term.textContent = labelFor(fieldName);

        const description = document.createElement("dd");
        description.textContent = donor[fieldName];

        row.append(term, description);
        list.appendChild(row);
      }
    );
    info.appendChild(list);
    card.appendChild(info);

    els.screensaverContent.replaceChildren(card);
  }

  function renderHonorGalleryDonor(donor) {
    const imageUrl = getAttachmentUrl(donor.FOTO);
    const card = document.createElement("article");
    card.className = imageUrl ? "honor-card" : "honor-card no-image";

    const content = document.createElement("div");
    content.className = "honor-content";

    const label = document.createElement("p");
    label.className = "honor-label";
    label.textContent = "Galleria d'Onore dei Donatori";
    content.appendChild(label);

    const title = document.createElement("h2");
    title.className = "honor-title";
    title.textContent = donor.NOME;
    content.appendChild(title);

    const thanks = document.createElement("p");
    thanks.className = "honor-thanks";
    thanks.textContent = getRandomThankYouMessage();
    content.appendChild(thanks);

    const metaItems = [donor.SOPRANNOME, donor.CITTA, donor.CATEGORIA].filter(isPresent);
    if (metaItems.length) {
      const meta = document.createElement("p");
      meta.className = "honor-meta";
      meta.textContent = metaItems.join(" · ");
      content.appendChild(meta);
    }

    card.appendChild(content);

    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "honor-image";
      image.src = imageUrl;
      image.alt = donor.NOME ? `Foto di ${donor.NOME}` : "Foto donatore";
      card.appendChild(image);
    }

    els.screensaverContent.replaceChildren(card);
  }

  function getRandomScreensaverDonor() {
    if (!state.donors.length) return null;
    const candidates =
      state.donors.length > 1
        ? state.donors.filter((donor) => donor.id !== lastScreensaverDonorId)
        : state.donors;
    const donor = candidates[Math.floor(Math.random() * candidates.length)];
    lastScreensaverDonorId = donor.id;
    return donor;
  }

  function resetFilters() {
    state.filters = {
      global: "",
      letter: "",
      name: "",
      nickname: "",
      city: "",
      category: ""
    };
    els.globalSearch.value = "";
    els.nameFilter.value = "";
    els.nicknameFilter.value = "";
    els.cityFilter.value = "";
    els.categoryFilter.value = "";
    updateActiveLetter();
    applyFilters();
  }

  function updateActiveLetter() {
    document.querySelectorAll("[data-letter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.letter === state.filters.letter);
    });
  }

  function updateAvailableLetters() {
    const availableLetters = new Set(
      state.donors
        .map((donor) => normalize(getSurname(donor.NOME)).charAt(0).toUpperCase())
        .filter(Boolean)
    );

    document.querySelectorAll("[data-letter]").forEach((button) => {
      const letter = button.dataset.letter;
      const isAllButton = letter === "";
      const isAvailable = isAllButton || availableLetters.has(letter);
      button.disabled = !isAvailable;
      button.setAttribute(
        "aria-label",
        isAvailable
          ? isAllButton
            ? "Mostra tutti i donatori"
            : `Filtra cognomi per ${letter}`
          : `Nessun cognome per ${letter}`
      );
    });
  }

  function populateCategories() {
    const categories = [...new Set(state.donors.map((donor) => donor.CATEGORIA).filter(isPresent))]
      .sort((a, b) => String(a).localeCompare(String(b), "it"));

    els.categoryFilter.innerHTML = '<option value="">Tutte</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      els.categoryFilter.appendChild(option);
    });
  }

  function applyFilters() {
    const globalQuery = normalize(state.filters.global);
    const nameQuery = normalize(state.filters.name);
    const nicknameQuery = normalize(state.filters.nickname);
    const cityQuery = normalize(state.filters.city);
    const categoryQuery = normalize(state.filters.category);
    state.visibleLimit = INITIAL_VISIBLE_COUNT;

    state.filtered = state.donors.filter((donor) => {
      const surname = normalize(getSurname(donor.NOME));
      const searchable = normalize(
        [donor.NOME, donor.SOPRANNOME, donor.CITTA, donor.CATEGORIA].join(" ")
      );

      return (
        (!globalQuery || searchable.includes(globalQuery)) &&
        (!state.filters.letter || surname.startsWith(normalize(state.filters.letter))) &&
        (!nameQuery || normalize(donor.NOME).includes(nameQuery)) &&
        (!nicknameQuery || normalize(donor.SOPRANNOME).includes(nicknameQuery)) &&
        (!cityQuery || normalize(donor.CITTA).includes(cityQuery)) &&
        (!categoryQuery || normalize(donor.CATEGORIA) === categoryQuery)
      );
    });

    renderResults();
  }

  function updateTitleCounter(count) {
    const total = state.donors.length;
    if (!total) {
      els.titleCounter.textContent = "";
      return;
    }

    const visibleCount = Math.min(state.visibleLimit, count);
    if (visibleCount < count) {
      els.titleCounter.textContent = `(${visibleCount} schede visualizzate su ${count} donatori)`;
      return;
    }

    els.titleCounter.textContent =
      count === total ? `(${total} donatori)` : `(${count} donatori visualizzati su ${total})`;
  }

  function renderResults() {
    els.results.replaceChildren();

    const count = state.filtered.length;
    updateTitleCounter(count);
    els.resultCount.textContent =
      count === 1 ? "1 donatore trovato" : `${count} donatori trovati`;

    disconnectLoadObserver();

    if (!count) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nessun donatore corrisponde ai filtri selezionati.";
      els.results.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.filtered.slice(0, state.visibleLimit).forEach((donor) => {
      const node = els.cardTemplate.content.cloneNode(true);
      const card = node.querySelector(".donor-card");
      node.querySelector(".donor-name").textContent = donor.NOME;
      const nickname = node.querySelector(".donor-nickname");
      if (isPresent(donor.SOPRANNOME)) {
        nickname.textContent = donor.SOPRANNOME;
      } else {
        nickname.remove();
      }
      card.setAttribute("aria-label", `Apri scheda di ${donor.NOME}`);
      card.addEventListener("click", () => openDetail(donor));
      fragment.appendChild(node);
    });

    if (state.visibleLimit < state.filtered.length) {
      const sentinel = document.createElement("div");
      sentinel.className = "load-sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      fragment.appendChild(sentinel);
    }

    els.results.appendChild(fragment);
    observeLoadSentinel();
  }

  function observeLoadSentinel() {
    const sentinel = els.results.querySelector(".load-sentinel");
    if (!sentinel) return;

    loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        state.visibleLimit += LOAD_MORE_COUNT;
        renderResults();
      },
      { rootMargin: "600px 0px" }
    );
    loadObserver.observe(sentinel);
  }

  function disconnectLoadObserver() {
    if (!loadObserver) return;
    loadObserver.disconnect();
    loadObserver = undefined;
  }

  function openDetail(donor) {
    const imageUrl = getAttachmentUrl(donor.FOTO);
    const detailRows = FIELD_NAMES.filter((fieldName) => {
      return fieldName !== "NOME" && fieldName !== "FOTO" && isPresent(donor[fieldName]);
    });

    els.detailContent.replaceChildren();

    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "detail-image";
      image.src = imageUrl;
      image.alt = donor.NOME ? `Foto di ${donor.NOME}` : "Foto donatore";
      els.detailContent.appendChild(image);
    }

    const title = document.createElement("h2");
    title.id = "detailTitle";
    title.className = "detail-title";
    title.textContent = donor.NOME || "Scheda donatore";
    els.detailContent.appendChild(title);

    const thankYouBox = document.createElement("div");
    thankYouBox.className = "thank-you-box";
    thankYouBox.textContent = getRandomThankYouMessage();
    els.detailContent.appendChild(thankYouBox);

    const list = document.createElement("dl");
    list.className = "detail-list";
    detailRows.forEach((fieldName) => {
      const row = document.createElement("div");
      row.className = "detail-row";

      const term = document.createElement("dt");
      term.textContent = labelFor(fieldName);

      const description = document.createElement("dd");
      description.textContent = donor[fieldName];

      row.append(term, description);
      list.appendChild(row);
    });
    els.detailContent.appendChild(list);

    if (typeof els.detailDialog.showModal === "function") {
      els.detailDialog.showModal();
      scrollDetailIntoView();
    } else {
      alert(detailRows.map((name) => `${labelFor(name)}: ${donor[name]}`).join("\n"));
    }
  }

  function getRandomThankYouMessage() {
    const index = Math.floor(Math.random() * thankYouMessages.length);
    return thankYouMessages[index];
  }

  function scrollDetailIntoView() {
    window.requestAnimationFrame(() => {
      els.detailDialog.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    });
  }

  function labelFor(fieldName) {
    const labels = {
      NOME: "Nome",
      SOPRANNOME: "Soprannome",
      CITTA: "Città",
      CATEGORIA: "Categoria"
    };
    return labels[fieldName] || fieldName;
  }

  async function fetchAirtableRecords() {
    const airtable = config.airtable || {};
    if (!airtable.enabled) {
      return { records: demoRecords, source: "Modalità demo: dati Airtable non collegati" };
    }

    if (airtable.proxyUrl) {
      const response = await fetch(airtable.proxyUrl);
      if (!response.ok) throw new Error("Proxy Airtable non raggiungibile.");
      return { records: await response.json(), source: "Airtable" };
    }

    if (!airtable.baseId || !airtable.tableNameOrId || !airtable.token) {
      throw new Error("Config Airtable incompleta: base, tabella e token sono obbligatori.");
    }

    const records = [];
    let offset = "";
    do {
      const url = new URL(
        `https://api.airtable.com/v0/${airtable.baseId}/${encodeURIComponent(
          airtable.tableNameOrId
        )}`
      );
      url.searchParams.set("pageSize", "100");
      FIELD_NAMES.forEach((field) => url.searchParams.append("fields[]", field));
      if (airtable.viewNameOrId) url.searchParams.set("view", airtable.viewNameOrId);
      if (offset) url.searchParams.set("offset", offset);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${airtable.token}`
        }
      });
      if (!response.ok) {
        throw new Error(`Errore Airtable: ${response.status}`);
      }
      const page = await response.json();
      records.push(...(page.records || []));
      offset = page.offset || "";
    } while (offset);

    return { records, source: "Airtable" };
  }

  function showError(error) {
    els.resultCount.textContent = "Impossibile caricare i donatori.";
    els.sourceStatus.textContent = "";
    const message = document.createElement("p");
    message.className = "error-state";
    message.textContent = error.message;
    els.results.replaceChildren(message);
  }

  async function init() {
    buildAlphabet();
    bindEvents();
    applyScreensaverSettingsToControls();

    try {
      const { records, source } = await fetchAirtableRecords();
      state.donors = records
        .map(mapRecord)
        .filter((donor) => isPresent(donor.NOME))
        .sort((a, b) => getSurname(a.NOME).localeCompare(getSurname(b.NOME), "it"));
      els.sourceStatus.textContent = source;
      updateAvailableLetters();
      populateCategories();
      applyFilters();
      resetInactivityTimer();
    } catch (error) {
      showError(error);
    }
  }

  init();
})();
