const API_FETCH = "https://terratechpacks.com/App_3D/category_fetch.php";
const API_ADD = "https://terratechpacks.com/App_3D/category_add.php";
const API_REMOVE = "https://terratechpacks.com/App_3D/category_remove.php";
const CAT_API_FETCH_PATTERNS =
  "https://terratechpacks.com/App_3D/pattern_fetch.php";
const CAT_API_DELETE_PATTERNS =
  "https://terratechpacks.com/App_3D/pattern_remove.php";

function initCategoryPage() {
  fetchCategories();

  const modal = document.getElementById("category-modal");
  const openBtn = document.getElementById("open-category-modal");
  const closeBtn = document.querySelector(".close-modal");
  const cancelBtn = document.getElementById("close-modal-btn");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("logo-file");
  const fileNameDisplay = document.getElementById("file-name-display");

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      resetForm();
      modal.style.display = "flex";
    });
  }

  const closeModal = () => {
    modal.style.display = "none";
    resetForm();
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  // Drag and Drop Logic
  if (dropZone) {
    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = "#FFF9F0";
      dropZone.style.borderColor = "#e69020";
    };

    dropZone.ondragleave = () => {
      dropZone.style.backgroundColor = "transparent";
      dropZone.style.borderColor = "#FDAB48";
    };

    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = "transparent";
      dropZone.style.borderColor = "#FDAB48";
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateFileName();
      }
    };

    fileInput.onchange = () => updateFileName();
  }

  function updateFileName() {
    const preview = document.getElementById("preview-image");
    const placeholder = document.getElementById("upload-placeholder");

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileNameDisplay.textContent = `Selected: ${file.name}`;

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (preview) {
            preview.src = e.target.result;
            preview.style.display = "block";
          }
          if (placeholder) placeholder.style.display = "none";
        };
        reader.readAsDataURL(file);
      }
    } else {
      fileNameDisplay.textContent = "";
      if (preview) {
        preview.src = "";
        preview.style.display = "none";
      }
      if (placeholder) placeholder.style.display = "flex";
    }
  }

  function resetForm() {
    const nameInput = document.getElementById("category-name");
    const shapeSelect = document.getElementById("shape-type");
    const preview = document.getElementById("preview-image");
    const placeholder = document.getElementById("upload-placeholder");

    if (nameInput) nameInput.value = "";
    if (shapeSelect) shapeSelect.value = "";
    if (fileInput) fileInput.value = "";
    if (fileNameDisplay) fileNameDisplay.textContent = "";

    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }
    if (placeholder) placeholder.style.display = "flex";
  }
}

