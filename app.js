const CONFIGS_KEY = "aiviewmanager.configs";
const CURRENT_CONFIG_KEY = "aiviewmanager.current_config";
const VIEW_HISTORY_KEY = "aiviewmanager.view_history";

const DEFAULT_SETTINGS = {
  apiKey: "",
  project: "",
  openaiKey: "",
  openaiModel: "gpt-4o-mini",
  env: "test",
};

const SEARCH_REQUEST_FILTER_KEYS = [
  "combinedTypeTree",
  "categoryTree",
  "filters",
  "award",
  "datasource",
  "sourcePartner",
  "campaignTag",
  "allTag",
  "category",
  "amenityFeature",
  "starRatingName",
  "addressLocality",
  "addressPostalCode",
];

const FACET_NAME_OPTIONS = [
  "containedInPlace/id",
  "categoryTree",
  "combinedTypeTree",
  "combinedType",
  "type",
  "season",
  "openingHoursSpecification/dayOfWeek",
  "priceRange",
  "award",
  "tag",
  "leafType",
  "amenityFeature",
  "starRating/name",
  "starRating/ratingValue",
  "starRating/superior",
  "address/addressLocality",
  "address/postalCode",
];

const FACET_ORDER_BY_OPTIONS = ["name", "count", "value"];
const FACET_VALUE_FIELD_OPTIONS = ["selectValues", "filterValues", "values", "interval"];

function normalizeFacetName(value) {
  if (typeof value !== "string") {
    return FACET_NAME_OPTIONS[0];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return FACET_NAME_OPTIONS[0];
  }
  return trimmed;
}

function normalizeFacetOrderBy(value) {
  return FACET_ORDER_BY_OPTIONS.includes(value) ? value : "name";
}

