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
    if (globalFileInput) {
      globalFileInput.value = ""; // Clear previous
      globalFileInput.click();
    }
  };

  // Handle file selection and immediate upload
  if (globalFileInput) {
    globalFileInput.onchange = async () => {
      const file = globalFileInput.files[0];
      if (!file) return;

      const { category, shape, element } = uploadTarget;
      if (!category || !shape) return;

      let originalContent = "";
      if (element) {
        originalContent = element.innerHTML;
        element.classList.add("loading");
        element.innerHTML = '<span class="spinner solo"></span>';
      }

      const ext = file.name.split(".").pop().toLowerCase();
      const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
      if (!allowed.includes(ext)) {
        if (element) {
          element.classList.remove("loading");
          element.innerHTML = originalContent;
        }
        return alert("Invalid file type.");
      }

      const safeCategory = category.replace(/[^a-z0-9_-]/gi, "_");
      const filename = `${safeCategory}_${Date.now()}.${ext}`;

      // Show a temporary loading indicator if possible, or just proceed
      console.log(`Uploading ${filename} to ${category}...`);

      try {
        const uploadRes = await uploadToAssets(file, filename);
        if (!uploadRes || !uploadRes.success) {
          throw new Error("Upload failed.");
        }

        const res = await fetch(API_UPLOAD_PATTERN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category_name: category,
            shape_type: shape,
            pattern_url: filename,
          }),
        });
        const result = await res.json();

        if (result.status === "success") {
          fetchPatterns(); // Refresh list
          showAlert("Pattern uploaded successfully!");
        } else {
          showAlert("Error: " + (result.message || "Upload failed"), "error");
          if (element) {
            element.classList.remove("loading");
            element.innerHTML = originalContent;
          }
        }
      } catch (err) {
        console.error("Upload error:", err);
        showAlert(err.message || "An error occurred during upload.", "error");
        if (element) {
          element.classList.remove("loading");
          element.innerHTML = originalContent;
        }
      }
    };
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

  // Always use the Grid View (Grouped by Category)
  renderPatternGrid(loadedPatterns, gridContainer);
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
        <th>S.No.</th>
        <th>Shape Type</th>
        <th>Category</th>
        <th style="width: 20%;">Pattern</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  patterns.forEach((p, idx) => {
    const fileName = p.pattern_url || "";
    const imageUrl = `https://terratechpacks.com/App_3D/Patterns/${encodeURIComponent(fileName)}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(p.shape_type)}</td>
      <td>${escapeHtml(p.category_name)}</td>
      <td><img src="${imageUrl}" class="table-img" alt="Pattern" onerror="this.onerror=null;this.src='';"/></td>
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
    // Robust matching: trim and case-insensitive
    const catPatterns = patterns.filter((p) => {
      const pName = (p.category_name || "").trim().toLowerCase();
      const cName = (cat.category || "").trim().toLowerCase();
      return pName === cName || pName.includes(cName) || cName.includes(pName);
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
          .map((p) => {
            const fileName = p.pattern_url || "";
            const imageUrl = `https://terratechpacks.com/App_3D/Patterns/${encodeURIComponent(
              fileName,
            )}`;
            return `
            <div class="pattern-card">
              <img src="${imageUrl}" alt="Pattern" onerror="this.onerror=null;this.src='';"/>
              <button class="remove-pattern-btn" title="Delete Pattern" data-id="${p.id}">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
          `;
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
