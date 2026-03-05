const API_FETCH_CATEGORIES =
  "https://terratechpacks.com/App_3D/category_fetch.php";
const API_UPLOAD_PATTERN = "https://terratechpacks.com/App_3D/pattern_add.php";
const API_UPLOAD_IMAGE =
  "https://terratechpacks.com/App_3D/upload_to_assets.php";
const API_FETCH_PATTERNS =
  "https://terratechpacks.com/App_3D/pattern_fetch.php";
const API_DELETE_PATTERNS =
  "https://terratechpacks.com/App_3D/pattern_remove.php";

let uploadTarget = { category: "", shape: "" };
let allCategories = []; // Global storage for categories
let pendingFiles = { primary: null, top: null };

function initPatternPage() {
  const globalFileInput = document.getElementById("global-pattern-file");
  const shapeFilter = document.getElementById("shape-filter");
  const categoryFilter = document.getElementById("category-filter");

  fetchPatternCategories();
  fetchPatterns();

  if (shapeFilter) {
    shapeFilter.addEventListener("change", () => {
      updateCategoryFilterOptions();
      filterAndRenderGrid();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      filterAndRenderGrid();
    });
  }

  // Global View Detail Trigger
  window.viewCategoryDetails = function (shape, category) {
    if (shapeFilter && categoryFilter) {
      shapeFilter.value = shape || "";
      updateCategoryFilterOptions(); // Refresh category list based on shape
      categoryFilter.value = category || "";
      filterAndRenderGrid();
    }
  };

  // Global Quick Upload Trigger
  window.triggerQuickUpload = function (category, shape, el) {
    uploadTarget = { category, shape, element: el };
    openUploadModal(shape, category);
  };
}

function openUploadModal(shape, category) {
  const modal = document.getElementById("upload-modal");
  const slotPrimary = document.getElementById("slot-primary");
  const slotTop = document.getElementById("slot-top");
  const labelPrimary = document.getElementById("label-primary");
  const labelTop = document.getElementById("label-top");
  const instruction = document.getElementById("upload-instruction");
  const title = document.getElementById("modal-title");

  if (!modal) return;

  // Reset modal state
  pendingFiles = { primary: null, top: null };
  resetUploadArea("trigger-primary", "preview-primary");
  resetUploadArea("trigger-top", "preview-top");

  const shapeLower = (shape || "").toLowerCase().replace(/_/g, " ");
  title.textContent = `Upload Patterns for ${category}`;

  if (shapeLower === "sweet box" || shapeLower === "sweet box te") {
    slotPrimary.style.display = "flex";
    slotTop.style.display = "flex";
    labelPrimary.textContent = "Bottom Pattern";
    labelTop.textContent = "Top Pattern";
    instruction.textContent = "This shape requires two patterns.";
  } else if (shapeLower === "rectangle") {
    slotPrimary.style.display = "none";
    slotTop.style.display = "flex";
    labelTop.textContent = "Top Pattern";
    instruction.textContent = "This shape uses only a top pattern.";
  } else {
    // Round, Round Square, etc.
    slotPrimary.style.display = "flex";
    slotTop.style.display = "none";
    labelPrimary.textContent = "Bottom Pattern";
    instruction.textContent = "This shape uses only a bottom pattern.";
  }

  modal.style.display = "flex";

  // Setup listeners
  document.getElementById("close-upload-modal").onclick = () =>
    (modal.style.display = "none");
  document.getElementById("btn-cancel-upload").onclick = () =>
    (modal.style.display = "none");
  document.getElementById("btn-submit-upload").onclick = handleModalSubmit;

  setupUploadSlot(
    "trigger-primary",
    "file-primary",
    "preview-primary",
    "primary",
  );
  setupUploadSlot("trigger-top", "file-top", "preview-top", "top");
}

function setupUploadSlot(triggerId, inputId, previewId, key) {
  const trigger = document.getElementById(triggerId);
  const input = document.getElementById(inputId);
  if (!trigger || !input) return;

  trigger.onclick = () => input.click();
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      pendingFiles[key] = file;
      const reader = new FileReader();
      reader.onload = (re) => {
        const previewEl = document.getElementById(previewId);
        previewEl.innerHTML = `<img src="${re.target.result}" style="width:100%; height:100%; object-fit:contain;" />`;
        trigger.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    }
  };
}