function normalizeSearchOrderBy(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function normalizeFacetValueList(values) {
  if (typeof values === "string") {
    const trimmed = values.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof values === "number" || typeof values === "boolean") {
    return [String(values)];
  }

  if (!Array.isArray(values) || !values.length) {
    return [];
  }

  return values
    .map((value) => {
      if (value == null) {
        return "";
      }
      if (typeof value === "string") {
        return value.trim();
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      if (typeof value === "object") {
        const candidate = value.value ?? value.name ?? value.key ?? value.label;
        return candidate == null ? "" : String(candidate).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeFacetFilterValues(facet) {
  return normalizeFacetValueList(facet?.filterValues);
}

function normalizeFacetSelectValues(facet) {
  return normalizeFacetValueList(facet?.selectValues);
}

function normalizeFacetInterval(interval) {
  if (interval == null) {
    return undefined;
  }
  if (Array.isArray(interval)) {
    return [...interval];
  }
  if (typeof interval === "object") {
    return { ...interval };
  }
  if (typeof interval === "string") {
    const trimmed = interval.trim();
    return trimmed ? trimmed : undefined;
  }
  return interval;
}

function getFacetActiveValueField(facet) {
  if (FACET_VALUE_FIELD_OPTIONS.includes(facet?.valueField)) {
    return facet.valueField;
  }
  if (Array.isArray(facet?.selectValues) && facet.selectValues.length > 0) {
    return "selectValues";
  }
  if (Array.isArray(facet?.filterValues) && facet.filterValues.length > 0) {
    return "filterValues";
  }
  if (Array.isArray(facet?.values) && facet.values.length > 0) {
    return "values";
  }

  const hasInterval =
    facet?.interval != null &&
    !(typeof facet.interval === "string" && !facet.interval.trim());
  if (hasInterval) {
    return "interval";
  }
  return "filterValues";
}

function getFacetValueFieldLabel(field) {
  if (field === "selectValues") return "Select values (one per line)";
  if (field === "filterValues") return "Filter values (one per line)";
  if (field === "values") return "Values (one per line)";
  if (field === "interval") return "Interval (JSON)";
  return "Values";
}

function getFacetValueTextareaContent(facet, field) {
  if (field === "selectValues") {
    return (facet.selectValues || []).join("\n");
  }
  if (field === "filterValues") {
    return (facet.filterValues || []).join("\n");
  }
  if (field === "values") {
    return (facet.values || []).join("\n");
  }
  if (field === "interval") {
    if (facet.interval == null) {
      return "";
    }
    if (typeof facet.interval === "string") {
      return facet.interval;
    }
    return JSON.stringify(facet.interval, null, 2);
  }
  return "";
}

function facetFieldToTextLines(facet, field) {
  if (field === "interval") {
    if (facet.interval == null) {
      return [];
    }
    if (typeof facet.interval === "string") {
      return facet.interval
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (Array.isArray(facet.interval)) {
      return facet.interval
        .map((entry) => (entry == null ? "" : String(entry).trim()))
        .filter(Boolean);
    }
    return [JSON.stringify(facet.interval)];
  }

  const values = Array.isArray(facet[field]) ? facet[field] : [];
  return values
    .map((entry) => (entry == null ? "" : String(entry).trim()))
    .filter(Boolean);
}

function assignFacetFieldFromTextLines(facet, field, lines) {
  const normalizedLines = Array.isArray(lines)
    ? lines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];

  if (field === "interval") {
    if (!normalizedLines.length) {
      facet.interval = undefined;
      return;
    }

    const text = normalizedLines.join("\n");
    try {
      facet.interval = JSON.parse(text);
    } catch (error) {
      facet.interval = text;
    }
    return;
  }

  facet[field] = normalizedLines;
}

function clearFacetValueFieldsExcept(facet, activeField) {
  if (activeField !== "selectValues") {
    facet.selectValues = [];
  }
  if (activeField !== "filterValues") {
    facet.filterValues = [];
  }
  if (activeField !== "values") {
    facet.values = [];
  }
  if (activeField !== "interval") {
    facet.interval = undefined;
  }
}

function extractFacets(searchRequest) {
  const facets = searchRequest?.facets;
  if (Array.isArray(facets)) {
    return facets;
  }
  if (facets && typeof facets === "object") {
    return Object.values(facets);
  }
  return [];
}

function mapFacetToDraft(facet) {
  if (!facet || typeof facet !== "object") {
    return null;
  }
  const draftFacet = {
    name: normalizeFacetName(facet.name),
    responseNames: facet.responseNames,
    filterValues: normalizeFacetFilterValues(facet),
    selectValues: normalizeFacetSelectValues(facet),
    values: normalizeFacetValueList(facet.values),
    interval: normalizeFacetInterval(facet.interval),
    additionalType: facet.additionalType || [],
    orderBy: normalizeFacetOrderBy(facet.orderBy),
    orderDirection: facet.orderDirection,
    count: facet.count,
    scope: facet.scope || "current",
    excludeRedundant: facet.excludeRedundant || false,
  };
  draftFacet.valueField = getFacetActiveValueField(draftFacet);
  return draftFacet;
}

const state = {
  settings: { ...DEFAULT_SETTINGS },
  views: [],
  viewSearchQuery: "",
  selectedViewId: null,
  viewHistory: {},
  copiedFilter: null,
  copiedFacet: null,
  draft: {
    name: "",
    description: "",
    orderBy: "",
    scheduleStrategy: "Daily",
    filters: [],
    facets: [],
  },
  responses: {
    request: {},
    response: {},
    results: {},
    openaiRequest: {},
  },
};

const elements = {
  refreshViewsBtn: document.getElementById("refreshViewsBtn"),
  viewSearchInput: document.getElementById("viewSearchInput"),
  viewsList: document.getElementById("viewsList"),
  loadViewBtn: document.getElementById("loadViewBtn"),
  duplicateViewBtn: document.getElementById("duplicateViewBtn"),
  deleteViewBtn: document.getElementById("deleteViewBtn"),
  draftName: document.getElementById("draftName"),
  draftDescription: document.getElementById("draftDescription"),
  draftOrderBy: document.getElementById("draftOrderBy"),
  addFilterBtn: document.getElementById("addFilterBtn"),
  addCopiedFilterBtn: document.getElementById("addCopiedFilterBtn"),
  filterList: document.getElementById("filterList"),
  facetList: document.getElementById("facetList"),
  addFacetBtn: document.getElementById("addFacetBtn"),
  addCopiedFacetBtn: document.getElementById("addCopiedFacetBtn"),
  createViewBtn: document.getElementById("createViewBtn"),
  updateViewBtn: document.getElementById("updateViewBtn"),
  duplicateEditorViewBtn: document.getElementById("duplicateEditorViewBtn"),
  previewResultsBtn: document.getElementById("previewResultsBtn"),
  copyRequestBtn: document.getElementById("copyRequestBtn"),
  copyOpenaiRequestBtn: document.getElementById("copyOpenaiRequestBtn"),
  requestJson: document.getElementById("requestJson"),
  openaiRequestJson: document.getElementById("openaiRequestJson"),
  responseJson: document.getElementById("responseJson"),
  resultsJson: document.getElementById("resultsJson"),
  copyResponseBtn: document.getElementById("copyResponseBtn"),
  editorViewTitle: document.getElementById("editorViewTitle"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  historyList: document.getElementById("historyList"),
  settingsConfigLabel: document.getElementById("settingsConfigLabel"),
};

let editorTabs = [];
let editorTabContents = [];
let dataTabs = [];
let dataTabContents = [];
let previewTabs = [];
let previewTabContents = [];

function showLoading() {
  elements.loadingOverlay.classList.add("active");
}

function hideLoading() {
  elements.loadingOverlay.classList.remove("active");
}

function renderLivePreview() {
  const liveContainer = document.getElementById("liveContainer");
  if (!liveContainer) return;

  liveContainer.innerHTML = "";
  
  // Check if results exist
  const results = state.responses.results;
  const values = results?.values || [];
  const count = results?.count ?? 0;
  
  if (!values || values.length === 0) {
    liveContainer.innerHTML = "<div class=\"status\">No results. Run preview first.</div>";
    return;
  }
  
  // Display count
  const countDiv = document.createElement("div");
  countDiv.style.marginBottom = "16px";
  countDiv.style.padding = "12px";
  countDiv.style.backgroundColor = "#e0f2fe";
  countDiv.style.borderRadius = "8px";
  countDiv.style.fontWeight = "600";
  countDiv.textContent = `Results Count: ${count}`;
  liveContainer.appendChild(countDiv);
  
  // Create table for results display with only specific columns
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.marginTop = "16px";
  
  // Create header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.borderBottom = "2px solid var(--border)";
  headerRow.style.backgroundColor = "#f3f4f6";
  
  ["image", "name", "identifier", "type", "additionalType"].forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    th.style.padding = "12px";
    th.style.textAlign = "left";
    th.style.fontWeight = "600";
    th.style.wordBreak = "break-word";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement("tbody");
  values.forEach((item, index) => {
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid var(--border)";
    if (index % 2 === 0) {
      row.style.backgroundColor = "#f9fafb";
    }
    
    ["image", "name", "identifier", "type", "additionalType"].forEach(key => {
      const cell = document.createElement("td");
      const value = item[key];

      if (key === "image") {
        const thumbnailUrl =
          value && typeof value === "object" && typeof value.thumbnailUrl === "string"
            ? value.thumbnailUrl.trim()
            : "";

        if (thumbnailUrl) {
          const img = document.createElement("img");
          img.src = thumbnailUrl;
          img.alt = item.name ? `Preview for ${item.name}` : "Preview image";
          img.style.width = "48px";
          img.style.height = "48px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "4px";
          cell.appendChild(img);
        } else {
          cell.textContent = "-";
        }
      } else if (key === "identifier") {
        if (value && item.type) {
          const link = document.createElement("a");
          link.href = `https://partner.discover.swiss/infocenter/details/${String(item.type)}/${String(value)}`;
          link.textContent = String(value);
          link.target = "_blank";
          link.style.color = "var(--primary, #0066cc)";
          link.style.textDecoration = "none";
          link.style.cursor = "pointer";
          link.addEventListener("mouseenter", () => {
            link.style.textDecoration = "underline";
          });
          link.addEventListener("mouseleave", () => {
            link.style.textDecoration = "none";
          });
          cell.appendChild(link);
        } else {
          cell.textContent = "-";
        }
      } else if (value === null || value === undefined) {
        cell.textContent = "-";
      } else if (typeof value === "object") {
        cell.textContent = JSON.stringify(value);
        cell.style.fontSize = "0.85em";
        cell.style.color = "#666";
      } else {
        cell.textContent = String(value);
      }
      
      cell.style.padding = "12px";
      cell.style.wordBreak = "break-word";
      row.appendChild(cell);
    });
    
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  liveContainer.appendChild(table);
}

function renderFacetsPreview() {
  const facetsContainer = document.getElementById("facetsContainer");
  if (!facetsContainer) return;

  facetsContainer.innerHTML = "";
  
  // Check if results exist
  const results = state.responses.results;
  let facets = results?.facets || [];
  
  // Convert object to array if necessary
  if (facets && typeof facets === "object" && !Array.isArray(facets)) {
    facets = Object.values(facets);
  }
  
  facets = Array.isArray(facets) ? facets : [];
  
  if (!facets || facets.length === 0) {
    facetsContainer.innerHTML = "<div class=\"status\">No facets in response. Load results first.</div>";
    return;
  }
  
  // Create table for facets display
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.marginTop = "8px";
  
  // Create header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.borderBottom = "2px solid var(--border)";
  headerRow.style.backgroundColor = "#f3f4f6";
  
  ["Facet Name", "Filter Property", "Options"].forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    th.style.padding = "10px";
    th.style.textAlign = "left";
    th.style.fontWeight = "600";
    th.style.fontSize = "0.9rem";
    th.style.wordBreak = "break-word";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement("tbody");
  let rowIndex = 0;
  
  facets.forEach((facet) => {
    const facetName = facet.name || "-";
    const filterPropertyName = facet.filterPropertyName || "-";
    let rawOptions = facet.options ?? facet.values ?? facet.items ?? facet.buckets;
    if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
      rawOptions = Object.values(rawOptions);
    }
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid var(--border)";
    if (rowIndex % 2 === 0) {
      row.style.backgroundColor = "#f9fafb";
    }
    
    // Facet name
    const facetNameCell = document.createElement("td");
    facetNameCell.textContent = facetName;
    facetNameCell.style.padding = "10px";
    facetNameCell.style.fontWeight = "600";
    facetNameCell.style.verticalAlign = "top";
    row.appendChild(facetNameCell);
    
    // Filter property name
    const filterPropCell = document.createElement("td");
    filterPropCell.textContent = filterPropertyName;
    filterPropCell.style.padding = "10px";
    filterPropCell.style.verticalAlign = "top";
    row.appendChild(filterPropCell);
    
    // Options (all in one cell)
    const optionsCell = document.createElement("td");
    if (options.length === 0) {
      optionsCell.textContent = "-";
    } else {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${options.length} options`;
      summary.style.cursor = "pointer";
      summary.style.fontWeight = "600";
      summary.style.color = "var(--primary)";
      details.appendChild(summary);
      
      const optionsDiv = document.createElement("div");
      optionsDiv.style.marginTop = "8px";
      const optionsList = options
        .map((option) => {
          if (option && typeof option === "object") {
            const name = option.name ?? option.value ?? option.key ?? option.label ?? "-";
            const count = option.count ?? option.docCount ?? option.doc_count ?? "-";
            return `${name} - ${count}`;
          }
          return `${String(option)} - -`;
        })
        .join("<br>");
      optionsDiv.innerHTML = optionsList;
      details.appendChild(optionsDiv);
      
      optionsCell.appendChild(details);
    }
    optionsCell.style.padding = "10px";
    optionsCell.style.verticalAlign = "top";
    row.appendChild(optionsCell);
    
    tbody.appendChild(row);
    rowIndex++;
  });
  
  table.appendChild(tbody);
  facetsContainer.appendChild(table);
}

function getBaseUrl() {
  return state.settings.env === "prod"
    ? "https://api.discover.swiss/info/v2"
    : "https://api.discover.swiss/test/info/v2";
}

function loadSettings() {
  const configs = localStorage.getItem(CONFIGS_KEY);
  const configsObj = configs ? JSON.parse(configs) : {};
  
  // Migrate old settings if they exist and no configs are present
  if (Object.keys(configsObj).length === 0) {
    const oldSettings = localStorage.getItem("aiviewmanager.settings");
    if (oldSettings) {
      try {
        const oldSettingsObj = JSON.parse(oldSettings);
        if (oldSettingsObj.apiKey || oldSettingsObj.project) {
          const migratedId = "config_migrated";
          configsObj[migratedId] = {
            name: "Default Configuration",
            apiKey: oldSettingsObj.apiKey || "",
            project: oldSettingsObj.project || "",
            openaiKey: oldSettingsObj.openaiKey || "",
            openaiModel: oldSettingsObj.openaiModel || "gpt-4o-mini",
            env: oldSettingsObj.env || "test",
          };
          localStorage.setItem(CONFIGS_KEY, JSON.stringify(configsObj));
          localStorage.setItem(CURRENT_CONFIG_KEY, migratedId);
          localStorage.removeItem("aiviewmanager.settings");
        }
      } catch (e) {
        console.error("Migration failed:", e);
      }
    }
  }
  
  const currentConfigId = localStorage.getItem(CURRENT_CONFIG_KEY);
  if (currentConfigId && configsObj[currentConfigId]) {
    state.settings = { ...DEFAULT_SETTINGS, ...configsObj[currentConfigId] };
  } else {
    state.settings = { ...DEFAULT_SETTINGS };
  }
}

function renderSettingsConfigLabel() {
  if (!elements.settingsConfigLabel) return;

  const configName = state.settings.name?.trim();
  const env = (state.settings.env || "test").toUpperCase();

  if (configName) {
    elements.settingsConfigLabel.textContent = `${configName} (${env})`;
    return;
  }

  elements.settingsConfigLabel.textContent = `Keine Konfig (${env})`;
}

function saveSettings() {
  // Settings werden in settings.js verwaltet
  // Diese Funktion bleibt zur Kompatibilität, tut aber nichts
}

// ========== View History Management ==========

function loadViewHistory() {
  try {
    const historyData = localStorage.getItem(VIEW_HISTORY_KEY);
    state.viewHistory = historyData ? JSON.parse(historyData) : {};
  } catch (error) {
    console.error("Error loading view history:", error);
    state.viewHistory = {};
  }
}

function saveViewHistory() {
  try {
    localStorage.setItem(VIEW_HISTORY_KEY, JSON.stringify(state.viewHistory));
  } catch (error) {
    console.error("Error saving view history:", error);
  }
}

function addVersionToHistory(viewId, versionData) {
  if (!viewId) return;
  
  const viewIdStr = String(viewId);
  if (!state.viewHistory[viewIdStr]) {
    state.viewHistory[viewIdStr] = [];
  }
  
  const version = {
    timestamp: new Date().toISOString(),
    data: versionData,
  };
  
  state.viewHistory[viewIdStr].unshift(version);
  
  // Keep max 20 versions per view
  if (state.viewHistory[viewIdStr].length > 20) {
    state.viewHistory[viewIdStr] = state.viewHistory[viewIdStr].slice(0, 20);
  }
  
  saveViewHistory();
}

function getViewHistory(viewId) {
  if (!viewId) return [];
  return state.viewHistory[String(viewId)] || [];
}

function renderHistory() {
  if (!elements.historyList) return;
  
  elements.historyList.innerHTML = "";
  
  if (!state.selectedViewId) {
    elements.historyList.innerHTML = "<div class=\"status\">Select a view to see its history.</div>";
    return;
  }
  
  const history = getViewHistory(state.selectedViewId);
  
  if (!history.length) {
    elements.historyList.innerHTML = "<div class=\"status\">No version history available for this view.</div>";
    return;
  }
  
  history.forEach((version, index) => {
    const card = document.createElement("div");
    card.className = "history-card";
    
    const timestamp = new Date(version.timestamp);
    const formattedDate = timestamp.toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    
    card.innerHTML = `
      <div class="history-header">
        <div class="history-info">
          <strong>Version ${history.length - index}</strong>
          <span class="history-timestamp">${formattedDate}</span>
        </div>
        <div class="history-actions">
          <button class="secondary small" data-action="restore" data-index="${index}">Restore</button>
          <button class="ghost small" data-action="compare" data-index="${index}">Compare</button>
          <button class="ghost small" data-action="view" data-index="${index}">View JSON</button>
        </div>
      </div>
      <div class="history-summary">
        ${version.data.name || "Unnamed"} · ${version.data.scheduleStrategy || "Unknown"}
      </div>
    `;
    
    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.index, 10);
        handleHistoryAction(action, idx);
      });
    });
    
    elements.historyList.appendChild(card);
  });
}

function handleHistoryAction(action, index) {
  const history = getViewHistory(state.selectedViewId);
  if (!history[index]) return;
  
  const version = history[index];
  
  if (action === "restore") {
    if (confirm("Restore this version? Your current draft will be replaced.")) {
      applyViewToDraft(version.data);
      alert("Version restored to draft. Click 'Update view' to save.");
    }
  } else if (action === "compare") {
    showCompareSelectionModal(history, index);
  } else if (action === "compare-current") {
    compareHistoryVersionWithCurrent(history, index);
  } else if (action === "view") {
    showJsonModal(version.data);
  }
}

function getHistoryVersionLabel(history, index) {
  const version = history[index];
  const versionNumber = history.length - index;
  const timestamp = new Date(version.timestamp).toLocaleString("de-DE");
  return `Version ${versionNumber} · ${timestamp}`;
}

function getCurrentViewForComparison() {
  const currentDraftView = buildRequestBody();
  if (currentDraftView) {
    return {
      data: currentDraftView,
      label: "Current draft view",
    };
  }

  if (state.responses.response && Object.keys(state.responses.response).length > 0) {
    return {
      data: state.responses.response,
      label: "Current loaded view",
    };
  }

  return null;
}

function compareHistoryVersionWithCurrent(history, index) {
  const currentView = getCurrentViewForComparison();

  if (!currentView) {
    alert("No current view available for comparison.");
    return;
  }

  const selectedVersion = history[index];
  showComparisonModal(selectedVersion.data, currentView.data, {
    olderLabel: getHistoryVersionLabel(history, index),
    newerLabel: currentView.label,
  });
}

function getDiffStats(oldVersion, newVersion) {
  const oldLines = JSON.stringify(oldVersion || {}, null, 2).split("\n");
  const newLines = JSON.stringify(newVersion || {}, null, 2).split("\n");
  const diffRows = computeLineDiff(oldLines, newLines);

  let added = 0;
  let removed = 0;

  diffRows.forEach((row) => {
    if (row.type === "added") {
      added += 1;
    } else if (row.type === "removed") {
      removed += 1;
    }
  });

  return { added, removed, changed: added + removed };
}

function showCompareAllWithCurrentModal(history) {
  const currentView = getCurrentViewForComparison();

  if (!currentView) {
    alert("No current view available for comparison.");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const listHtml = history
    .map((version, index) => {
      const stats = getDiffStats(version.data, currentView.data);
      return `
        <div class="history-card" style="margin-bottom: 10px;">
          <div class="history-header">
            <div class="history-info">
              <strong>${getHistoryVersionLabel(history, index)}</strong>
              <span class="history-timestamp">Changes: ${stats.changed} ( +${stats.added} / -${stats.removed} )</span>
            </div>
            <div class="history-actions">
              <button class="ghost small" data-action="compare-current" data-index="${index}">Open Diff</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>All history versions vs ${currentView.label}</h3>
        <button class="ghost small" id="closeCompareAllModal">Close</button>
      </div>
      <div>${listHtml || "<div class='status'>No versions available.</div>"}</div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
  };

  document.getElementById("closeCompareAllModal").addEventListener("click", closeModal);

  modal.querySelectorAll("button[data-action='compare-current']").forEach((button) => {
    button.addEventListener("click", () => {
      const index = parseInt(button.dataset.index, 10);
      if (Number.isNaN(index) || !history[index]) {
        return;
      }
      closeModal();
      compareHistoryVersionWithCurrent(history, index);
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

function showCompareSelectionModal(history, preselectedIndex) {
  const currentView = getCurrentViewForComparison();
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const historyOptionsHtml = history
    .map((_, idx) => `<option value="${idx}">${getHistoryVersionLabel(history, idx)}</option>`)
    .join("");
  const currentOptionHtml = currentView ? `<option value="current">${currentView.label}</option>` : "";
  const optionsHtml = `${currentOptionHtml}${historyOptionsHtml}`;

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Select versions to compare</h3>
        <button class="ghost small" id="closeCompareSelectionModal">Close</button>
      </div>
      <div class="grid-2" style="margin-bottom: 16px;">
        <label>
          <span>Version A</span>
          <select id="compareVersionA">${optionsHtml}</select>
        </label>
        <label>
          <span>Version B</span>
          <select id="compareVersionB">${optionsHtml}</select>
        </label>
      </div>
      <div class="button-row">
        <button class="secondary" id="runVersionCompareBtn">Compare selected versions</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const selectA = document.getElementById("compareVersionA");
  const selectB = document.getElementById("compareVersionB");
  selectA.value = String(preselectedIndex);
  selectB.value = currentView ? "current" : String(preselectedIndex);

  const closeModal = () => {
    modal.remove();
  };

  document.getElementById("closeCompareSelectionModal").addEventListener("click", closeModal);

  document.getElementById("runVersionCompareBtn").addEventListener("click", () => {
    const selectedA = selectA.value;
    const selectedB = selectB.value;

    if (!selectedA || !selectedB) {
      alert("Please select two versions.");
      return;
    }

    if (selectedA === selectedB) {
      alert("Please select two different versions.");
      return;
    }

    const resolveSelection = (selectionValue) => {
      if (selectionValue === "current") {
        if (!currentView) {
          return null;
        }
        return {
          data: currentView.data,
          label: currentView.label,
          sortIndex: -1,
          isCurrent: true,
        };
      }

      const parsedIndex = parseInt(selectionValue, 10);
      if (Number.isNaN(parsedIndex) || !history[parsedIndex]) {
        return null;
      }

      return {
        data: history[parsedIndex].data,
        label: getHistoryVersionLabel(history, parsedIndex),
        sortIndex: parsedIndex,
        isCurrent: false,
      };
    };

    const selectionA = resolveSelection(selectedA);
    const selectionB = resolveSelection(selectedB);

    if (!selectionA || !selectionB) {
      alert("Invalid selection.");
      return;
    }

    if (selectionA.isCurrent || selectionB.isCurrent) {
      const olderSelection = selectionA.sortIndex > selectionB.sortIndex ? selectionA : selectionB;
      const newerSelection = olderSelection === selectionA ? selectionB : selectionA;

      closeModal();

      showComparisonModal(olderSelection.data, newerSelection.data, {
        olderLabel: olderSelection.label,
        newerLabel: newerSelection.label,
      });
      return;
    }

    const olderIndex = Math.max(selectionA.sortIndex, selectionB.sortIndex);
    const newerIndex = Math.min(selectionA.sortIndex, selectionB.sortIndex);

    const olderVersion = history[olderIndex];
    const newerVersion = history[newerIndex];

    closeModal();

    showComparisonModal(olderVersion.data, newerVersion.data, {
      olderLabel: getHistoryVersionLabel(history, olderIndex),
      newerLabel: getHistoryVersionLabel(history, newerIndex),
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

function showJsonModal(data) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Version Data</h3>
        <button class="ghost small" id="closeJsonModal">Close</button>
      </div>
      <pre class="code-block">${JSON.stringify(data, null, 2)}</pre>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("closeJsonModal").addEventListener("click", () => {
    modal.remove();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showErrorModal(error) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  
  const errorData = {
    status: error.status || "unknown",
    message: error.message || "Request failed",
    details: error.data || error
  };
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header" style="background-color: #fee; border-bottom: 2px solid #c33;">
        <h3 style="color: #c33;">❌ Update Failed</h3>
        <button class="ghost small" id="closeErrorModal">Close</button>
      </div>
      <div style="padding: 16px; background-color: #fff5f5;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #c33;">
          Status: ${errorData.status} - ${errorData.message}
        </p>
        <details open>
          <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">Full Response</summary>
          <pre class="code-block" style="margin-top: 8px;">${JSON.stringify(errorData.details, null, 2)}</pre>
        </details>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("closeErrorModal").addEventListener("click", () => {
    modal.remove();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function computeLineDiff(oldLines, newLines) {
  const oldLength = oldLines.length;
  const newLength = newLines.length;
  const lcs = Array.from({ length: oldLength + 1 }, () =>
    Array(newLength + 1).fill(0)
  );

  for (let oldIndex = oldLength - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLength - 1; newIndex >= 0; newIndex -= 1) {
      if (oldLines[oldIndex] === newLines[newIndex]) {
        lcs[oldIndex][newIndex] = lcs[oldIndex + 1][newIndex + 1] + 1;
      } else {
        lcs[oldIndex][newIndex] = Math.max(
          lcs[oldIndex + 1][newIndex],
          lcs[oldIndex][newIndex + 1]
        );
      }
    }
  }

  const diffRows = [];
  let oldIndex = 0;
  let newIndex = 0;
  let oldLineNumber = 1;
  let newLineNumber = 1;

  while (oldIndex < oldLength && newIndex < newLength) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      diffRows.push({
        type: "same",
        line: oldLines[oldIndex],
        oldLineNumber,
        newLineNumber,
      });
      oldIndex += 1;
      newIndex += 1;
      oldLineNumber += 1;
      newLineNumber += 1;
    } else if (lcs[oldIndex + 1][newIndex] >= lcs[oldIndex][newIndex + 1]) {
      diffRows.push({
        type: "removed",
        line: oldLines[oldIndex],
        oldLineNumber,
      });
      oldIndex += 1;
      oldLineNumber += 1;
    } else {
      diffRows.push({
        type: "added",
        line: newLines[newIndex],
        newLineNumber,
      });
      newIndex += 1;
      newLineNumber += 1;
    }
  }

  while (oldIndex < oldLength) {
    diffRows.push({
      type: "removed",
      line: oldLines[oldIndex],
      oldLineNumber,
    });
    oldIndex += 1;
    oldLineNumber += 1;
  }

  while (newIndex < newLength) {
    diffRows.push({
      type: "added",
      line: newLines[newIndex],
      newLineNumber,
    });
    newIndex += 1;
    newLineNumber += 1;
  }

  return diffRows;
}

function buildDiffHtml(oldVersion, newVersion) {
  const oldLines = JSON.stringify(oldVersion || {}, null, 2).split("\n");
  const newLines = JSON.stringify(newVersion || {}, null, 2).split("\n");
  const diffRows = computeLineDiff(oldLines, newLines);

  return diffRows
    .map((row) => {
      const sign = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
      const oldLine = row.oldLineNumber != null ? row.oldLineNumber : "";
      const newLine = row.newLineNumber != null ? row.newLineNumber : "";
      return `
        <div class="diff-row diff-${row.type}">
          <span class="diff-line-number">${oldLine}</span>
          <span class="diff-line-number">${newLine}</span>
          <span class="diff-sign">${sign}</span>
          <span class="diff-line-content">${escapeHtml(row.line)}</span>
        </div>
      `;
    })
    .join("");
}

function showComparisonModal(oldVersion, currentVersion, labels = {}) {
  const diffHtml = buildDiffHtml(oldVersion, currentVersion);
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content large">
      <div class="modal-header">
        <h3>Version Comparison</h3>
        <button class="ghost small" id="closeCompareModal">Close</button>
      </div>
      <div class="comparison-meta">
        <span><strong>Old:</strong> ${labels.olderLabel || "Older version"}</span>
        <span><strong>New:</strong> ${labels.newerLabel || "Newer version"}</span>
        ${labels.selectedLabel ? `<span>${labels.selectedLabel}</span>` : ""}
      </div>
      <div class="diff-legend">
        <span class="diff-pill removed">Removed</span>
        <span class="diff-pill added">Added</span>
      </div>
      <div class="diff-container">
        <div class="diff-header">
          <span>Old #</span>
          <span>New #</span>
          <span></span>
          <span>Line</span>
        </div>
        ${diffHtml}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("closeCompareModal").addEventListener("click", () => {
    modal.remove();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ========== End View History Management ==========

async function apiRequest(path, options = {}) {
  if (!state.settings.apiKey || !state.settings.project) {
    updateSettingsStatus("Please save API key and project name first.", true);
    throw new Error("Missing settings");
  }
  const url = new URL(`${getBaseUrl()}${path}`);
  url.searchParams.set("project", state.settings.project);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    ...options,
    query: undefined,
    headers: {
      "Ocp-Apim-Subscription-Key": state.settings.apiKey,
      "Accept-Language": "de",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = {
      status: response.status,
      message: response.statusText,
      data,
    };
    throw error;
  }

  return data;
}

function renderViews() {
  elements.viewsList.innerHTML = "";
  if (!state.views.length) {
    elements.viewsList.innerHTML = "<div class=\"status\">No views loaded.</div>";
    return;
  }
  const normalizedQuery = (state.viewSearchQuery || "").trim().toLowerCase();
  const filteredViews = state.views.filter((view) => {
    if (!normalizedQuery) {
      return true;
    }
    return String(view?.name || "").toLowerCase().includes(normalizedQuery);
  });

  if (!filteredViews.length) {
    elements.viewsList.innerHTML = "<div class=\"status\">No views matching your search.</div>";
    return;
  }

  filteredViews.forEach((view) => {
    const viewId = getViewId(view);
    const isActive = state.selectedViewId != null && viewId != null && String(state.selectedViewId) === String(viewId);
    const item = document.createElement("div");
    item.className = `list-item ${isActive ? "active" : ""}`;

    const name = document.createElement("span");
    name.className = "list-item-name";
    name.textContent = view.name || viewId || "(no id)";

    const identifier = document.createElement("span");
    identifier.className = "list-item-identifier";
    identifier.textContent = viewId ? ` - ${viewId}` : "";

    const schedule = document.createElement("span");
    schedule.className = "list-item-schedule";
    schedule.textContent = view.scheduleStrategy ? ` · ${view.scheduleStrategy}` : "";

    item.appendChild(name);
    item.appendChild(schedule);
    item.appendChild(identifier);

    item.addEventListener("click", () => {
      if (!viewId) {
        return;
      }
      selectViewById(String(viewId), {
        showNotFoundAlert: false,
        ensureViewsLoaded: false,
        historyMode: "push",
      }).catch((error) => {
        console.error("Error selecting view:", error);
      });
    });
    elements.viewsList.appendChild(item);
  });
}

function getViewId(view) {
  return view?.id ?? view?.identifier ?? view?.viewId ?? view?.uuid ?? null;
}

function cloneFilter(filter) {
  return {
    type: filter?.type || "combinedTypeTree",
    values: Array.isArray(filter?.values) ? [...filter.values] : [],
  };
}

function cloneFacet(facet) {
  const cloned = {
    name: normalizeFacetName(facet?.name),
    responseNames: {
      de: facet?.responseNames?.de || "",
      en: facet?.responseNames?.en || "",
    },
    filterValues: Array.isArray(facet?.filterValues) ? [...facet.filterValues] : [],
    selectValues: Array.isArray(facet?.selectValues) ? [...facet.selectValues] : [],
    values: Array.isArray(facet?.values) ? [...facet.values] : [],
    interval: facet?.interval && typeof facet.interval === "object" ? { ...facet.interval } : facet?.interval,
    additionalType: Array.isArray(facet?.additionalType) ? [...facet.additionalType] : [],
    orderBy: normalizeFacetOrderBy(facet?.orderBy),
    orderDirection: facet?.orderDirection || "",
    count: facet?.count,
    scope: facet?.scope || "current",
    excludeRedundant: !!facet?.excludeRedundant,
    valueField: facet?.valueField,
  };
  cloned.valueField = getFacetActiveValueField(cloned);
  return cloned;
}

function canInsertCopiedFilter() {
  return !!(
    state.copiedFilter &&
    state.selectedViewId &&
    String(state.copiedFilter.sourceViewId) !== String(state.selectedViewId)
  );
}

function canInsertCopiedFacet() {
  return !!(
    state.copiedFacet &&
    state.selectedViewId
  );
}

function updateCopiedInsertButtonsVisibility() {
  if (elements.addCopiedFilterBtn) {
    elements.addCopiedFilterBtn.style.display = canInsertCopiedFilter() ? "inline-flex" : "none";
  }
  if (elements.addCopiedFacetBtn) {
    elements.addCopiedFacetBtn.style.display = canInsertCopiedFacet() ? "inline-flex" : "none";
  }
}

function copyFilterForOtherView(filter) {
  if (!state.selectedViewId) {
    alert("Load a view first.");
    return;
  }
  state.copiedFilter = {
    sourceViewId: String(state.selectedViewId),
    item: cloneFilter(filter),
  };
  updateCopiedInsertButtonsVisibility();
  alert("Filter copied. Load another view and click 'Add copy filter'.");
}

function copyFacetForOtherView(facet) {
  if (!state.selectedViewId) {
    alert("Load a view first.");
    return;
  }
  state.copiedFacet = {
    sourceViewId: String(state.selectedViewId),
    item: cloneFacet(facet),
  };
  updateCopiedInsertButtonsVisibility();
  alert("Facet copied. Click 'Add copy facet' to insert it.");
}

function addCopiedFilterToDraft() {
  if (!canInsertCopiedFilter()) return;
  state.draft.filters.push(cloneFilter(state.copiedFilter.item));
  renderFilters();
  updateRequestJson();
}

function addCopiedFacetToDraft() {
  if (!canInsertCopiedFacet()) return;
  state.draft.facets.push(cloneFacet(state.copiedFacet.item));
  renderFacets();
  updateRequestJson();
}

function updateEditorViewTitle() {
  if (state.selectedViewId) {
    const selectedView = state.views.find((v) => {
      const viewId = getViewId(v);
      return viewId != null && String(viewId) === String(state.selectedViewId);
    });
    if (selectedView) {
      elements.editorViewTitle.textContent = ` · ${selectedView.name || getViewId(selectedView)}`;
    }
  } else {
    elements.editorViewTitle.textContent = "";
  }
}

function renderDraft() {
  elements.draftName.value = state.draft.name;
  elements.draftDescription.value = state.draft.description;
  if (elements.draftOrderBy) {
    elements.draftOrderBy.value = state.draft.orderBy || "";
  }
  updateCopiedInsertButtonsVisibility();
  renderFilters();
  renderFacets();
  updateRequestJson();
  updateButtonStates();
}

function updateButtonStates() {
  const isEditingExisting = !!state.selectedViewId;
  elements.createViewBtn.disabled = isEditingExisting;
  elements.updateViewBtn.disabled = !isEditingExisting;
  if (elements.duplicateViewBtn) {
    elements.duplicateViewBtn.disabled = !isEditingExisting;
  }
  if (elements.duplicateEditorViewBtn) {
    elements.duplicateEditorViewBtn.disabled = !isEditingExisting;
  }
  
  if (isEditingExisting) {
    elements.createViewBtn.style.opacity = "0.5";
    elements.createViewBtn.style.cursor = "not-allowed";
    elements.updateViewBtn.style.opacity = "1";
    elements.updateViewBtn.style.cursor = "pointer";
  } else {
    elements.createViewBtn.style.opacity = "1";
    elements.createViewBtn.style.cursor = "pointer";
    elements.updateViewBtn.style.opacity = "0.5";
    elements.updateViewBtn.style.cursor = "not-allowed";
  }
}

function renderFilters() {
  elements.filterList.innerHTML = "";
  if (!state.draft.filters.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No filters configured yet.";
    elements.filterList.appendChild(empty);
    return;
  }

  state.draft.filters.forEach((filter, index) => {
    const card = document.createElement("details");
    card.className = "filter-card";
    const headerTitle = filter.type ? `Filter ${filter.type}` : `Filter ${index + 1}`;
    card.innerHTML = `
      <summary class="card-summary">
        <h4>${headerTitle}</h4>
        <div class="button-row">
          <button class="secondary" data-action="up">Up</button>
          <button class="secondary" data-action="down">Down</button>
          <button class="secondary" data-action="copy">Copy</button>
          <button class="danger" data-action="remove">Remove</button>
        </div>
      </summary>
      <div class="card-body grid-2">
        <label>
          <span>Filter type</span>
          <select data-field="type">
            <option value="combinedTypeTree" ${filter.type === "combinedTypeTree" ? "selected" : ""}>combinedTypeTree</option>
            <option value="categoryTree" ${filter.type === "categoryTree" ? "selected" : ""}>categoryTree</option>
            <option value="filters" ${filter.type === "filters" ? "selected" : ""}>filters</option>
            <option value="award" ${filter.type === "award" ? "selected" : ""}>award</option>
            <option value="datasource" ${filter.type === "datasource" ? "selected" : ""}>datasource</option>
            <option value="sourcePartner" ${filter.type === "sourcePartner" ? "selected" : ""}>sourcePartner</option>
            <option value="campaignTag" ${filter.type === "campaignTag" ? "selected" : ""}>campaignTag</option>
            <option value="allTag" ${filter.type === "allTag" ? "selected" : ""}>allTag</option>
            <option value="category" ${filter.type === "category" ? "selected" : ""}>category</option>
            <option value="amenityFeature" ${filter.type === "amenityFeature" ? "selected" : ""}>amenityFeature</option>
            <option value="starRatingName" ${filter.type === "starRatingName" ? "selected" : ""}>starRatingName</option>
            <option value="addressLocality" ${filter.type === "addressLocality" ? "selected" : ""}>addressLocality</option>
            <option value="addressPostalCode" ${filter.type === "addressPostalCode" ? "selected" : ""}>addressPostalCode</option>
          </select>
        </label>
        <label class="full">
          <span>Filter values (one per line)</span>
          <textarea rows="3" data-field="values" placeholder="Thing|Place|LocalBusiness|FoodEstablishment">${(filter.values || []).join("\n")}</textarea>
        </label>
      </div>
    `;

    card.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const action = button.dataset.action;
        if (action === "remove") {
          state.draft.filters.splice(index, 1);
        } else if (action === "copy") {
          copyFilterForOtherView(filter);
          return;
        } else if (action === "up" && index > 0) {
          [state.draft.filters[index - 1], state.draft.filters[index]] = [
            state.draft.filters[index],
            state.draft.filters[index - 1],
          ];
        } else if (action === "down" && index < state.draft.filters.length - 1) {
          [state.draft.filters[index + 1], state.draft.filters[index]] = [
            state.draft.filters[index],
            state.draft.filters[index + 1],
          ];
        }
        renderFilters();
        updateRequestJson();
      });
    });

    card.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;
        updateFilterField(index, field, input.value);
      });
    });

    elements.filterList.appendChild(card);
  });
}

function updateFilterField(index, field, value) {
  const filter = state.draft.filters[index];
  if (!filter) return;

  if (field === "values") {
    filter.values = value.split("\n").map((v) => v.trim()).filter(Boolean);
  } else if (field === "type") {
    filter.type = value;
  }
  updateRequestJson();
}

function renderFacets() {
  elements.facetList.innerHTML = "";
  if (!state.draft.facets.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No facets configured yet.";
    elements.facetList.appendChild(empty);
    return;
  }

  state.draft.facets.forEach((facet, index) => {
    facet.valueField = getFacetActiveValueField(facet);
    const card = document.createElement("details");
    card.className = "facet-card";
    const responseNameDe = String(facet.responseNames?.de || "").trim();
    const headerTitle = facet.name
      ? `Facet ${facet.name}${responseNameDe ? ` - ${responseNameDe}` : ""}`
      : `Facet ${index + 1}`;
    const facetName = normalizeFacetName(facet.name);
    const isKnownFacetName = FACET_NAME_OPTIONS.includes(facetName);
    const unknownFacetOption = isKnownFacetName
      ? ""
      : `<option value="${escapeHtml(facetName)}" selected>⚠ Unknown (API): ${escapeHtml(facetName)}</option>`;
    const facetNameOptions = FACET_NAME_OPTIONS
      .map(
        (name) =>
          `<option value="${escapeHtml(name)}" ${facetName === name ? "selected" : ""}>${escapeHtml(name)}</option>`
      )
      .join("");
    const activeValueField = facet.valueField;
    const valueFieldLabel = getFacetValueFieldLabel(activeValueField);
    const valueTextareaContent = getFacetValueTextareaContent(facet, activeValueField);
    card.innerHTML = `
      <summary class="card-summary">
        <strong>${headerTitle}</strong>
        <div class="button-row">
          <button class="secondary" data-action="up">Up</button>
          <button class="secondary" data-action="down">Down</button>
          <button class="secondary" data-action="copy">Copy</button>
          <button class="danger" data-action="remove">Remove</button>
        </div>
      </summary>
      <div class="card-body grid-2">
        <label>
          <span>Name</span>
          <select data-field="name">
            ${unknownFacetOption}
            ${facetNameOptions}
          </select>
        </label>
        <label>
          <span>Scope</span>
          <select data-field="scope">
            <option value="all" ${facet.scope === "all" ? "selected" : ""}>all</option>
            <option value="parent" ${facet.scope === "parent" ? "selected" : ""}>parent</option>
            <option value="current" ${!facet.scope || facet.scope === "current" ? "selected" : ""}>current</option>
          </select>
        </label>
        <label>
          <span>Response Names DE</span>
          <input data-field="responseNames.de" value="${facet.responseNames?.de || ""}" />
        </label>
        <label>
          <span>Response Names EN</span>
          <input data-field="responseNames.en" value="${facet.responseNames?.en || ""}" />
        </label>
        <label>
          <span>Value field</span>
          <select data-field="valueField">
            <option value="selectValues" ${activeValueField === "selectValues" ? "selected" : ""}>selectValues</option>
            <option value="filterValues" ${activeValueField === "filterValues" ? "selected" : ""}>filterValues</option>
            <option value="values" ${activeValueField === "values" ? "selected" : ""}>values</option>
            <option value="interval" ${activeValueField === "interval" ? "selected" : ""}>interval</option>
          </select>
        </label>
        <label class="full">
          <span>${valueFieldLabel}</span>
          <textarea rows="3" data-field="activeValueText">${valueTextareaContent}</textarea>
        </label>
        <label>
          <span>Additional type (comma separated)</span>
          <input data-field="additionalType" value="${(facet.additionalType || []).join(",")}" />
        </label>
        <label>
          <span>Order by</span>
          <select data-field="orderBy">
            <option value="name" ${normalizeFacetOrderBy(facet.orderBy) === "name" ? "selected" : ""}>name</option>
            <option value="count" ${normalizeFacetOrderBy(facet.orderBy) === "count" ? "selected" : ""}>count</option>
            <option value="value" ${normalizeFacetOrderBy(facet.orderBy) === "value" ? "selected" : ""}>value</option>
          </select>
        </label>
        <label>
          <span>Order direction</span>
          <select data-field="orderDirection">
            <option value="">--</option>
            <option value="asc" ${facet.orderDirection === "asc" ? "selected" : ""}>asc</option>
            <option value="desc" ${facet.orderDirection === "desc" ? "selected" : ""}>desc</option>
          </select>
        </label>
        <label>
          <span>Count</span>
          <input data-field="count" type="number" min="1" value="${facet.count || ""}" />
        </label>
        <label class="checkbox-label">
          <input data-field="excludeRedundant" type="checkbox" ${facet.excludeRedundant ? "checked" : ""} />
          <span>Exclude Redundant</span>
        </label>
      </div>
    `;

    card.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const action = button.dataset.action;
        if (action === "remove") {
          state.draft.facets.splice(index, 1);
        } else if (action === "copy") {
          copyFacetForOtherView(facet);
          return;
        } else if (action === "up" && index > 0) {
          [state.draft.facets[index - 1], state.draft.facets[index]] = [
            state.draft.facets[index],
            state.draft.facets[index - 1],
          ];
        } else if (action === "down" && index < state.draft.facets.length - 1) {
          [state.draft.facets[index + 1], state.draft.facets[index]] = [
            state.draft.facets[index],
            state.draft.facets[index + 1],
          ];
        }
        renderFacets();
        updateRequestJson();
      });
    });

    card.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;
        const value = input.type === "checkbox" ? input.checked : input.value;
        updateFacetField(index, field, value);
      });
    });

    elements.facetList.appendChild(card);
  });
}

function updateFacetField(index, field, value) {
  const facet = state.draft.facets[index];
  if (!facet) return;

  if (field === "name") {
    facet.name = normalizeFacetName(value);
  } else if (field === "valueField") {
    const previousField = getFacetActiveValueField(facet);
    const nextField = FACET_VALUE_FIELD_OPTIONS.includes(value) ? value : "filterValues";

    if (previousField !== nextField) {
      const previousLines = facetFieldToTextLines(facet, previousField);
      assignFacetFieldFromTextLines(facet, nextField, previousLines);
    }

    facet.valueField = nextField;
    renderFacets();
    updateRequestJson();
    return;
  } else if (field === "activeValueText") {
    facet.valueField = getFacetActiveValueField(facet);
    const activeField = facet.valueField;
    const parsedLines = String(value || "")
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    assignFacetFieldFromTextLines(facet, activeField, parsedLines);
  } else if (field === "additionalType") {
    facet.additionalType = value.split(",").map((v) => v.trim()).filter(Boolean);
  } else if (field === "count") {
    facet.count = value ? Number(value) : undefined;
  } else if (field === "scope") {
    facet.scope = value || "current";
  } else if (field === "excludeRedundant") {
    facet.excludeRedundant = value;
  } else if (field === "orderBy") {
    facet.orderBy = normalizeFacetOrderBy(value);
  } else if (field?.startsWith("responseNames.")) {
    const key = field.split(".")[1];
    facet.responseNames = facet.responseNames || {};
    facet.responseNames[key] = value;
  } else {
    facet[field] = value;
  }
  updateRequestJson();
}

function buildRequestBody() {
  const searchRequest = {
    project: [state.settings.project],
  };

  const normalizedOrderBy = normalizeSearchOrderBy(state.draft.orderBy);
  if (normalizedOrderBy) {
    searchRequest.orderBy = normalizedOrderBy;
  }

  state.draft.filters.forEach((filter) => {
    if (!filter.type || !SEARCH_REQUEST_FILTER_KEYS.includes(filter.type)) {
      return;
    }
    if (Array.isArray(filter.values) && filter.values.length) {
      searchRequest[filter.type] = filter.values;
    }
  });

  searchRequest.facets = state.draft.facets
    .map((facet) => {
      const activeValueField = getFacetActiveValueField(facet);
      const mapped = {
        name: normalizeFacetName(facet.name),
        responseNames: facet.responseNames || undefined,
        filterValues: activeValueField === "filterValues" && facet.filterValues?.length ? facet.filterValues : undefined,
        selectValues: activeValueField === "selectValues" && facet.selectValues?.length ? facet.selectValues : undefined,
        values: activeValueField === "values" && facet.values?.length ? facet.values : undefined,
        interval: activeValueField === "interval" ? facet.interval : undefined,
        additionalType: facet.additionalType?.length ? facet.additionalType : undefined,
        orderBy: normalizeFacetOrderBy(facet.orderBy),
        orderDirection: facet.orderDirection || undefined,
        count: facet.count || undefined,
        scope: facet.scope || undefined,
        excludeRedundant: facet.excludeRedundant || undefined,
      };
      return mapped;
    })
    .filter((facet) => facet.name);

  return {
    name: state.draft.name,
    description: state.draft.description,
    searchRequest,
  };
}

function updateRequestJson() {
  const requestBody = buildRequestBody();
  state.responses.request = requestBody;
  elements.requestJson.textContent = JSON.stringify(requestBody, null, 2);
  
  // Update OpenAI request display if available
  if (state.responses.openaiRequest && Object.keys(state.responses.openaiRequest).length > 0) {
    elements.openaiRequestJson.textContent = JSON.stringify(state.responses.openaiRequest, null, 2);
  }
}

function setResponseJson(target, data) {
  target.textContent = data ? JSON.stringify(data, null, 2) : "";
}

function syncViewIdInUrl(viewId, options = {}) {
  const { historyMode = "replace" } = options;
  const url = new URL(window.location.href);
  if (viewId == null || String(viewId).trim() === "") {
    url.searchParams.delete("viewId");
  } else {
    url.searchParams.set("viewId", String(viewId));
  }
  if (historyMode === "push") {
    window.history.pushState({}, "", url.toString());
    return;
  }
  window.history.replaceState({}, "", url.toString());
}

function getRequestedViewIdFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const viewId = params.get("viewId");
  if (typeof viewId !== "string") {
    return null;
  }
  const trimmed = viewId.trim();
  return trimmed || null;
}

function hasLoadedConfiguration() {
  return !!(String(state.settings.apiKey || "").trim() && String(state.settings.project || "").trim());
}

async function selectViewById(viewId, options = {}) {
  const {
    showNotFoundAlert = false,
    ensureViewsLoaded = true,
    historyMode = "replace",
  } = options;

  const normalizedViewId = typeof viewId === "string" ? viewId.trim() : "";
  if (!normalizedViewId) {
    state.selectedViewId = null;
    renderViews();
    updateButtonStates();
    updateEditorViewTitle();
    return;
  }

  if (ensureViewsLoaded) {
    await loadViews();
  }

  const matchedView = state.views.find((view) => {
    const currentViewId = getViewId(view);
    return currentViewId != null && String(currentViewId) === normalizedViewId;
  });

  if (!matchedView) {
    if (showNotFoundAlert) {
      alert("Dies View wurde nicht gefunden. Evlt. stimmt die Konfiguration nicht");
    }
    return;
  }

  state.selectedViewId = getViewId(matchedView);
  syncViewIdInUrl(state.selectedViewId, { historyMode });
  renderViews();
  updateButtonStates();
  updateEditorViewTitle();
  await loadSelectedView();
}

async function tryLoadViewFromDeepLink() {
  const requestedViewId = getRequestedViewIdFromUrl();
  if (!requestedViewId || !hasLoadedConfiguration()) {
    return;
  }

  await selectViewById(requestedViewId, {
    showNotFoundAlert: true,
    ensureViewsLoaded: true,
    historyMode: "replace",
  });
}

function handleBrowserNavigation() {
  const requestedViewId = getRequestedViewIdFromUrl();

  if (!hasLoadedConfiguration()) {
    return;
  }

  selectViewById(requestedViewId, {
    showNotFoundAlert: false,
    ensureViewsLoaded: true,
    historyMode: "replace",
  }).catch((error) => {
    console.error("Error restoring view from browser navigation:", error);
  });
}

function switchEditorTab(tabName) {
  editorTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  editorTabContents.forEach((content) => content.classList.toggle("active", content.id === `tab-${tabName}`));
  
  if (tabName === "history") {
    renderHistory();
  }
}

function switchDataTab(tabName) {
  dataTabs.forEach((tab) => tab.classList.toggle("active", tab.getAttribute("data-sub-tab") === tabName));
  dataTabContents.forEach((content) => content.classList.toggle("active", content.id === `data-tab-${tabName}`));
}

function switchPreviewTab(tabName) {
  previewTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  previewTabContents.forEach((content) => content.classList.toggle("active", content.id === `tab-${tabName}`));

  if (tabName === "live") {
    renderLivePreview();
  } else if (tabName === "facets") {
    renderFacetsPreview();
  }
}

async function loadViews() {
  try {
    showLoading();
    const data = await apiRequest("/search/views", { method: "GET" });
    state.views = Array.isArray(data) ? data : [];
    renderViews();
  } catch (error) {
    state.views = [];
    renderViews();
    setResponseJson(elements.responseJson, error);
  } finally {
    hideLoading();
  }
}

async function loadSelectedView() {
  if (!state.selectedViewId) return;
  try {
    showLoading();
    const data = await apiRequest(`/search/views/${state.selectedViewId}`, { method: "GET" });
    state.responses.response = data;
    setResponseJson(elements.responseJson, data);
    applyViewToDraft(data);
    renderHistory();
    const editorPanel = document.querySelector("details.panel.wide");
    if (editorPanel) {
      editorPanel.open = true;
    }
    switchEditorTab("draft");
  } catch (error) {
    setResponseJson(elements.responseJson, error);
  } finally {
    hideLoading();
  }
}

function applyViewToDraft(view) {
  state.draft.name = view.name || "";
  state.draft.description = view.description || "";
  state.draft.orderBy = normalizeSearchOrderBy(view.searchRequest?.orderBy);
  state.draft.scheduleStrategy = view.scheduleStrategy || "Daily";
  
  // Reset filters
  state.draft.filters = [];

  SEARCH_REQUEST_FILTER_KEYS.forEach((key) => {
    const values = view.searchRequest?.[key];
    if (Array.isArray(values) && values.length) {
      state.draft.filters.push({
        type: key,
        values,
      });
    }
  });
  
  state.draft.facets = extractFacets(view.searchRequest)
    .map(mapFacetToDraft)
    .filter(Boolean);
  renderDraft();
}

async function createView() {
  try {
    showLoading();
    const requestBody = buildRequestBody();
    const data = await apiRequest("/search/views", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    state.responses.response = data;
    setResponseJson(elements.responseJson, data);
    state.selectedViewId = null;
    syncViewIdInUrl(null);
    updateEditorViewTitle();
    await loadViews();
  } catch (error) {
    setResponseJson(elements.responseJson, error);
    hideLoading();
  }
}

async function updateView() {
  if (!state.selectedViewId) return;
  try {
    showLoading();
    
    const requestBody = buildRequestBody();
    const data = await apiRequest(`/search/views/${state.selectedViewId}`, {
      method: "PUT",
      body: JSON.stringify(requestBody),
    });
    
    // Only save version to history after successful update (status 200)
    if (state.responses.response && Object.keys(state.responses.response).length > 0) {
      addVersionToHistory(state.selectedViewId, state.responses.response);
    }
    
    state.responses.response = data;
    setResponseJson(elements.responseJson, data);
    updateEditorViewTitle();
    await loadViews();
    renderHistory();
  } catch (error) {
    // Show error message in popup with complete response when status is not 200
    const errorMessage = {
      error: "Update failed",
      status: error.status || "unknown",
      message: error.message || "Request failed",
      details: error.data || error
    };
    setResponseJson(elements.responseJson, errorMessage);
    showErrorModal(error);
    hideLoading();
  }
}

async function deleteView() {
  if (!state.selectedViewId) return;
  if (!confirm("Delete this view?") ) return;
  try {
    showLoading();
    await apiRequest(`/search/views/${state.selectedViewId}`, { method: "DELETE" });
    state.selectedViewId = null;
    syncViewIdInUrl(null);
    updateEditorViewTitle();
    await loadViews();
    setResponseJson(elements.responseJson, { message: "Deleted." });
  } catch (error) {
    setResponseJson(elements.responseJson, error);
    hideLoading();
  }
}

async function duplicateView() {
  if (!state.selectedViewId) return;
  try {
    showLoading();
    const sourceView = await apiRequest(`/search/views/${state.selectedViewId}`, { method: "GET" });

    const sourceName = String(sourceView?.name || state.draft.name || "Untitled View").trim() || "Untitled View";
    const duplicateName = `${sourceName} - Copy`;

    state.responses.response = sourceView;
    applyViewToDraft(sourceView);

    const requestBody = buildRequestBody();
    requestBody.name = duplicateName;

    const createdView = await apiRequest("/search/views", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    state.responses.response = createdView;
    setResponseJson(elements.responseJson, createdView);
    state.draft.name = duplicateName;
    renderDraft();

    await loadViews();

    const createdViewId = getViewId(createdView);
    if (createdViewId != null) {
      state.selectedViewId = createdViewId;
      syncViewIdInUrl(state.selectedViewId, { historyMode: "push" });
      updateEditorViewTitle();
      renderViews();
      updateButtonStates();
      await loadSelectedView();
    }
  } catch (error) {
    setResponseJson(elements.responseJson, error);
  } finally {
    hideLoading();
  }
}

async function previewResults() {
  if (!state.selectedViewId) {
    setResponseJson(elements.resultsJson, { message: "Select a view first." });
    return;
  }
  try {
    showLoading();
    const data = await apiRequest("/search", {
      method: "GET",
      query: { viewId: state.selectedViewId },
    });
    state.responses.results = data;
    setResponseJson(elements.resultsJson, data);
    const resultsPanel = document.getElementById("resultsPanel");
    if (resultsPanel) {
      resultsPanel.open = true;
    }
    switchPreviewTab("live");
  } catch (error) {
    setResponseJson(elements.resultsJson, error);
  } finally {
    hideLoading();
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text || "");
}

function extractJsonFromText(text) {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;
  let depth = 0;
  for (let i = firstBrace; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") depth -= 1;
    if (depth === 0) {
      const candidate = text.slice(firstBrace, i + 1);
      try {
        return JSON.parse(candidate);
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

function wireEvents() {
  elements.refreshViewsBtn.addEventListener("click", loadViews);
  elements.loadViewBtn.addEventListener("click", loadSelectedView);
  if (elements.duplicateViewBtn) {
    elements.duplicateViewBtn.addEventListener("click", duplicateView);
  }
  if (elements.duplicateEditorViewBtn) {
    elements.duplicateEditorViewBtn.addEventListener("click", duplicateView);
  }
  elements.deleteViewBtn.addEventListener("click", deleteView);

  if (elements.viewSearchInput) {
    elements.viewSearchInput.addEventListener("input", () => {
      state.viewSearchQuery = elements.viewSearchInput.value || "";
      renderViews();
    });
  }

  elements.draftName.addEventListener("input", () => {
    state.draft.name = elements.draftName.value;
    updateRequestJson();
  });

  elements.draftDescription.addEventListener("input", () => {
    state.draft.description = elements.draftDescription.value;
    updateRequestJson();
  });

  if (elements.draftOrderBy) {
    elements.draftOrderBy.addEventListener("input", () => {
      state.draft.orderBy = normalizeSearchOrderBy(elements.draftOrderBy.value);
      updateRequestJson();
    });
  }

  elements.addFilterBtn.addEventListener("click", () => {
    state.draft.filters.push({
      type: "combinedTypeTree",
      values: [],
    });
    renderFilters();
  });

  elements.addFacetBtn.addEventListener("click", () => {
    state.draft.facets.push({
      name: FACET_NAME_OPTIONS[0],
      responseNames: { de: "", en: "" },
      filterValues: [],
      selectValues: [],
      values: [],
      interval: undefined,
      valueField: "filterValues",
      additionalType: [],
      orderBy: "name",
      orderDirection: "",
      count: undefined,
      scope: "current",
      excludeRedundant: false,
    });
    renderFacets();
  });

  if (elements.addCopiedFilterBtn) {
    elements.addCopiedFilterBtn.addEventListener("click", addCopiedFilterToDraft);
  }

  if (elements.addCopiedFacetBtn) {
    elements.addCopiedFacetBtn.addEventListener("click", addCopiedFacetToDraft);
  }

  elements.createViewBtn.addEventListener("click", createView);
  elements.updateViewBtn.addEventListener("click", updateView);
  elements.previewResultsBtn.addEventListener("click", previewResults);

  if (elements.copyRequestBtn) {
    elements.copyRequestBtn.addEventListener("click", () =>
      copyToClipboard(elements.requestJson.textContent)
    );
  }
  
  if (elements.copyOpenaiRequestBtn) {
    elements.copyOpenaiRequestBtn.addEventListener("click", () =>
      copyToClipboard(elements.openaiRequestJson.textContent)
    );
  }
  
  if (elements.copyResponseBtn) {
    elements.copyResponseBtn.addEventListener("click", () =>
      copyToClipboard(elements.responseJson.textContent)
    );
  }

  editorTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchEditorTab(tab.dataset.tab));
  });

  dataTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchDataTab(tab.getAttribute("data-sub-tab")));
  });

  previewTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchPreviewTab(tab.dataset.tab));
  });
}

function init() {
  loadSettings();
  renderSettingsConfigLabel();
  loadViewHistory();
  renderDraft();
  
  // Initialize tab groups before wireEvents
  editorTabs = document.querySelectorAll("#editorTabs .tab");
  editorTabContents = document.querySelectorAll("details.panel.wide > .tab-content");
  dataTabs = document.querySelectorAll("#dataTabs .tab");
  dataTabContents = document.querySelectorAll("#tab-data .data-tab-content");
  previewTabs = document.querySelectorAll("#previewTabs .tab");
  previewTabContents = document.querySelectorAll("#resultsPanel .tab-content");

  switchDataTab("response");
  
  wireEvents();
  window.addEventListener("popstate", handleBrowserNavigation);
  
  // Check if there's a draft from the chatbot
  const chatbotDraft = localStorage.getItem("aiviewmanager.chatbot.draft");
  if (chatbotDraft) {
    try {
      const json = JSON.parse(chatbotDraft);
      state.draft.name = json.name || state.draft.name;
      state.draft.description = json.description || state.draft.description;
      state.draft.orderBy = normalizeSearchOrderBy(json.searchRequest?.orderBy);
      state.draft.scheduleStrategy = json.scheduleStrategy || state.draft.scheduleStrategy;
      
      const searchRequest = json.searchRequest || {};
      state.draft.filters = [];

      SEARCH_REQUEST_FILTER_KEYS.forEach((key) => {
        const values = searchRequest[key];
        if (Array.isArray(values) && values.length) {
          state.draft.filters.push({
            type: key,
            values,
          });
        }
      });
      
      state.draft.facets = extractFacets(searchRequest)
        .map(mapFacetToDraft)
        .filter(Boolean);
      renderDraft();
      localStorage.removeItem("aiviewmanager.chatbot.draft");
      updateSettingsStatus("Draft vom Chatbot geladen!", false);
    } catch (error) {
      console.error("Error loading chatbot draft:", error);
    }
  }
  
  // Save state for chatbot context
  window.addEventListener("beforeunload", () => {
    const stateToSave = {
      selectedViewId: state.selectedViewId,
      views: state.views,
    };
    localStorage.setItem("aiviewmanager.state", JSON.stringify(stateToSave));
  });

  document.querySelectorAll("details.panel").forEach((panel) => {
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      document.querySelectorAll("details.panel").forEach((other) => {
        if (other !== panel) {
          other.open = false;
        }
      });
    });
  });

  tryLoadViewFromDeepLink().catch((error) => {
    console.error("Error loading deep linked view:", error);
  });

}

init();