// Fetch and render categories
async function fetchCategories() {
  const tableBody = document.getElementById("category-table-body");
  if (!tableBody) return;

  // Show loading message
  tableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  try {
    const response = await fetch(API_FETCH, { cache: "no-store" });
    const data = await response.json();

    console.log("Fetched categories:", data);

    if (data.status === "success") {
      renderCategories(data.data || []);
    } else {
      renderCategories([], data.message || "Failed to load categories.");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    renderCategories([], "Error: " + error.message);
  }
}

// Add a new category
async function addCategory() {
  const input = document.getElementById("category-name");
  const fileInput = document.getElementById("logo-file");
  const shapeTypeInput = document.getElementById("shape-type");

  if (!input || !fileInput || !shapeTypeInput)
    return showAlert("Input elements not found.", "error");

  const name = input.value.trim();
  const shapeType = shapeTypeInput.value;
  const logoFile = fileInput.files[0];

  if (!shapeType) return showAlert("Please select a shape type.", "warning");
  if (!name) return showAlert("Please enter a category name.", "warning");
  if (!logoFile) return showAlert("Please select a logo image.", "warning");

  // Create a new FormData object to handle both text and file
  const formData = new FormData();
  formData.append("category", name);
  formData.append("shape_type", shapeType);
  formData.append("logo", logoFile);

  try {
    const submitBtn = document.querySelector(".submit-btn");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

    const response = await fetch(API_ADD, {
      method: "POST",
      body: formData, // Sending form data including the file
    });

    const data = await response.json();

    if (data.status === "success") {
      showAlert("Category added successfully!");
      const modal = document.getElementById("category-modal");
      if (modal) modal.style.display = "none";

      input.value = "";
      shapeTypeInput.value = "";
      fileInput.value = ""; // Reset the file input
      const fileNameDisplay = document.getElementById("file-name-display");
      if (fileNameDisplay) fileNameDisplay.textContent = "";

      fetchCategories();
    } else {
      showAlert(
        "Error adding category: " + (data.message || "Unknown error"),
        "error",
      );
    }
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  } catch (err) {
    console.error("Add error:", err);
    showAlert("An error occurred while adding the category.", "error");
    const submitBtn = document.querySelector(".submit-btn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Submit";
    }
  }
}

// ✅ Remove a category (and its patterns)
async function removeCategory(id, categoryName, shapeType) {
  showConfirm(
    `Deleting "${categoryName}" will also remove all its patterns. Continue?`,
    async () => {
      showLoading(`Removing "${categoryName}" and its patterns...`);
      try {
        // 1. Fetch all patterns to find matches
        const pRes = await fetch(CAT_API_FETCH_PATTERNS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_name: "" }),
        });
        const pData = await pRes.json();

        if (pData.status === "success" && Array.isArray(pData.data)) {
          // Filter patterns belonging to this category and shape
          const patternsToDelete = pData.data.filter((p) => {
            const pCat = (p.category_name || "").trim().toLowerCase();
            const pShape = (p.shape_type || "").trim().toLowerCase();
            const cCat = (categoryName || "").trim().toLowerCase();
            const cShape = (shapeType || "").trim().toLowerCase();
            // Strictly match both category and shape
            return pCat === cCat && pShape === cShape;
          });

          // 2. Delete each matching pattern
          for (const pattern of patternsToDelete) {
            await fetch(CAT_API_DELETE_PATTERNS, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: pattern.id }),
            });
          }
        }

        // 3. Finally remove the category
        const response = await fetch(API_REMOVE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: id }),
        });

        const data = await response.json();

        if (data.status === "success") {
          hideLoading();
          showAlert("Category and all associated patterns removed.");
          fetchCategories();
        } else {
          hideLoading();
          showAlert(
            "Error removing category: " + (data.message || "Unknown error"),
            "error",
          );
        }
      } catch (error) {
        hideLoading();
        console.error("Remove error:", error);
        showAlert("An error occurred during cascading deletion.", "error");
      }
    },
  );
}

// Render categories into table
function renderCategories(categories, errorMessage = "") {
  const tableBody = document.getElementById("category-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = ""; // Clear the table body before rendering new data

  if (errorMessage) {
    tableBody.innerHTML = `<tr><td colspan="5">${escapeHtml(errorMessage)}</td></tr>`; // Adjust column span to 5
    return;
  }

  if (!categories || categories.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No categories found</td></tr>'; // Adjust column span to 5
    return;
  }

  categories.forEach((cat, index) => {
    const id = Number(cat.id);
    const displayName = capitalize(String(cat.category || ""));
    const shapeType = cat.shape_type || "-";
    const logoUrl = cat.logo_url || "path/to/default-logo.png"; // Provide a fallback default logo if not available

    const baseUrl = "https://terratechpacks.com/App_3D/";

    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(shapeType)}</td>
            <td>${escapeHtml(displayName)}</td>
            <td><img src="${baseUrl + logoUrl}" alt="${escapeHtml(displayName)} Logo" width="50" height="50" /></td> <!-- Display logo -->
            <td class="remove">
                <i class="fa-solid fa-trash trash" onclick="removeCategory(${id}, '${cat.category.replace(/'/g, "\\'")}', '${cat.shape_type}')" style="cursor:pointer;color:red;"></i>
            </td>
        `;
    tableBody.appendChild(row);
  });
}

// Capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Escape HTML to prevent XSS
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

  if (iconEl && msgEl) {
    iconEl.className = "alert-icon " + type;
    if (type === "success")
      iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    else if (type === "error")
      iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    else iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';

    msgEl.innerText = message;
    overlay.style.display = "flex";
  }
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