function resetUploadArea(triggerId, previewId) {
  const trigger = document.getElementById(triggerId);
  const preview = document.getElementById(previewId);
  if (!trigger || !preview) return;
  trigger.classList.remove("has-image");
  preview.innerHTML =
    '<i class="fa-solid fa-cloud-upload-alt"></i><p>Click to Upload</p>';
}

async function handleModalSubmit() {
  const { category, shape } = uploadTarget;
  const shapeLower = (shape || "").toLowerCase().replace(/_/g, " ");
  const isDual = shapeLower === "sweet box" || shapeLower === "sweet box te";
  const modal = document.getElementById("upload-modal");
  const submitBtn = document.getElementById("btn-submit-upload");

  // Validation
  if (isDual && (!pendingFiles.primary || !pendingFiles.top)) {
    return showAlert("Both patterns are required for this shape.", "error");
  }
  if (shapeLower === "rectangle" && !pendingFiles.top) {
    return showAlert("Top pattern is required for Rectangle.", "error");
  }
  if (!isDual && shapeLower !== "rectangle" && !pendingFiles.primary) {
    return showAlert("Pattern is required.", "error");
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    let payload = { category_name: category, shape_type: shape };
    const safeCategory = category.replace(/[^a-z0-9_-]/gi, "_");

    if (pendingFiles.primary) {
      const ext = pendingFiles.primary.name.split(".").pop().toLowerCase();
      const filename = `${safeCategory}_primary_${Date.now()}.${ext}`;
      const res = await uploadToAssets(pendingFiles.primary, filename);
      if (!res.success) throw new Error("Primary upload failed");
      payload.pattern_url = filename;
    }

    if (pendingFiles.top) {
      const ext = pendingFiles.top.name.split(".").pop().toLowerCase();
      const filename = `${safeCategory}_top_${Date.now()}.${ext}`;
      const res = await uploadToAssets(pendingFiles.top, filename);
      if (!res.success) throw new Error("Top upload failed");
      payload.pattern_url_top = filename;
    }

    const res = await fetch(API_UPLOAD_PATTERN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.status === "success") {
      modal.style.display = "none";
      fetchPatterns();
      showAlert("Pattern uploaded successfully!");
    } else {
      showAlert(result.message || "Upload failed", "error");
    }
  } catch (err) {
    showAlert(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Pattern";
  }
}

let loadedPatterns = []; // Global storage for patterns

function updateCategoryFilterOptions() {
  const shapeFilter = document.getElementById("shape-filter");
  const categoryFilter = document.getElementById("category-filter");
  if (!shapeFilter || !categoryFilter) return;

  const selectedShape = shapeFilter.value;
  categoryFilter.innerHTML = '<option value="">All Categories</option>';

  const filteredCats = selectedShape
    ? allCategories.filter((cat) => cat.shape_type === selectedShape)
    : allCategories;

  filteredCats.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.category;
    option.textContent = cat.category;
    categoryFilter.appendChild(option);
  });

  // Enable/Disable category filter based on selection
  if (selectedShape === "") {
    categoryFilter.disabled = true;
    categoryFilter.style.opacity = "0.6";
    categoryFilter.style.cursor = "not-allowed";
  } else {
    categoryFilter.disabled = false;
    categoryFilter.style.opacity = "1";
    categoryFilter.style.cursor = "pointer";
  }
}

function filterAndRenderGrid() {
  const gridContainer = document.getElementById("pattern-grid-container");
  if (!gridContainer) return;

  const shapeFilter = document.getElementById("shape-filter");
  const selectedShape = shapeFilter ? shapeFilter.value : "";

  // Show table view if nothing is filtered, otherwise show grid
  if (selectedShape === "") {
    gridContainer.classList.add("has-table");
    renderPatternTable(loadedPatterns, gridContainer);
  } else {
    gridContainer.classList.remove("has-table");
    renderPatternGrid(loadedPatterns, gridContainer);
  }
}

