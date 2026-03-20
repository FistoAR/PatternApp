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

const MIN_DIMENSIONS = {
  round: { primary: { w: 4153, h: 929 } },
  "round square": { primary: { w: 2186, h: 563 } },
  rectangle: { top: { w: 1074, h: 722 } },
  "sweet box": { primary: { w: 5808, h: 420 }, top: { w: 856, h: 669 } },
  "sweet box tamper evident": {
    primary: { w: 2927, h: 2361 },
    top: { w: 1464, h: 1102 },
  },
};

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function validatePatternDimensions(file, type, shape) {
  const s = (shape || "").toLowerCase().replace(/_/g, " ");
  const req = MIN_DIMENSIONS[s]?.[type];
  if (!req) return { valid: true };

  const { w, h } = await getImageDimensions(file);
  if (w < req.w || h < req.h) {
    return {
      valid: false,
      error: `Minimum dimensions for ${s} ${type === "top" ? "Lid" : "Tub"} are ${req.w}x${req.h}. Your image is ${w}x${h}.`,
    };
  }
  return { valid: true };
}

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
    // If 'el' is the element (common in this app), try to use window.event to stop propagation
    const ev = el && el.stopPropagation ? el : window.event;
    if (ev && ev.stopPropagation) ev.stopPropagation();

    const catName = category || "";
    const shapeName = shape || "";
    uploadTarget = { category: catName, shape: shapeName, element: el };
    openUploadModal(shapeName, catName);
  };

  initPatternLightbox();
}

function initPatternLightbox() {
  if (document.getElementById("pattern-lightbox")) return;
  const lb = document.createElement("div");
  lb.id = "pattern-lightbox";
  lb.className = "pattern-lightbox";
  lb.innerHTML = `
    <div class="lightbox-overlay" onclick="closePatternLightbox()"></div>
    <div id="lightbox-bg" class="lightbox-bg"></div>
    <div class="lightbox-container">
      <button class="lightbox-close" onclick="closePatternLightbox()"><i class="fa-solid fa-times"></i></button>
      
      <!-- Single View -->
      <div id="lightbox-content-single" class="lightbox-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;">
        <img id="lightbox-img" src="" alt="Full Pattern" style="max-width: 90%; max-height: 80vh; object-fit: contain; border-radius: 0.6vw;">
        <div id="lightbox-label" class="lightbox-label" style="margin-top: 1.5vw;"></div>
      </div>

      <!-- Dual Side-by-Side View (50/50) -->
      <div id="lightbox-content-dual" style="display: none; width: 95%; height: 85vh; gap: 2vw; align-items: center; justify-content: center; z-index: 10;">
        <div style="flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1vw;">
           <h4 style="color: white; margin: 0; font-size: 1.2vw; font-weight: 500;">Lid Pattern</h4>
           <img id="lightbox-img-lid" src="" style="max-width: 100%; max-height: calc(100% - 3vw); object-fit: contain; border-radius: 0.6vw;" />
        </div>
        <div style="flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1vw;">
           <h4 style="color: white; margin: 0; font-size: 1.2vw; font-weight: 500;">Tub Pattern</h4>
           <img id="lightbox-img-tub" src="" style="max-width: 100%; max-height: calc(100% - 3vw); object-fit: contain; border-radius: 0.6vw;" />
        </div>
      </div>

      <!-- Vertical View (60/30) -->
      <div id="lightbox-content-vertical" style="display: none; width: 95%; height: 90vh; flex-direction: column; gap: 1vw; align-items: center; justify-content: flex-start; z-index: 10;">
        <div style="width: 100%; height: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5vw;">
           <h4 style="color: white; margin: 0; font-size: 1vw; font-weight: 500;">Lid Pattern</h4>
           <img id="lightbox-img-lid-ver" src="" style="max-width: 100%; max-height: calc(100% - 2vw); object-fit: contain; border-radius: 0.6vw;" />
        </div>
        <div style="width: 100%; height: 30%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5vw;">
           <h4 style="color: white; margin: 0; font-size: 1vw; font-weight: 500;">Tub Pattern</h4>
           <img id="lightbox-img-tub-ver" src="" style="max-width: 100%; max-height: calc(100% - 2vw); object-fit: contain; border-radius: 0.6vw;" />
        </div>
      </div>

      <button id="lightbox-next-btn" class="lightbox-nav-btn next" onclick="toggleLightboxPattern(event)">
        <span>Next</span> <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  `;
  document.body.appendChild(lb);
}

let currentLightboxData = { p: null, view: "tub" };

