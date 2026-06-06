(function () {
  const list = document.querySelector("[data-prompt-list]");
  const detail = document.querySelector("[data-prompt-detail]");
  const searchInput = document.querySelector("[data-prompt-search]");
  const sortSelect = document.querySelector("[data-prompt-sort]");
  const modelSelect = document.querySelector("[data-model-filter]");
  const fieldFilterSelect = document.querySelector("[data-prompt-filter-select]");
  const statCount = document.querySelector("[data-prompt-count]");
  const visibilityButtons = Array.from(document.querySelectorAll("[data-visibility-filter]"));
  const viewButtons = Array.from(document.querySelectorAll("[data-view-mode]"));

  if (!list || !detail) {
    return;
  }

  let prompts = [];
  let activePrompt = null;
  let activeImageMode = "portrait";
  let filter = "all";
  let visibilityFilter = "all";
  let modelFilter = "all";
  let viewMode = "list";
  let sortMode = "visibility";
  let query = "";
  const enhancedSelects = new Map();

  const segmentLabels = {
    role: "角色",
    clothing: "服装",
    action: "动作",
    background: "背景",
    camera: "镜头",
    other: "其他"
  };
  const redactionMarker = "[[REDACTED]]";

  function textOf(value) {
    return (value || "").trim();
  }

  function escapeHtml(value) {
    return textOf(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function searchableText(prompt) {
    return [
      prompt.title,
      prompt.time,
      prompt.status,
      prompt.model,
      ...Object.values(prompt.segments || {})
    ].join(" ").toLowerCase();
  }

  function hasSegment(prompt, key) {
    return Boolean(textOf(prompt.segments && prompt.segments[key]));
  }

  function isRestricted(prompt) {
    return prompt.visibility !== "public" || Boolean(prompt.restrictedSegments && prompt.restrictedSegments.length);
  }

  function previewLabel(prompt) {
    if (prompt.visibility === "nsfw-restricted") {
      return "NSFW限制";
    }

    if (prompt.visibility === "swimwear-restricted") {
      return "泳装限制";
    }

    return "公开";
  }

  function visibilityClass(prompt) {
    return `prompt-state-${String(prompt.visibility || "public").replace(/[^a-z0-9-]/gi, "")}`;
  }

  function visibilityRank(prompt) {
    return {
      public: 0,
      "swimwear-restricted": 1,
      "nsfw-restricted": 2
    }[prompt.visibility] ?? 3;
  }

  function timeValue(prompt) {
    const parsed = Date.parse(prompt.time || "");
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function comparePrompts(a, b) {
    switch (sortMode) {
      case "id-asc":
        return a.id.localeCompare(b.id);
      case "id-desc":
        return b.id.localeCompare(a.id);
      case "time-desc":
        return timeValue(b) - timeValue(a) || a.id.localeCompare(b.id);
      case "time-asc":
        return timeValue(a) - timeValue(b) || a.id.localeCompare(b.id);
      case "restricted-first": {
        const rankDiff = visibilityRank(b) - visibilityRank(a);
        return rankDiff || a.id.localeCompare(b.id);
      }
      case "title-asc":
        return textOf(a.title).localeCompare(textOf(b.title)) || a.id.localeCompare(b.id);
      case "visibility":
      default: {
        const rankDiff = visibilityRank(a) - visibilityRank(b);
        return rankDiff || a.id.localeCompare(b.id);
      }
    }
  }

  function closeCustomSelects(exceptRoot) {
    enhancedSelects.forEach(({ root, button }) => {
      if (root === exceptRoot) {
        return;
      }

      root.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
  }

  function syncCustomSelect(select) {
    const enhanced = enhancedSelects.get(select);
    if (!enhanced) {
      return;
    }

    const { button, menu } = enhanced;
    const selected = select.selectedOptions[0] || select.options[0];
    button.querySelector("span").textContent = selected ? selected.textContent : "";
    menu.innerHTML = "";

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "prompt-custom-option";
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", option.selected ? "true" : "false");
      item.classList.toggle("is-selected", option.selected);
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeCustomSelects();
      });
      menu.appendChild(item);
    });
  }

  function enhanceSelect(select) {
    if (!select) {
      return;
    }

    if (enhancedSelects.has(select)) {
      syncCustomSelect(select);
      return;
    }

    select.classList.add("prompt-native-select");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const root = document.createElement("div");
    root.className = "prompt-custom-select";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prompt-custom-trigger";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = "<span></span>";
    const menu = document.createElement("div");
    menu.className = "prompt-custom-menu";
    menu.setAttribute("role", "listbox");
    root.append(button, menu);
    select.insertAdjacentElement("afterend", root);
    enhancedSelects.set(select, { root, button, menu });

    button.addEventListener("click", () => {
      const shouldOpen = !root.classList.contains("is-open");
      closeCustomSelects(root);
      root.classList.toggle("is-open", shouldOpen);
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCustomSelects();
        button.focus();
      }
    });

    syncCustomSelect(select);
  }

  function populateModelOptions() {
    if (!modelSelect) {
      return;
    }

    const models = Array.from(new Set(prompts.map((prompt) => textOf(prompt.model)).filter(Boolean))).sort();
    modelSelect.innerHTML = '<option value="all">全部模型</option>';
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    if (!models.includes(modelFilter)) {
      modelFilter = "all";
      modelSelect.value = "all";
    }

    enhanceSelect(modelSelect);
  }

  function policyLabel(prompt) {
    if (prompt.visibility === "nsfw-restricted") {
      return "NSFW限制 · 图片高模糊 · 敏感片段占位";
    }

    if (prompt.visibility === "swimwear-restricted") {
      return "泳装限制 · 图片模糊 · prompt公开";
    }

    return "公开 · 正常预览";
  }

  function visiblePrompts() {
    return prompts.filter((prompt) => {
      const passesFilter = filter === "all" || hasSegment(prompt, filter);
      const passesVisibility = visibilityFilter === "all" || prompt.visibility === visibilityFilter;
      const passesModel = modelFilter === "all" || prompt.model === modelFilter;
      const passesQuery = !query || searchableText(prompt).includes(query);
      return passesFilter && passesVisibility && passesModel && passesQuery;
    }).sort(comparePrompts);
  }

  function publicCopy(prompt, keys) {
    if (prompt.copyable === false) {
      return "";
    }

    return keys
      .map((key) => {
        const value = textOf(prompt.segments && prompt.segments[key]).replaceAll(redactionMarker, "[受限]");
        return value ? `${segmentLabels[key]}: ${value}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function renderSegmentValue(value) {
    const text = textOf(value);
    if (!text) {
      return "未记录公开字段。";
    }

    return text.split(redactionMarker).map((part, index, parts) => {
      const escaped = escapeHtml(part);
      if (index === parts.length - 1) {
        return escaped;
      }

      return `${escaped}<span class="prompt-inline-redaction" aria-label="受限内容"></span>`;
    }).join("");
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }

    return copied;
  }

  async function copyText(text, button) {
    if (!text) {
      button.textContent = button.dataset.emptyLabel || "无公开字段";
      window.setTimeout(() => {
        button.textContent = button.dataset.label || "复制";
      }, 1000);
      return;
    }

    let copied = false;
    try {
      copied = await writeClipboard(text);
    } catch (error) {
      copied = false;
    }

    button.textContent = copied ? "已复制" : "复制失败";
    window.setTimeout(() => {
      button.textContent = button.dataset.label || "复制";
    }, copied ? 1000 : 1600);
  }

  function renderList() {
    const next = visiblePrompts();

    if (statCount) {
      statCount.textContent = `${next.length} / ${prompts.length}`;
    }

    list.innerHTML = "";
    list.className = `prompt-list is-${viewMode}-view`;

    next.forEach((prompt) => {
      const card = document.createElement("button");
      const isCardView = viewMode !== "list";
      const imageMode = viewMode === "landscape" ? "landscape" : "portrait";
      card.className = isCardView ? "prompt-row prompt-card-view" : "prompt-row";
      card.type = "button";
      card.dataset.id = prompt.id;
      card.classList.toggle("is-active", activePrompt && activePrompt.id === prompt.id);

      const image = document.createElement("img");
      image.src = prompt.images && (prompt.images[imageMode] || prompt.images.portrait || prompt.images.landscape);
      image.alt = "";

      const body = document.createElement("span");
      body.className = "prompt-row-body";
      body.innerHTML = `
        <strong>${escapeHtml(prompt.title)}</strong>
        <small>${escapeHtml(prompt.model)} · ${escapeHtml(prompt.status)} · ${escapeHtml(prompt.time || "未记录时间")}</small>
        <span class="prompt-row-tags">
          ${Object.keys(segmentLabels).filter((key) => hasSegment(prompt, key)).slice(0, 4).map((key) => `<em>${segmentLabels[key]}</em>`).join("")}
          <em class="${visibilityClass(prompt)}">${previewLabel(prompt)}</em>
        </span>
      `;

      card.append(image, body);
      card.addEventListener("click", () => setActive(prompt.id));
      list.appendChild(card);
    });

    if (!next.length) {
      list.innerHTML = '<p class="prompt-empty">没有符合条件的公开 prompt。</p>';
    }
  }

  function renderDetail() {
    if (!activePrompt) {
      detail.innerHTML = '<p class="prompt-empty">选择一条 prompt 查看公开字段。</p>';
      return;
    }

    const image = activePrompt.images && (activePrompt.images[activeImageMode] || activePrompt.images.portrait || activePrompt.images.landscape);
    const copyDisabled = activePrompt.copyable === false;
    const segmentHtml = Object.keys(segmentLabels).map((key) => {
      const value = textOf(activePrompt.segments && activePrompt.segments[key]);
      const restricted = activePrompt.restrictedSegments && activePrompt.restrictedSegments.includes(key);
      return `
        <section class="prompt-segment ${value ? "" : "is-muted"} ${restricted ? "has-inline-redaction" : ""}">
          <h3>${segmentLabels[key]}</h3>
          <p>${renderSegmentValue(value)}</p>
        </section>
      `;
    }).join("");

    detail.innerHTML = `
      <div class="prompt-detail-head">
        <div>
          <p>Prompt Archive</p>
          <h2>${escapeHtml(activePrompt.title)}</h2>
        </div>
        <span>${escapeHtml(activePrompt.status)}</span>
      </div>
      <div class="prompt-preview">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(activePrompt.title)} 公开缩略图">
      </div>
      <div class="prompt-image-toggle" aria-label="图片方向">
        <button type="button" data-image-mode="portrait" class="${activeImageMode === "portrait" ? "is-active" : ""}">竖图</button>
        <button type="button" data-image-mode="landscape" class="${activeImageMode === "landscape" ? "is-active" : ""}">横图</button>
      </div>
      <dl class="prompt-meta">
        <div><dt>模型</dt><dd>${escapeHtml(activePrompt.model)}</dd></div>
        <div><dt>时间</dt><dd>${escapeHtml(activePrompt.time || "未记录")}</dd></div>
        <div><dt>公开策略</dt><dd>${policyLabel(activePrompt)}</dd></div>
      </dl>
      <div class="prompt-copy-actions">
        <button type="button" data-copy="character" data-label="复制角色设定" data-empty-label="${copyDisabled ? "该条 prompt 未公开" : "无公开字段"}">复制角色设定</button>
        <button type="button" data-copy="scene" data-label="复制镜头/背景" data-empty-label="${copyDisabled ? "该条 prompt 未公开" : "无公开字段"}">复制镜头/背景</button>
        <button type="button" data-copy="all" data-label="复制公开组合" data-empty-label="${copyDisabled ? "该条 prompt 未公开" : "无公开字段"}">复制公开组合</button>
      </div>
      <p class="prompt-policy">${escapeHtml(activePrompt.notes || "完整原文未公开。")}</p>
      <div class="prompt-segments">${segmentHtml}</div>
    `;

    detail.querySelectorAll("[data-image-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        activeImageMode = button.dataset.imageMode || "portrait";
        renderDetail();
      });
    });

    detail.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.copy;
        const keys = mode === "character"
          ? ["role", "clothing", "action"]
          : mode === "scene"
            ? ["background", "camera"]
            : ["role", "clothing", "action", "background", "camera", "other"];
        copyText(publicCopy(activePrompt, keys), button);
      });
    });
  }

  function setActive(id) {
    activePrompt = prompts.find((prompt) => prompt.id === id) || prompts[0] || null;
    activeImageMode = "portrait";
    renderList();
    renderDetail();
  }

  visibilityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      visibilityFilter = button.dataset.visibilityFilter || "all";
      visibilityButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      const next = visiblePrompts();
      if (!next.some((prompt) => activePrompt && prompt.id === activePrompt.id)) {
        activePrompt = next[0] || prompts[0] || null;
      }
      renderList();
      renderDetail();
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      viewMode = button.dataset.viewMode || "list";
      viewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderList();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      const next = visiblePrompts();
      if (!next.some((prompt) => activePrompt && prompt.id === activePrompt.id)) {
        activePrompt = next[0] || prompts[0] || null;
      }
      renderList();
      renderDetail();
    });
  }

  if (fieldFilterSelect) {
    enhanceSelect(fieldFilterSelect);
    fieldFilterSelect.addEventListener("change", () => {
      filter = fieldFilterSelect.value || "all";
      syncCustomSelect(fieldFilterSelect);
      const next = visiblePrompts();
      if (!next.some((prompt) => activePrompt && prompt.id === activePrompt.id)) {
        activePrompt = next[0] || prompts[0] || null;
      }
      renderList();
      renderDetail();
    });
  }

  if (sortSelect) {
    enhanceSelect(sortSelect);
    sortSelect.addEventListener("change", () => {
      sortMode = sortSelect.value || "visibility";
      syncCustomSelect(sortSelect);
      const next = visiblePrompts();
      if (!next.some((prompt) => activePrompt && prompt.id === activePrompt.id)) {
        activePrompt = next[0] || prompts[0] || null;
      }
      renderList();
      renderDetail();
    });
  }

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      modelFilter = modelSelect.value || "all";
      syncCustomSelect(modelSelect);
      const next = visiblePrompts();
      if (!next.some((prompt) => activePrompt && prompt.id === activePrompt.id)) {
        activePrompt = next[0] || prompts[0] || null;
      }
      renderList();
      renderDetail();
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".prompt-custom-select")) {
      closeCustomSelects();
    }
  });

  function loadData(data) {
    prompts = data.prompts || [];
    populateModelOptions();
    activePrompt = visiblePrompts()[0] || prompts[0] || null;
    renderList();
    renderDetail();
  }

  if (window.PROMPT_ARCHIVE_DATA) {
    loadData(window.PROMPT_ARCHIVE_DATA);
  } else {
    fetch("data/prompts-public.json")
      .then((response) => response.json())
      .then(loadData)
      .catch(() => {
        list.innerHTML = '<p class="prompt-empty">公开 prompt 数据加载失败。</p>';
      });
  }
})();