function renderPatternTable(patterns, container) {
  container.innerHTML = "";
  if (!patterns.length) {
    container.innerHTML = `<div class="loading-state">No patterns found.</div>`;
    return;
  }

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "table-responsive";

  const table = document.createElement("table");
  table.className = "pattern-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>S.NO.</th>
        <th>SHAPE TYPE</th>
        <th>CATEGORY NAME</th>
        <th>PATTERN</th>
        <th>ACTION</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  patterns.forEach((p, idx) => {
    const fileName = p.pattern_url || "";
    const fileNameTop = p.pattern_url_top || "";
    const baseUrl = `https://terratechpacks.com/App_3D/Patterns/`;

    let patternDisplay = "";
    if (fileName && fileNameTop) {
      patternDisplay = `
        <div class="table-img-group">
          <div class="table-img-slot">
            <img src="${baseUrl}${encodeURIComponent(fileName)}" class="table-img" alt="Bottom" />
            <span class="table-img-label">Bottom</span>
          </div>
          <div class="table-img-slot">
            <img src="${baseUrl}${encodeURIComponent(fileNameTop)}" class="table-img" alt="Top" />
            <span class="table-img-label">Top</span>
          </div>
        </div>
      `;
    } else {
      const activeFile = fileName || fileNameTop;
      const labelText = fileName ? "Bottom" : "Top";
      patternDisplay = activeFile
        ? `
        <div class="table-img-group">
          <div class="table-img-slot">
            <img src="${baseUrl}${encodeURIComponent(activeFile)}" class="table-img" alt="Pattern" />
            <span class="table-img-label">${labelText}</span>
          </div>
        </div>
        `
        : "-";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(p.shape_type || "-")}</td>
      <td>${escapeHtml(p.category_name)}</td>
      <td>${patternDisplay}</td>
      <td><i class="fa-solid fa-trash table-trash" data-id="${p.id}"></i></td>
    `;
    tbody.appendChild(tr);
  });

  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

  // Attach delete events
  tableWrapper.querySelectorAll(".table-trash").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this pattern?")) {
        deletePattern(id);
      }
    };
  });
}

async function fetchPatternCategories() {
  const shapeFilter = document.getElementById("shape-filter");
  const categoryFilter = document.getElementById("category-filter");
  if (!shapeFilter || !categoryFilter) return;

  try {
    const res = await fetch(API_FETCH_CATEGORIES, { cache: "no-store" });
    const data = await res.json();

    if (data.status === "success" && Array.isArray(data.data)) {
      allCategories = data.data;

      const uniqueShapes = [
        ...new Set(allCategories.map((cat) => cat.shape_type).filter((s) => s)),
      ];

      // Header Shape Filter
      shapeFilter.innerHTML = '<option value="">All Types</option>';
      uniqueShapes.sort().forEach((shape) => {
        const option = document.createElement("option");
        option.value = shape;
        option.textContent = shape;
        shapeFilter.appendChild(option);
      });

      updateCategoryFilterOptions();
      filterAndRenderGrid();
    }
  } catch (err) {
    console.error("Error fetching categories:", err);
  }
}

async function fetchPatterns() {
  const gridContainer = document.getElementById("pattern-grid-container");
  if (!gridContainer) return;

  try {
    const res = await fetch(API_FETCH_PATTERNS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name: "" }),
    });

    const data = await res.json();

    if (data.status === "success" && Array.isArray(data.data)) {
      loadedPatterns = data.data;
      filterAndRenderGrid();
    } else {
      gridContainer.innerHTML = `<div class="loading-state">No patterns found.</div>`;
    }
  } catch (err) {
    console.error("Error fetching patterns:", err);
    gridContainer.innerHTML = `<div class="loading-state">Error loading patterns.</div>`;
  }
}

function renderPatternGrid(patterns, gridContainer) {
  gridContainer.innerHTML = "";

  const shapeFilter = document.getElementById("shape-filter");
  const categoryFilter = document.getElementById("category-filter");
  const selectedShape = shapeFilter ? shapeFilter.value : "";
  const selectedCategory = categoryFilter ? categoryFilter.value : "";

  // Get active categories based on filters
  let activeCategories = allCategories.filter((cat) => {
    if (selectedShape && cat.shape_type !== selectedShape) return false;
    if (selectedCategory && cat.category !== selectedCategory) return false;
    return true;
  });

  // Show all active categories based on selection (include empty categories for easy upload)
  if (activeCategories.length === 0) {
    gridContainer.innerHTML = `<div class="loading-state">No categories available. Use filters to upload to new categories.</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  // If both filters are selected, show in Big View
  const isBigView = selectedShape !== "" && selectedCategory !== "";
  wrapper.className = isBigView
    ? "category-sections-wrapper big-view"
    : "category-sections-wrapper";

  activeCategories.forEach((cat) => {
    // Filter patterns by both category name AND shape type
    const catPatterns = patterns.filter((p) => {
      const pName = (p.category_name || "").trim().toLowerCase();
      const cName = (cat.category || "").trim().toLowerCase();
      // Standardize shape strings for comparison
      const pShape = (p.shape_type || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, " ");
      const cShape = (cat.shape_type || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, " ");

      // Match if names match AND (shapes match exactly OR record is old and has no shape_type)
      return pName === cName && (pShape === cShape || pShape === "");
    });
    const baseUrl = "https://terratechpacks.com/App_3D/";
    const logoUrl = cat.logo_url
      ? baseUrl + cat.logo_url
      : "assets/Logo/logo-icon.png";

    const isBigView = selectedShape !== "" && selectedCategory !== "";
    const displayLimit = 6;
    const showPatterns = isBigView
      ? catPatterns
      : catPatterns.slice(0, displayLimit);
    const hasMore = !isBigView && catPatterns.length > displayLimit;

    const card = document.createElement("div");
    card.className = "category-card";

    card.innerHTML = `
      <div class="category-card-header">
        <div class="header-main-info">
          <img src="${logoUrl}" class="category-card-logo" alt="Logo" onerror="this.src='assets/Logo/logo-icon.png'">
          <div class="category-card-info">
            <h3>${escapeHtml(cat.category)}</h3>
            <span>${escapeHtml(cat.shape_type)}</span>
          </div>
        </div>
        ${!isBigView ? `<button class="category-show-btn" onclick="window.viewCategoryDetails('${cat.shape_type}', '${cat.category}')">Show</button>` : ""}
      </div>
      <div class="patterns-grid">
        <!-- Add Pattern Card -->
        <div class="add-pattern-card" onclick="window.triggerQuickUpload('${cat.category}', '${cat.shape_type}', this)">
          <i class="fa-solid fa-upload"></i>
          <p><span>Upload</span></p>
        </div>
        <!-- List patterns -->
        ${showPatterns
          .flatMap((p) => {
            const fileName = p.pattern_url || "";
            const fileNameTop = p.pattern_url_top || "";
            const baseUrl = `https://terratechpacks.com/App_3D/Patterns/`;
            const cards = [];

            if (fileName) {
              cards.push(`
                <div class="pattern-card">
                  <img src="${baseUrl}${encodeURIComponent(fileName)}" alt="Pattern" onerror="this.src='';"/>
                  <span class="dual-label bottom">Bottom Pattern</span>
                  <button class="remove-pattern-btn" title="Delete Pattern" data-id="${p.id}">
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              `);
            }

            if (fileNameTop) {
              cards.push(`
                <div class="pattern-card">
                  <img src="${baseUrl}${encodeURIComponent(fileNameTop)}" alt="Pattern" onerror="this.src='';"/>
                  <span class="dual-label top">Top Pattern</span>
                  <button class="remove-pattern-btn" title="Delete Pattern" data-id="${p.id}">
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              `);
            }
            return cards;
          })
          .join("")}
        ${
          hasMore
            ? `
          <div class="pattern-more-card" onclick="window.viewCategoryDetails('${cat.shape_type}', '${cat.category}')">
            <span>${catPatterns.length - displayLimit}+</span>
          </div>
        `
            : ""
        }
      </div>
    `;
    wrapper.appendChild(card);
  });

  gridContainer.appendChild(wrapper);

  // Attach delete events
  document.querySelectorAll(".remove-pattern-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      showConfirm("Are you sure you want to delete this pattern?", () => {
        deletePattern(id);
      });
    };
  });
}

async function uploadToAssets(file, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  try {
    const response = await fetch(API_UPLOAD_IMAGE, {
      method: "POST",
      body: formData,
    });
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Upload failed:", error);
    return null;
  }
}

async function uploadPatternHandler() {
  const categorySelect = document.getElementById("category-select");
  const shapeTypeSelect = document.getElementById("shape-type");
  const fileInput = document.getElementById("pattern-file");
  if (!categorySelect || !shapeTypeSelect || !fileInput) return;

  const categoryName = categorySelect.value.trim();
  const shapeType = shapeTypeSelect.value;
  const file = fileInput.files[0];

  if (!categoryName) return alert("Please select a category.");
  if (!shapeType) return alert("Please select a shape type.");
  if (!file) return alert("Please select a pattern file.");

  const ext = file.name.split(".").pop().toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!allowed.includes(ext)) return alert("Invalid file type.");

  const safeCategory = categoryName.replace(/[^a-z0-9_-]/gi, "_");
  const filename = `${safeCategory}_${Date.now()}.${ext}`;

  const uploadRes = await uploadToAssets(file, filename);
  if (!uploadRes || !uploadRes.success) return alert("Upload failed.");

  const res = await fetch(API_UPLOAD_PATTERN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_name: categoryName,
      shape_type: shapeType,
      pattern_url: filename,
    }),
  });
  const result = await res.json();

  if (result.status === "success") {
    alert("Pattern uploaded successfully");
    const modal = document.getElementById("pattern-modal");
    if (modal) modal.style.display = "none";

    fileInput.value = "";
    categorySelect.value = "";
    shapeTypeSelect.value = "";
    const fileNameDisplay = document.getElementById("file-name-display");
    if (fileNameDisplay) fileNameDisplay.textContent = "";

    const shapeFilter = document.getElementById("shape-filter");
    fetchPatterns();
  } else {
    alert("Error: " + (result.message || "Upload failed"));
  }
}

async function deletePattern(id) {
  try {
    const res = await fetch(API_DELETE_PATTERNS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    if (data.status === "success") {
      showAlert("Pattern deleted successfully.");
      fetchPatterns();
    } else {
      showAlert(
        "Error: " + (data.message || "Unable to delete pattern."),
        "error",
      );
    }
  } catch (err) {
    console.error("Delete error:", err);
  }
}

function escapeHtml(unsafe) {
  return String(unsafe).replace(/[&<>"'`=\/]/g, function (s) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;",
      "`": "&#96;",
      "=": "&#61;",
    }[s];
  });
}