window.openPatternLightbox = function (id, event) {
  if (event) event.stopPropagation();
  const p = loadedPatterns.find((pat) => pat.id == id);
  if (!p) return;
  currentLightboxData = { p: p, view: p.pattern_url_top ? "lid" : "tub" };
  updateLightboxView();
  const lb = document.getElementById("pattern-lightbox");
  if (lb) lb.classList.add("active");
};

window.closePatternLightbox = function () {
  document.getElementById("pattern-lightbox").classList.remove("active");
};

window.toggleLightboxPattern = function (event) {
  if (event) event.stopPropagation();
  const { p, view } = currentLightboxData;
  if (!p.pattern_url || !p.pattern_url_top) return;
  currentLightboxData.view = view === "tub" ? "lid" : "tub";
  updateLightboxView();
};

function updateLightboxView() {
  const { p, view } = currentLightboxData;
  const baseUrl = `https://terratechpacks.com/App_3D/Patterns/`;

  const sLower = (p.shape_type || "").toLowerCase().replace(/_/g, " ");
  const isSweetBox = sLower === "sweet box";
  const isSweetBoxTE =
    sLower === "sweet box tamper evident" || sLower === "sweet box te";

  const singleBox = document.getElementById("lightbox-content-single");
  const dualBox = document.getElementById("lightbox-content-dual");
  const verticalBox = document.getElementById("lightbox-content-vertical");
  const nextBtn = document.getElementById("lightbox-next-btn");
  const bgEl = document.getElementById("lightbox-bg");

  const urlTop = p.pattern_url_top ? baseUrl + encodeURIComponent(p.pattern_url_top) : null;
  const urlTub = p.pattern_url ? baseUrl + encodeURIComponent(p.pattern_url) : null;

  // Single default image (same as before for fallback)
  const mainUrl = (view === "lid" ? p.pattern_url_top : p.pattern_url) || p.pattern_url_top || p.pattern_url;
  const fullUrl = baseUrl + encodeURIComponent(mainUrl);

  if (isSweetBoxTE && urlTop && urlTub) {
    if (singleBox) singleBox.style.display = "none";
    if (verticalBox) verticalBox.style.display = "none";
    if (dualBox) {
      dualBox.style.display = "flex";
      document.getElementById("lightbox-img-lid").src = urlTop;
      document.getElementById("lightbox-img-tub").src = urlTub;
    }
    if (nextBtn) nextBtn.style.display = "none";
  } else if (isSweetBox && urlTop && urlTub) {
    if (singleBox) singleBox.style.display = "none";
    if (dualBox) dualBox.style.display = "none";
    if (verticalBox) {
      verticalBox.style.display = "flex";
      document.getElementById("lightbox-img-lid-ver").src = urlTop;
      document.getElementById("lightbox-img-tub-ver").src = urlTub;
    }
    if (nextBtn) nextBtn.style.display = "none";
  } else {
    if (dualBox) dualBox.style.display = "none";
    if (verticalBox) verticalBox.style.display = "none";
    if (singleBox) {
      singleBox.style.display = "flex";
      const imgEl = document.getElementById("lightbox-img");
      const labelEl = document.getElementById("lightbox-label");
      imgEl.src = fullUrl;
      labelEl.textContent = view === "lid" ? "Lid Pattern" : "Tub Pattern";
    }
    if (nextBtn) {
      nextBtn.style.display = p.pattern_url && p.pattern_url_top ? "flex" : "none";
    }
  }

  if (bgEl) {
    bgEl.style.backgroundImage = `url('${fullUrl.replace(/'/g, "\\'")}')`;
  }
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

  if (
    shapeLower === "sweet box" ||
    shapeLower === "sweet box te" ||
    shapeLower === "sweet box tamper evident"
  ) {
    slotPrimary.style.display = "flex";
    slotTop.style.display = "flex";
    labelPrimary.textContent = "Tub Pattern";
    labelTop.textContent = "Lid Pattern";
    instruction.textContent = "This shape requires two patterns.";
  } else if (shapeLower === "rectangle") {
    slotPrimary.style.display = "none";
    slotTop.style.display = "flex";
    labelTop.textContent = "Lid Pattern";
    instruction.textContent = "This shape uses only a lid pattern.";
  } else {
    // Round, Round Square, etc.
    slotPrimary.style.display = "flex";
    slotTop.style.display = "none";
    labelPrimary.textContent = "Tub Pattern";
    instruction.textContent = "This shape uses only a tub pattern.";
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

  // Dimension Validation: Collect all errors
  const sizeErrors = [];
  if (pendingFiles.primary) {
    const v = await validatePatternDimensions(
      pendingFiles.primary,
      "primary",
      shape,
    );
    if (!v.valid) sizeErrors.push(v.error);
  }
  if (pendingFiles.top) {
    const v = await validatePatternDimensions(pendingFiles.top, "top", shape);
    if (!v.valid) sizeErrors.push(v.error);
  }

  if (sizeErrors.length > 0) {
    return showAlert(sizeErrors.join("\n"), "error");
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
      if (!res.success) throw new Error("File size is too large");
      payload.pattern_url = filename;
    }

    if (pendingFiles.top) {
      const ext = pendingFiles.top.name.split(".").pop().toLowerCase();
      const filename = `${safeCategory}_top_${Date.now()}.${ext}`;
      const res = await uploadToAssets(pendingFiles.top, filename);
      if (!res.success) throw new Error("File size is too large");
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

const SHAPE_TYPES = [
  {
    id: "Round",
    label: "Round",
    image: "./assets/Angles/round-containers/500ml-round/500ml-round-main.png",
  },
  {
    id: "Round Square",
    label: "Round Square",
    image:
      "./assets/Angles/round-square-containers/450ml-round-square/450ml-round-main.png",
  },
  {
    id: "Rectangle",
    label: "Rectangle",
    image:
      "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-main.png",
  },
  {
    id: "Sweet Box",
    label: "Sweet Box",
    image:
      "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-main.png",
  },
  {
    id: "Sweet Box Tamper Evident",
    label: "Sweet Box Tamper Evident",
    image:
      "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-main.png",
  },
];

function filterAndRenderGrid() {
  const gridContainer = document.getElementById("pattern-grid-container");
  if (!gridContainer) return;

  const shapeFilter = document.getElementById("shape-filter");
  const selectedShape = shapeFilter ? shapeFilter.value : "";

  // Remove table view and use shape selection grid if no shape is selected
  if (selectedShape === "") {
    gridContainer.classList.remove("has-table");
    renderShapeSelectionGrid(gridContainer);
  } else {
    gridContainer.classList.remove("has-table");
    renderPatternGrid(loadedPatterns, gridContainer);
  }
}

function renderShapeSelectionGrid(container) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "shape-selection-wrapper";

  // Filter SHAPE_TYPES to only show those that exist in allCategories
  const availableShapes = SHAPE_TYPES.filter((st) =>
    allCategories.some(
      (cat) =>
        (cat.shape_type || "").trim().toLowerCase() ===
        st.id.trim().toLowerCase(),
    ),
  );

  if (availableShapes.length === 0) {
    container.innerHTML = `<div class="loading-state">No shapes available.</div>`;
    return;
  }

  availableShapes.forEach((shape) => {
    const card = document.createElement("div");
    card.className = "shape-type-big-card";
    card.innerHTML = `
      <div class="shape-icon-container">
        <img src="${shape.image}" alt="${shape.label}" class="shape-type-img" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
      </div>
      <div class="shape-card-footer">
        <h3>${shape.label}</h3>
        <i class="fa-solid fa-chevron-right"></i>
      </div>
    `;
    card.onclick = () => {
      const shapeFilter = document.getElementById("shape-filter");
      if (shapeFilter) {
        shapeFilter.value = shape.id;
        updateCategoryFilterOptions();
        filterAndRenderGrid();
      }
    };
    wrapper.appendChild(card);
  });

  container.appendChild(wrapper);
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

  // Check if any patterns exist for the selected shape
  const hasPatternsForShape = patterns.some((p) => {
    const pShape = (p.shape_type || "").trim().toLowerCase().replace(/_/g, " ");
    const sShape = (selectedShape || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ");
    return pShape === sShape || pShape === "";
  });

  // Add Back Button if filters are active
  if (selectedShape !== "") {
    const headerActions = document.createElement("div");
    headerActions.className = "grid-header-actions";

    const isBigView = selectedShape !== "" && selectedCategory !== "";
    const backBtn = document.createElement("button");
    backBtn.className = "back-navigation-btn";
    const backText = isBigView ? "Back to Categories" : "Back to All Shapes";
    backBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> ${backText}`;

    backBtn.onclick = () => {
      if (selectedCategory) {
        if (categoryFilter) categoryFilter.value = "";
      } else {
        if (shapeFilter) shapeFilter.value = "";
      }
      updateCategoryFilterOptions();
      filterAndRenderGrid();
    };

    // Dimension Display
    const sLower = selectedShape.toLowerCase().replace(/_/g, " ");
    const dims = MIN_DIMENSIONS[sLower];
    let dimStr = "";
    if (dims) {
      if (dims.primary && dims.top) {
        dimStr = `Tub: ${dims.primary.w}×${dims.primary.h}, Lid: ${dims.top.w}×${dims.top.h}`;
      } else if (dims.primary) {
        dimStr = `${dims.primary.w}×${dims.primary.h}`;
      } else if (dims.top) {
        dimStr = `Lid: ${dims.top.w}×${dims.top.h}`;
      }
    }

    const infoEl = document.createElement("div");
    infoEl.className = "shape-dim-info";
    infoEl.innerHTML = dimStr
      ? `<span>Required Dimensions for ${selectedShape}:</span> <strong>${dimStr}</strong>`
      : "";

    headerActions.appendChild(backBtn);
    headerActions.appendChild(infoEl);
    gridContainer.appendChild(headerActions);
  }

  // Show "No Pattern available" if no patterns or categories match
  if (activeCategories.length === 0 && !hasPatternsForShape) {
    const emptyState = document.createElement("div");
    emptyState.className = "loading-state";
    emptyState.textContent = `No Pattern available for ${selectedShape || "this selection"}.`;
    gridContainer.appendChild(emptyState);
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
        ${!isBigView ? `<button class="category-show-btn" onclick="window.viewCategoryDetails('${cat.shape_type.replace(/'/g, "\\'")}', '${cat.category.replace(/'/g, "\\'")}')">Show</button>` : ""}
      </div>
      <div class="patterns-grid">
        <!-- Add Pattern Card -->
        <div class="add-pattern-card" onclick="window.triggerQuickUpload('${cat.category.replace(/'/g, "\\'")}', '${cat.shape_type.replace(/'/g, "\\'")}', this)">
          <i class="fa-solid fa-upload"></i>
          <p><span>Upload</span></p>
        </div>
        <!-- List patterns -->
        ${showPatterns
          .map((p) => {
            const fileName = p.pattern_url || "";
            const fileNameTop = p.pattern_url_top || "";
            const baseUrl = `https://terratechpacks.com/App_3D/Patterns/`;

            if (fileNameTop && fileName) {
              return `
                <div class="pattern-card dual" onclick="window.openPatternLightbox('${p.id}', event)">
                  <div class="pattern-dual-images">
                    <div class="dual-slot">
                      <img src="${baseUrl}${encodeURIComponent(fileNameTop)}" alt="Lid" onerror="this.src='';"/>
                      <span class="dual-label">Lid</span>
                    </div>
                    <div class="dual-slot">
                      <img src="${baseUrl}${encodeURIComponent(fileName)}" alt="Tub" onerror="this.src='';"/>
                      <span class="dual-label">Tub</span>
                    </div>
                  </div>
                  <button class="remove-pattern-btn" title="Delete Pattern" data-id="${p.id}">
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              `;
            } else {
              const imgFile = fileName || fileNameTop;
              const label = fileNameTop ? "Lid Pattern" : "Tub Pattern";
              return `
                <div class="pattern-card" onclick="window.openPatternLightbox('${p.id}', event)">
                  <img src="${baseUrl}${encodeURIComponent(imgFile)}" alt="Pattern" onerror="this.src='';"/>
                  <span class="dual-label bottom">${label}</span>
                  <button class="remove-pattern-btn" title="Delete Pattern" data-id="${p.id}">
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              `;
            }
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

  // Dimension Validation
  const type = shapeType.toLowerCase() === "rectangle" ? "top" : "primary";
  const v = await validatePatternDimensions(file, type, shapeType);
  if (!v.valid) return alert(v.error);

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
    const modal = document.getElementById("upload-modal");
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
  showLoading("Deleting pattern...");
  try {
    const res = await fetch(API_DELETE_PATTERNS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    hideLoading();
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
    hideLoading();
    console.error("Delete error:", err);
    showAlert("An error occurred while deleting the pattern.", "error");
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

// Loading Indicator Helpers
function showLoading(message = "Processing...") {
  let overlay = document.getElementById("custom-loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "custom-loading-overlay";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
      <div class="alert-box">
        <div class="spinner-large"></div>
        <div id="loading-message" class="alert-message"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  const msgEl = overlay.querySelector(".alert-message");
  if (msgEl) msgEl.innerText = message;
  overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = document.getElementById("custom-loading-overlay");
  if (overlay) overlay.style.display = "none";
}

// Initial call
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPatternPage);
} else {
  initPatternPage();
}