// Custom Alert Helper
function showAlert(message, type = "success") {
  let overlay = document.getElementById("custom-alert-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "custom-alert-overlay";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
      <div class="alert-box">
        <div id="alert-icon" class="alert-icon"></div>
        <div id="alert-message" class="alert-message"></div>
        <button class="alert-btn" onclick="closeCustomAlert()">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const iconEl = document.getElementById("alert-icon");
  const msgEl = document.getElementById("alert-message");

  iconEl.className = "alert-icon " + type;
  if (type === "success")
    iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  else if (type === "error")
    iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
  else iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';

  msgEl.innerText = message;
  overlay.style.display = "flex";
}

// Custom Confirm Helper
function showConfirm(message, onConfirm) {
  let overlay = document.getElementById("custom-confirm-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "custom-confirm-overlay";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
      <div class="alert-box">
        <div class="alert-icon error"><i class="fa-solid fa-circle-question"></i></div>
        <div id="confirm-message" class="alert-message"></div>
        <div style="display: flex; gap: 1vw; justify-content: center;">
          <button class="alert-btn" id="confirm-yes-btn">Yes, Delete</button>
          <button class="alert-btn" style="background-color: #eee; color: #333;" id="confirm-no-btn">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const msgEl = document.getElementById("confirm-message");
  const yesBtn = document.getElementById("confirm-yes-btn");
  const noBtn = document.getElementById("confirm-no-btn");

  msgEl.innerText = message;
  overlay.style.display = "flex";

  yesBtn.onclick = () => {
    overlay.style.display = "none";
    onConfirm();
  };

  noBtn.onclick = () => {
    overlay.style.display = "none";
  };
}

window.closeCustomAlert = function () {
  const overlay = document.getElementById("custom-alert-overlay");
  if (overlay) overlay.style.display = "none";
};

// Initial call
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPatternPage);
} else {
  initPatternPage();
}
