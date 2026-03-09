// ---------- PERFORMANCE HELPERS ----------
const viewerTextureCache = new WeakMap(); // per-viewer texture cache
let rotateSpeedAnim;

function updateAutoRotateSmooth(enabled, instantaneous = false) {
  if (!mainViewer) return;
  cancelAnimationFrame(rotateSpeedAnim);

  const targetSpeed = enabled ? 60 : 0;
  // Get current speed from attribute or default
  const startSpeed =
    parseFloat(mainViewer.getAttribute("rotation-per-second")) || 0;

  if (instantaneous) {
    mainViewer.autoRotate = enabled;
    mainViewer.setAttribute("rotation-per-second", `${targetSpeed}deg`);
    return;
  }

  // If enabling, turn on the property immediately
  if (enabled) mainViewer.autoRotate = true;

  const startTime = performance.now();
  const duration = 800; // Smoother 0.8s transition

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth deceleration/acceleration (easeInOutSine)
    const eased = -(Math.cos(Math.PI * progress) - 1) / 2;

    const currentSpeed = startSpeed + (targetSpeed - startSpeed) * eased;
    mainViewer.setAttribute("rotation-per-second", `${currentSpeed}deg`);

    if (progress < 1) {
      rotateSpeedAnim = requestAnimationFrame(animate);
    } else {
      // If we finished turning it off, disable the property to save energy
      if (!enabled) mainViewer.autoRotate = false;
    }
  }
  rotateSpeedAnim = requestAnimationFrame(animate);
}

function stripQuery(u) {
  try {
    const url = new URL(u, location.href);
    return url.origin + url.pathname;
  } catch (e) {
    // fallback for relative/data urls
    return String(u).split("?")[0];
  }
}

function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Helper: Physically rotate an image and return data URL
async function rotateImage(url, degrees) {
  if (degrees === 0) return url;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const radians = (degrees * Math.PI) / 180;

      const absDegrees = Math.abs(degrees);
      if (absDegrees === 90 || absDegrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => resolve(url); // fallback to original
    img.src = url;
  });
}

/********** AVAILABLE OPTIONS **********/
const options = {
  lid: ["White", "Transparency"],
  tub: ["White", "Transparency", "Black"],
};

/********** MATERIAL NAMES **********/
const PATTERN_MATERIAL_NAME = ["tub_label"];
const RECTANGLE_PATTERN_MATERIAL_NAME = ["lid_label"];
const LOGO_MATERIAL_NAME = "logo";

/********** PART MATERIAL NAMES **********/
const PART_MATERIALS = {
  lid: ["lid"], // Synchronized with model names
  tub: ["tub"],
};

/********** UPDATE MATERIAL COLOR **********/
function updateMaterialColor(part, color, { skipWait = false } = {}) {
  const viewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );

  const factors = {
    white: [1, 1, 1, 1],
    black: [0, 0, 0, 1],
    // High-visibility semi-transparency base
    transparency: [0.6, 0.6, 0.6, 0.36],
  };

  const lowerColor = color.toLowerCase();
  let factor = factors[lowerColor];

  if (!factor && color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const a = color.length > 7 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
    factor = [r, g, b, a];
  } else if (!factor && color.startsWith("rgba")) {
    const m = color.match(/[\d.]+/g);
    if (m) {
      factor = [m[0] / 255, m[1] / 255, m[2] / 255, parseFloat(m[3])];
    }
  }

  if (!factor) return;

  viewers.forEach((viewer) => {
    const applyToViewer = () => {
      const materialNames = PART_MATERIALS[part] || [];
      console.log(
        `[ColorUpdate] Target Part: ${part}, Color: ${color}, Checking materials:`,
        materialNames,
      );

      materialNames.forEach((name) => {
        const mat = viewer.model?.materials.find((m) => m.name === name);
        if (!mat) {
          // Silently ignore if material name doesn't exist on this specific model
          return;
        }

        console.log(
          `[ColorUpdate] Found material: ${name} on model: ${viewer.alt}`,
        );

        if (mat.pbrMetallicRoughness.baseColorTexture) {
          mat.pbrMetallicRoughness.baseColorTexture.setTexture(null);
        }

        mat.pbrMetallicRoughness.setBaseColorFactor(factor);

        // Special settings for Premium Transparency
        if (lowerColor === "transparency") {
          // emissive #666666 => [0.4, 0.4, 0.4] for consistent visibility
          mat.setEmissiveFactor([0.4, 0.4, 0.4]);
          // User requested metallic 1, roughness 0.12 for highly reflective effect
          mat.pbrMetallicRoughness.setMetallicFactor(1.0);
          mat.pbrMetallicRoughness.setRoughnessFactor(0.12);
        } else {
          // Reset for opaque colors
          mat.setEmissiveFactor([0, 0, 0]);

          // Premium White Effect: Metallic 1, Roughness 0.53
          if (lowerColor === "white" || color.toLowerCase() === "#ffffff") {
            mat.pbrMetallicRoughness.setMetallicFactor(1.0);
            mat.pbrMetallicRoughness.setRoughnessFactor(0.53);
          } else {
            mat.pbrMetallicRoughness.setMetallicFactor(0.0);
            mat.pbrMetallicRoughness.setRoughnessFactor(0.9);
          }
        }

        // Apply transparency mode
        mat.setAlphaMode(lowerColor === "transparency" ? "BLEND" : "OPAQUE");
        mat.doubleSided = true;
      });
    };

    if (!viewer.model && !skipWait) {
      viewer.addEventListener("load", applyToViewer, { once: true });
    } else {
      applyToViewer();
    }
  });

  state.selectedColors[part] = lowerColor;
  localStorage.setItem("selectedColors", JSON.stringify(state.selectedColors));
}

/********** RENDER OPTIONS **********/
function renderOptions(part) {
  colorOptions.innerHTML = "";
  // Set the default color for tub to white
  const savedColor =
    state.selectedColors[part] ||
    (part === "tub" ? "white" : options[part][0].toLowerCase());

  options[part].forEach((color) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "color";
    input.value = color.toLowerCase();
    if (input.value === savedColor) input.checked = true;

    input.addEventListener("change", () => {
      state.selectedColors[part] = input.value;
      localStorage.setItem(
        "selectedColors",
        JSON.stringify(state.selectedColors),
      );
      updateMaterialColor(part, input.value);
    });

    label.append(input, " " + color);
    colorOptions.appendChild(label);
  });

  // apply saved color immediately
  updateMaterialColor(part, savedColor);
}

/********** UPDATE PART **********/
function updatePart(part) {
  if (options[part]) {
    renderOptions(part);
  }
}

/********** CONFIG **********/
const BASE_URL = "https://terratechpacks.com/App_3D/Patterns/";
const API_FETCH_PATTERNS =
  "https://terratechpacks.com/App_3D/pattern_fetch.php";
const API_FETCH_CATEGORIES =
  "https://terratechpacks.com/App_3D/category_fetch.php";
const MODEL_CATEGORIES = {
  Round: [
    {
      name: "120ml Round Container",
      path: "./assets/Model_with_logo/120ml round with logo.glb",
    },
    {
      name: "250ml Round Container",
      path: "./assets/Model_with_logo/250ml round with logo.glb",
    },
    {
      name: "300ml Round Container",
      path: "./assets/Model_with_logo/300ml round with logo.glb",
    },
    {
      name: "500ml Round Container",
      path: "./assets/Model_with_logo/500ml Round  with logo.glb",
    },
    {
      name: "750ml Round Container",
      path: "./assets/Model_with_logo/750ml round with logo.glb",
    },
    {
      name: "1000ml Round Container",
      path: "./assets/Model_with_logo/1000ml round with logo.glb",
    },
  ],
  "Round Square": [
    {
      name: "450ml/500gms Container",
      path: "./assets/Model_with_logo/450ml round_square with logo.glb",
    },
    {
      name: "500ml Container",
      path: "./assets/Model_with_logo/500ml round_square with logo.glb",
    },
  ],
  Rectangle: [
    {
      name: "500ml Rectangular Container",
      path: "./assets/Model_with_logo/500ml Rectangle with logo.glb",
    },
    {
      name: "650ml Rectangular Container",
      path: "./assets/Model_with_logo/650ml Rectangle with logo.glb",
    },
    {
      name: "750ml Rectangular Container",
      path: "./assets/Model_with_logo/750ml Rectangle with logo.glb",
    },
  ],
  "Sweet Box": [
    {
      name: "250gms Sweet Box",
      path: "./assets/Model_with_logo/250gms Sweet_box with logo.glb",
    },
    {
      name: "500gms Sweet Box",
      path: "./assets/Model_with_logo/500gms Sweet_box with logo.glb",
    },
    {
      name: "1kg Sweet Box",
      path: "./assets/Model_with_logo/1kg Sweet_box with logo.glb",
    },
  ],
  "Sweet Box Tamper Evident": [
    {
      name: "250gms Sweet Box Tamper Evident",
      path: "./assets/Model_with_logo/250gms Sweet_box_TE with logo.glb",
    },
    {
      name: "500gms Sweet Box Tamper Evident",
      path: "./assets/Model_with_logo/500gms Sweet_box_TE with logo.glb",
    },
  ],
};

const MODEL_CATEGORIES_WITHOUT_LOGO = {
  Round: [
    {
      name: "120ml Round Container",
      path: "./assets/Model_without_logo/120ml round without logo.glb",
    },
    {
      name: "250ml Round Container",
      path: "./assets/Model_without_logo/250ml round without logo.glb",
    },
    {
      name: "300ml Round Container",
      path: "./assets/Model_without_logo/300ml round without logo.glb",
    },
    {
      name: "500ml Round Container",
      path: "./assets/Model_without_logo/500ml Round  without logo.glb",
    },
    {
      name: "750ml Round Container",
      path: "./assets/Model_without_logo/750ml round without logo.glb",
    },
    {
      name: "1000ml Round Container",
      path: "./assets/Model_without_logo/1000ml round without logo.glb",
    },
  ],
  "Round Square": [
    {
      name: "450ml/500gms Container",
      path: "./assets/Model_without_logo/450ml cont without logo.glb",
    },
    {
      name: "500ml Container",
      path: "./assets/Model_without_logo/500ml cont without logo.glb",
    },
  ],
  Rectangle: [
    {
      name: "500ml Rectangular Container",
      path: "./assets/Model_without_logo/500ml Rect without logo.glb",
    },
    {
      name: "650ml Rectangular Container",
      path: "./assets/Model_without_logo/650ml Rect without logo.glb",
    },
    {
      name: "750ml Rectangular Container",
      path: "./assets/Model_without_logo/750ml Rect without logo.glb",
    },
  ],
  "Sweet Box": [
    {
      name: "250gms Sweet Box",
      path: "./assets/Model_without_logo/250gms SB without logo.glb",
    },
    {
      name: "500gms Sweet Box",
      path: "./assets/Model_without_logo/500gms SB without logo.glb",
    },
  ],
  "Sweet Box Tamper Evident": [
    {
      name: "250gms Sweet Box Tamper Evident",
      path: "./assets/Model_without_logo/TE 250 sb without logo.glb",
    },
    {
      name: "500gms Sweet Box Tamper Evident",
      path: "./assets/Model_without_logo/TE 500 sb without logo.glb",
    },
  ],
};

/********** STATE **********/
const state = {
  selectedIndex: 0,
  thumbnails: [],
  modelViewers: [],
  patternUrl: null,
  logoDataUrl: null,
  patternCycleTimer: null,
  selectedColors: { lid: "white", tub: "white" }, // track last color
  isWithoutLogoModel: false,
  allPatterns: [],
  rawPatterns: [],
  categories: [], // Store categories for sequential access
  currentShapeFilter: null,
  currentPatternType: null, // "top" or "bottom"
  hideLogo: false, // track logo visibility
  autoPatternIdx: 0, // NEW: Track the current index in the pattern cycle
  isEdited: false, // Track if current pattern is a canvas edit
  lastLibraryPatternUrl: null, // Store the last non-edited pattern
  patternUrlTop: null, // Track lid pattern specifically
};

/********** ELEMENTS **********/
const modelAccordion = document.getElementById("modelAccordion");
const mainViewer = document.getElementById("mainViewer");
const mainModelTitle = document.getElementById("mainModelTitle");
const logoInput = document.getElementById("logoUpload");
const partSelect = document.getElementById("partSelect");
const colorOptions = document.getElementById("colorOptions");

/********** UTILS **********/
function resolvePatternUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return location.origin + s;
  return BASE_URL + encodeURIComponent(s);
}

// Canonical shape mapping for: Round, Round Square, Rectangle, Sweet Box, Sweet Box TE
function getCanonicalShape(shapeStr) {
  if (!shapeStr) return "";
  const s = shapeStr.trim().toLowerCase().replace(/_/g, " ");

  if (s.includes("round square")) return "Round Square";
  if (s.includes("round")) return "Round";
  if (s.includes("sweet box tamper evident") || s.includes("sweet box te"))
    return "Sweet Box Tamper Evident";
  if (s.includes("sweet box") || s.includes("sb")) return "Sweet Box";
  if (s.includes("rectangle") || s.includes("rect")) return "Rectangle";

  return shapeStr; // Return original if not special mapped
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/********** MODEL ACCORDION **********/
async function initModelAccordion() {
  if (!modelAccordion) return;
  modelAccordion.innerHTML = "";
  state.thumbnails = [];
  state.modelViewers = [];
  let modelIndex = 0;

  const categories = MODEL_CATEGORIES;

  Object.entries(categories).forEach(([category, models]) => {
    const li = document.createElement("li");

    const header = document.createElement("div");
    header.className = "accordion-header";
    header.innerHTML = `
      <span>${category}</span>
      <i class="fa-solid fa-angle-down drop"></i>
    `;

    const content = document.createElement("div");
    content.className = "accordion-content model-grid";
    content.style.maxHeight = "0px";
    content.style.overflow = "hidden";
    content.style.transition = "max-height 0.3s ease";

    models.forEach((model) => {
      const card = document.createElement("div");
      card.className = "thumb-card";
      card.dataset.index = modelIndex;

      const mv = document.createElement("model-viewer");
      mv.src = model.path;
      mv.alt = model.name;
      mv.disableZoom = true;
      mv.cameraControls = true;
      mv.reveal = "auto";
      mv.interactionPrompt = "none";
      mv.style.pointerEvents = "none";

      const label = document.createElement("div");
      label.className = "thumb-label";
      label.textContent = model.name;

      card.appendChild(mv);
      card.appendChild(label);
      content.appendChild(card);

      state.thumbnails.push({
        card,
        name: model.name,
        path: model.path,
        shape: category,
      });
      state.modelViewers.push(mv);

      card.addEventListener("click", (e) => {
        e.stopPropagation();
        selectModel(Number(card.dataset.index));
      });
      modelIndex++;
    });

    li.appendChild(header);
    li.appendChild(content);
    modelAccordion.appendChild(li);

    header.addEventListener("click", () => {
      const isOpen = header.classList.contains("active");

      // Close all other model accordion sections
      modelAccordion.querySelectorAll(".accordion-header").forEach((h) => {
        if (h !== header) {
          const parentLi = h.closest("li");
          if (parentLi) parentLi.classList.remove("active");
          h.classList.remove("active");
          const c = h.nextElementSibling;
          if (c) {
            c.style.maxHeight = "0px";
            c.classList.remove("active");
          }
          const drop = h.querySelector(".drop");
          if (drop) drop.className = "fa-solid fa-angle-down drop";
        }
      });

      if (isOpen) {
        li.classList.remove("active");
        header.classList.remove("active");
        content.style.maxHeight = "0px";
        content.classList.remove("active");
        header.querySelector(".drop").className = "fa-solid fa-angle-down drop";
      } else {
        li.classList.add("active");
        header.classList.add("active");
        content.classList.add("active");
        content.style.maxHeight = content.scrollHeight + "px";
        header.querySelector(".drop").className = "fa-solid fa-angle-up drop";
      }
    });
  });

  markSelectedThumbnail(0);
  // Open first category by default
  const firstHeader = modelAccordion.querySelector(".accordion-header");
  if (firstHeader) firstHeader.click();

  // Load the first model to trigger default logic
  selectModel(0);
}

function markSelectedThumbnail(index) {
  state.thumbnails.forEach((t, i) =>
    t.card.classList.toggle("selected", i === index),
  );
}

// Filter Pattern Accordion based on Shape
// Filter Pattern Accordion based on Shape
function filterPatternAccordion(shapeFilter, keepCycleIndex = false) {
  state.currentShapeFilter = shapeFilter;
  const accordion = document.getElementById("patternAccordion");
  if (!accordion) return;

  const items = accordion.querySelectorAll("li");
  const shapeLower = (shapeFilter || "").trim().toLowerCase();

  items.forEach((li) => {
    // ✅ CATEGORY LEVEL FILTERING: If the category itself is for a different shape, hide it
    const liShape = getCanonicalShape(li.dataset.shapeType).toLowerCase();
    if (shapeFilter && liShape !== shapeLower) {
      li.style.display = "none";
      return;
    }

    const swatches = li.querySelectorAll(".pattern-swatch");
    const headers = li.querySelectorAll(".pattern-group-header");
    let hasMatch = false;

    swatches.forEach((sw) => {
      const swShape = (sw.dataset.shape || "").trim().toLowerCase();
      const swType = (sw.dataset.patternType || "").trim().toLowerCase();

      // Basic visibility based on shape
      let isVisible = !shapeFilter || swShape === shapeLower;

      // Shape-specific type filtering
      if (isVisible && shapeFilter) {
        if (shapeLower === "rectangle" && swType === "bottom") {
          isVisible = false;
        } else if (
          (shapeLower === "round" || shapeLower === "round square") &&
          swType === "top"
        ) {
          isVisible = false;
        } else if (shapeLower.includes("sweet box")) {
          // Only show 'full' group for Sweet Boxes
          if (swType !== "full") isVisible = false;
        } else {
          // Hide 'full' for single-label models
          if (swType === "full") isVisible = false;
        }
      }

      sw.style.display = isVisible ? "block" : "none";
      if (isVisible) hasMatch = true;
    });

    // Handle Headers visibility
    headers.forEach((header) => {
      const type = header.dataset.type;
      let typeVisible = false;
      const swatchesOfType = li.querySelectorAll(
        `.pattern-swatch[data-pattern-type="${type}"]`,
      );
      swatchesOfType.forEach((sw) => {
        if (sw.style.display !== "none") typeVisible = true;
      });
      header.style.display = typeVisible ? "block" : "none";
    });

    // Hide the entire category if no patterns match the shape
    if (!shapeFilter) {
      li.style.display = "block";
    } else {
      li.style.display = hasMatch ? "block" : "none";
    }

    // If active category is now empty or hidden, close it
    if (
      li.classList.contains("active") &&
      (!hasMatch || li.style.display === "none")
    ) {
      li.classList.remove("active");
      const header = li.querySelector(".accordion-header");
      const content = li.querySelector(".accordion-content");
      if (header) header.classList.remove("active");
      if (content) content.style.maxHeight = "0px";
      const drop = li.querySelector(".drop");
      if (drop) drop.className = "fa-solid fa-angle-down drop";
    }

    // Refresh maxHeight if open
    if (li.classList.contains("active")) {
      const content = li.querySelector(".accordion-content");
      if (content) content.style.maxHeight = content.scrollHeight + "px";
    }
  });

  // ✅ SEQUENTIAL FILTERING: Build a pool that matches EXACTLY what's visible in the accordion
  const pool = [];

  state.categories.forEach((cat) => {
    // Only process categories for the current shape (respecting the display logic)
    const liShape = getCanonicalShape(cat.shape_type).toLowerCase();
    if (shapeFilter && liShape !== shapeLower) return;

    const catPatterns = state.rawPatterns.filter((p) => {
      const pCat = (p.category_name || "").trim().toLowerCase();
      const cCat = (cat.category || "").trim().toLowerCase();
      const pShape = getCanonicalShape(p.shape_type).toLowerCase();
      const cShape = getCanonicalShape(cat.shape_type).toLowerCase();
      return pCat === cCat && pShape === cShape;
    });

    catPatterns.forEach((p) => {
      const pShape = getCanonicalShape(p.shape_type).toLowerCase();
      if (!shapeFilter || pShape === shapeLower) {
        if (pShape.includes("sweet box")) {
          // Sweet Box: Push the primary URL (Tub) which acts as the key for full set application
          const u = resolvePatternUrl(p.pattern_url);
          if (u) pool.push(u);
        } else if (pShape === "rectangle") {
          // Rectangle: Push Lid only
          const u = resolvePatternUrl(p.pattern_url_top);
          if (u) pool.push(u);
        } else {
          // Round / Round Square: Push Tub only
          const u = resolvePatternUrl(p.pattern_url);
          if (u) pool.push(u);
        }
      }
    });
  });

  state.allPatterns = [...new Set(pool)];

  // If auto-apply is on, restart the cycle with new pool
  const autoApplyToggle = document.getElementById("autoApplyToggle");
  if (autoApplyToggle && autoApplyToggle.checked) {
    startPatternCycle(state.allPatterns, 2000, keepCycleIndex);
  }
}

/********** MODEL SELECTION **********/
async function selectModel(index) {
  if (index < 0 || index >= state.thumbnails.length) return;

  // 🔄 REVERT CANVAS EDITS: If switching models, clear edited pattern and restore brand logo
  if (state.isEdited) {
    const confirmed = await showConfirmModal(
      "Your edited pattern will be lost. Are you sure you want to switch models?",
    );
    if (!confirmed) return;

    console.log(
      "[CategorySwitch] Reverting edited pattern to last library pattern.",
    );
    state.patternUrl = state.lastLibraryPatternUrl;
    state.isEdited = false;
    state.hideLogo = false;

    // Update UI toggle
    const hideLogoToggle = document.getElementById("hideLogoToggle");
    if (hideLogoToggle) hideLogoToggle.checked = false;

    // Note: toggleLogoVisibility will be called inside the "load" listener below
  }

  state.selectedIndex = index;
  markSelectedThumbnail(index);
  const selectedModel = state.thumbnails[index];
  if (!mainViewer) return;

  const modelPath = encodeURI(selectedModel.path);
  // Force reload if we just reverted an edit (to ensure clean reload even on same model)
  if (mainViewer.src === modelPath) {
    mainViewer.src =
      modelPath + (modelPath.includes("?") ? "&" : "?") + "t=" + Date.now();
  } else {
    mainViewer.src = modelPath;
  }
  mainViewer.alt = selectedModel.name;
  mainModelTitle.textContent = selectedModel.name;

  // Only STOP pattern cycle if we switch to a completely different shape type
  const lowerCat = selectedModel.shape.toLowerCase().trim();
  let shapeFilter = selectedModel.shape; // default from category
  if (lowerCat === "round") shapeFilter = "Round";
  else if (lowerCat === "round square") shapeFilter = "Round Square";
  else if (lowerCat === "rectangle") shapeFilter = "Rectangle";
  else if (lowerCat === "sweet box") shapeFilter = "Sweet Box";
  else if (
    lowerCat === "sweet box tamper evident" ||
    lowerCat === "sweet box te"
  )
    shapeFilter = "Sweet Box Tamper Evident";

  const typeChanged = state.currentShapeFilter !== shapeFilter;

  if (typeChanged) {
    console.log("[CategorySwitch] New type detected, resetting pattern logic.");
    stopPatternCycle(false);
    state.autoPatternIdx = 0;

    // Reset pattern to 1st compatible if Auto Apply is OFF
    const autoApplyToggle = document.getElementById("autoApplyToggle");
    if (!autoApplyToggle || !autoApplyToggle.checked) {
      state.patternUrl = null;
    }
  } else {
    console.log("[CategorySwitch] Same type, continuing pattern sequence.");
  }

  filterPatternAccordion(shapeFilter, !typeChanged);

  mainViewer.addEventListener(
    "load",
    async () => {
      const capturedIndex = index; // Protect against stale loads
      try {
        // 🛑 If user selected a DIFFERENT model while this was loading, ABORT
        if (state.selectedIndex !== capturedIndex) return;

        // ✅ Only reset to default colors if we actually changed the model type
        if (typeChanged || !state.selectedColors.lid) {
          const s = shapeFilter.toLowerCase();
          if (s.includes("sweet box")) {
            state.selectedColors.lid = "white";
            state.selectedColors.tub = "white";
          } else {
            // Round, Round Square, Rectangle
            state.selectedColors.lid = "transparency";
            state.selectedColors.tub = "white";
          }

          // Apply to the 3D model
          updateMaterialColor("lid", state.selectedColors.lid, {
            skipWait: true,
          });
          updateMaterialColor("tub", state.selectedColors.tub, {
            skipWait: true,
          });
        }

        // Sync UI radio buttons
        if (partSelect) updatePart(partSelect.value);

        // Apply current auto-rotate state smoothly
        const autoRotateToggle = document.getElementById("autoRotateToggle");
        if (autoRotateToggle) {
          updateAutoRotateSmooth(autoRotateToggle.checked, true);
        }

        // Apply logo visibility
        toggleLogoVisibility(state.hideLogo);

        console.log("Model fully available:", selectedModel.name);

        // 🧹 RESET ALL MATERIALS on the new model first
        ["lid_label", "tub_label", "Logo"].forEach((matName) => {
          clearMaterialTexture(mainViewer, matName);
        });

        // Material detection - prefer shape-based check
        const curShape = getCanonicalShape(selectedModel.shape);
        const isRect =
          isRectangleModel(selectedModel.name) || curShape === "Rectangle";
        const materialName = isRect
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;

        state.patternMaterialOverride = materialName;

        // Only apply if user hasn't switched to another model (redundant check for safety)
        if (state.selectedIndex !== capturedIndex) return;

        // Apply first pattern if auto-apply is OFF and shape changed
        if (!state.patternUrl) {
          let firstCompatible = null;
          for (const cat of state.categories) {
            const catPatterns = state.rawPatterns.filter(
              (p) =>
                p.category_name.toLowerCase() === cat.category.toLowerCase(),
            );
            firstCompatible = catPatterns.find(
              (p) => getCanonicalShape(p.shape_type) === curShape,
            );
            if (firstCompatible) break;
          }

          if (firstCompatible) {
            const uBottom = resolvePatternUrl(firstCompatible.pattern_url);
            const uTop = resolvePatternUrl(firstCompatible.pattern_url_top);

            if (curShape.toLowerCase().includes("sweet box")) {
              state.patternUrl = uBottom;
              state.patternUrlTop = uTop;
              state.currentPatternType = "full";
            } else if (isRect) {
              state.patternUrl = uTop;
              state.patternUrlTop = uTop;
              state.currentPatternType = "top";
            } else {
              state.patternUrl = uBottom;
              state.patternUrlTop = null;
              state.currentPatternType = "bottom";
            }
            state.lastLibraryPatternUrl = state.patternUrl;
          }
        }

        if (state.patternUrl) {
          await applyPatternToAll(state.patternUrl, {
            materialOverride: materialName,
            patternUrlTop: state.patternUrlTop,
            isEdited: state.isEdited,
          });

          // Update swatch selection
          document.querySelectorAll(".pattern-swatch").forEach((el) => {
            el.classList.toggle(
              "selected",
              el.dataset.patternUrl?.split("?")[0] === state.patternUrl,
            );
          });
        }

        if (state.logoDataUrl) {
          console.log(
            "Available materials on mainViewer:",
            mainViewer.model?.materials?.map((m) => m.name),
          );

          await Promise.all(
            viewers.map((v) =>
              tryApplyMaterialTexture(v, LOGO_MATERIAL_NAME, state.logoDataUrl),
            ),
          );
        }

        for (const [part, color] of Object.entries(state.selectedColors)) {
          updateMaterialColor(part, color, { skipWait: true });
        }
      } catch (err) {
        console.error("Error applying pattern or logo on model load:", err);
      }
    },
    { once: true },
  );
}

/********** FETCH CATEGORIES & PATTERNS **********/
async function fetchCategories() {
  try {
    const res = await fetch(
      "https://terratechpacks.com/App_3D/category_fetch.php",
    );
    const json = await res.json();
    return json.status === "success" && Array.isArray(json.data)
      ? json.data
      : [];
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    return [];
  }
}

// Fetch all patterns (replacement for fetchPatternsByCategory)
async function fetchAllPatterns() {
  try {
    const res = await fetch(API_FETCH_PATTERNS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name: "" }),
    });
    const json = await res.json();
    return json.status === "success" && Array.isArray(json.data)
      ? json.data
      : [];
  } catch (err) {
    console.error("Failed to fetch all patterns:", err);
    return [];
  }
}

// Initialize Category Accordion with full pattern data
async function initCategoryAccordion() {
  const accordion = document.getElementById("patternAccordion");
  if (!accordion) return;

  accordion.innerHTML = "";
  const categories = await fetchCategories();
  state.categories = categories; // Store for global access
  const allPatternsData = await fetchAllPatterns();
  state.rawPatterns = allPatternsData;

  const baseurl = "https://terratechpacks.com/App_3D/";
  const finalUrls = [];

  categories.forEach((cat) => {
    // ✅ STRICT FILTERING: Only include patterns that match BOTH category name and shape type
    const catPatterns = allPatternsData.filter((p) => {
      const pCat = (p.category_name || "").trim().toLowerCase();
      const cCat = (cat.category || "").trim().toLowerCase();
      const pShape = getCanonicalShape(p.shape_type).toLowerCase();
      const cShape = getCanonicalShape(cat.shape_type).toLowerCase();
      return pCat === cCat && pShape === cShape;
    });

    const li = document.createElement("li");
    li.dataset.categoryName = cat.category;
    li.dataset.shapeType = cat.shape_type;

    const header = document.createElement("div");
    header.className = "accordion-header";
    header.innerHTML = `
      <span>
        <img src="${baseurl + cat.logo_url}" style="height:1.2vw;width:1.2vw;"/> ${cat.category}
      </span>
      <i class="fa-solid fa-angle-down drop"></i>
    `;

    const content = document.createElement("div");
    content.className = "accordion-content patternContainer";
    content.style.maxHeight = "0px";
    content.style.overflow = "hidden";
    content.style.transition = "max-height 0.3s ease";

    // Build swatches grouped by type
    if (catPatterns.length) {
      const lidGroup = document.createElement("div");
      lidGroup.className = "pattern-group";
      const lidHeader = document.createElement("div");
      lidHeader.className = "pattern-group-header";
      lidHeader.textContent = "Lid Pattern";
      lidHeader.dataset.type = "top";
      lidGroup.appendChild(lidHeader);

      const tubGroup = document.createElement("div");
      tubGroup.className = "pattern-group";
      const tubHeader = document.createElement("div");
      tubHeader.className = "pattern-group-header";
      tubHeader.textContent = "Tub Pattern";
      tubHeader.dataset.type = "bottom";
      tubGroup.appendChild(tubHeader);

      const fullGroup = document.createElement("div");
      fullGroup.className = "pattern-group";
      const fullHeader = document.createElement("div");
      fullHeader.className = "pattern-group-header";
      fullHeader.textContent = "Full Pattern";
      fullHeader.dataset.type = "full";
      fullGroup.appendChild(fullHeader);

      catPatterns.forEach((p) => {
        const canonicalShape = getCanonicalShape(p.shape_type);
        const isSweetBoxPattern = canonicalShape
          .toLowerCase()
          .includes("sweet box");

        if (isSweetBoxPattern) {
          // ONE swatch for BOTH lid and tub
          const urlBottom = resolvePatternUrl(p.pattern_url);
          const urlTop = resolvePatternUrl(p.pattern_url_top);
          if (urlBottom) finalUrls.push(urlBottom);
          if (urlTop) finalUrls.push(urlTop);

          const sw = document.createElement("div");
          sw.className = "pattern-swatch";
          // Use top pattern (lid) as the thumbnail
          sw.style.backgroundImage = `url('${urlTop || urlBottom}')`;
          sw.title = `${p.category_name} - FULL SET`;
          sw.dataset.patternUrl = urlBottom;
          sw.dataset.patternUrlTop = urlTop;
          sw.dataset.shape = canonicalShape;
          sw.dataset.patternType = "full";

          sw.addEventListener("click", async () => {
            stopPatternCycle();

            if (state.isEdited) {
              const confirmed = await showConfirmModal(
                "Your edited pattern will be lost. Are you sure you want to select a new library pattern?",
              );
              if (!confirmed) return;
            } else if (state.isWithoutLogoModel) {
              const confirmed = await showConfirmModal(
                "Selecting a new pattern will remove your custom logo. Proceed?",
              );
              if (!confirmed) return;
            }
            state.currentPatternType = "full";
            // Apply both in parallel
            await applyPatternToAll(urlBottom, {
              patternUrlTop: urlTop,
              isFullSet: true,
            });
          });
          fullGroup.appendChild(sw);
        } else {
          // Standard split for other shapes
          const subPatterns = [];
          if (p.pattern_url) {
            subPatterns.push({
              url: resolvePatternUrl(p.pattern_url),
              type: "bottom",
            });
          }
          if (p.pattern_url_top) {
            subPatterns.push({
              url: resolvePatternUrl(p.pattern_url_top),
              type: "top",
            });
          }

          subPatterns.forEach((patObj) => {
            const url = patObj.url;
            if (url) finalUrls.push(url);

            const sw = document.createElement("div");
            sw.className = "pattern-swatch";
            sw.style.backgroundImage = `url('${url}')`;
            sw.title = `${p.category_name} - ${patObj.type.toUpperCase()}`;
            sw.dataset.patternUrl = url;
            sw.dataset.shape = canonicalShape;
            sw.dataset.patternType = patObj.type;

            sw.addEventListener("click", async () => {
              stopPatternCycle();

              if (state.isEdited) {
                const confirmed = await showConfirmModal(
                  "Your edited pattern will be lost. Are you sure you want to select a new library pattern?",
                );
                if (!confirmed) return;
              } else if (state.isWithoutLogoModel) {
                const confirmed = await showConfirmModal(
                  "Selecting a new pattern will remove your custom logo. Proceed?",
                );
                if (!confirmed) return;
              }
              state.currentPatternType = patObj.type;
              await applyPatternToAll(url);
            });

            if (patObj.type === "top") lidGroup.appendChild(sw);
            else tubGroup.appendChild(sw);
          });
        }
      });

      content.appendChild(lidGroup);
      content.appendChild(tubGroup);
      content.appendChild(fullGroup);
    } else {
      const msg = document.createElement("div");
      msg.textContent = "No patterns available";
      msg.style.padding = "0.6vw";
      msg.style.fontSize = "0.85vw";
      content.appendChild(msg);
    }

    li.appendChild(header);
    li.appendChild(content);
    accordion.appendChild(li);

    header.addEventListener("click", () => {
      const isOpen = header.classList.contains("active");

      accordion.querySelectorAll(".accordion-header").forEach((h) => {
        if (h !== header) {
          const parentLi = h.closest("li");
          if (parentLi) parentLi.classList.remove("active");
          h.classList.remove("active");
          const c = h.nextElementSibling;
          if (c) c.style.maxHeight = "0px";
          const drop = h.querySelector(".drop");
          if (drop) drop.className = "fa-solid fa-angle-down drop";
        }
      });

      if (isOpen) {
        li.classList.remove("active");
        header.classList.remove("active");
        content.style.maxHeight = "0px";
        header.querySelector(".drop").className = "fa-solid fa-angle-down drop";
      } else {
        li.classList.add("active");
        header.classList.add("active");
        content.style.maxHeight = content.scrollHeight + "px";
        header.querySelector(".drop").className = "fa-solid fa-angle-up drop";
      }
    });
  });

  return [...new Set(finalUrls)];
}

// ================== EXPORT ==================

const exportBtn = document.getElementById("exportBtn");
const exportFormat = document.getElementById("exportFormat");

exportBtn.addEventListener("click", async () => {
  const format = exportFormat.value;
  const modelName = mainModelTitle.textContent.replace(/\s+/g, "_");

  if (!mainViewer) return;

  try {
    const dataUrl = await mainViewer.toDataURL();
    if (format === "pdf") {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape" });
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${modelName}.pdf`);
    } else {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${modelName}.${format}`;
      link.click();
    }
  } catch (err) {
    console.error("Export failed:", err);
  }
});

/********** PATTERN CYCLE **********/
function startPatternCycle(
  patternUrls = [],
  interval = 2000,
  keepIndex = false,
) {
  stopPatternCycle(false);
  if (!patternUrls.length) return;

  if (!keepIndex) state.autoPatternIdx = 0;
  let lastSelectedEl = null;

  state.patternCycleTimer = setInterval(() => {
    // ✅ Re-check toggle state: if it was turned off, abort this interval run
    const toggle = document.getElementById("autoApplyToggle");
    if (!toggle || !toggle.checked) {
      stopPatternCycle(false);
      return;
    }

    // ✅ Always use the LATEST filtered pool from state, not the captured patternUrls
    const pool =
      state.allPatterns && state.allPatterns.length > 0
        ? state.allPatterns
        : patternUrls;
    const patternUrl = pool[state.autoPatternIdx % pool.length];

    if (!patternUrl) {
      state.autoPatternIdx++;
      return;
    }

    // apply to relevant viewers in parallel (skip wait)
    const allViewers = Array.from(
      new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
    );

    allViewers.forEach((viewer) => {
      if (!viewer || !viewer.model) return;

      // Check if this viewer should receive the pattern
      let shouldApply = viewer === mainViewer;
      if (!shouldApply && state.modelViewers && state.thumbnails) {
        const idxv = state.modelViewers.indexOf(viewer);
        const thumb = state.thumbnails[idxv];
        if (
          thumb &&
          getCanonicalShape(thumb.shape) === state.currentShapeFilter
        ) {
          shouldApply = true;
        }
      }

      const modelAlt = (viewer.alt || "").toLowerCase();
      // Improved Box detection
      const isBox =
        modelAlt.includes("sweet box") ||
        modelAlt.includes("sweetbox") ||
        modelAlt.includes("sb") ||
        modelAlt.includes("square");

      // For cycle, we don't know the type, so we try to find the swatch design's intended type
      let typeFromSwatch = null;
      const cleanUrl = patternUrl.split("?")[0];
      const sw = Array.from(document.querySelectorAll(".pattern-swatch")).find(
        (el) => el.dataset.patternUrl?.split("?")[0] === cleanUrl,
      );
      if (sw) typeFromSwatch = sw.dataset.patternType;

      let targets = [];
      if (isBox) {
        const isTE = modelAlt.includes("te");
        if (typeFromSwatch === "top")
          targets = isTE
            ? RECTANGLE_PATTERN_MATERIAL_NAME
            : RECTANGLE_PATTERN_MATERIAL_NAME;
        // Both now use Lid for Top
        else if (typeFromSwatch === "bottom")
          targets = isTE ? PATTERN_MATERIAL_NAME : PATTERN_MATERIAL_NAME;
        // Both now use Tub for Bottom
        else
          targets = [
            ...RECTANGLE_PATTERN_MATERIAL_NAME,
            ...PATTERN_MATERIAL_NAME,
          ];
      } else {
        targets = isRectangleModel(modelAlt)
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;
      }

      if (shouldApply) {
        const isTE = modelAlt.includes("te");

        const applyOne = async (pUrl, pType) => {
          if (!pUrl) return;
          let matNames = [];
          if (isBox) {
            if (pType === "top") matNames = RECTANGLE_PATTERN_MATERIAL_NAME;
            else if (pType === "bottom") matNames = PATTERN_MATERIAL_NAME;
          } else {
            matNames = isRectangleModel(modelAlt)
              ? RECTANGLE_PATTERN_MATERIAL_NAME
              : PATTERN_MATERIAL_NAME;
          }

          let rot = 0;
          const isLidMat = RECTANGLE_PATTERN_MATERIAL_NAME.some((n) =>
            matNames.includes(n),
          );
          if (isBox && isTE && isLidMat) {
            rot = 90;
          }

          tryApplyMaterialTexture(viewer, matNames, pUrl, {
            skipWait: true,
            rotation: rot,
          }).catch(() => {});
        };

        // Determine if this is a grouped swatch
        const sw = Array.from(
          document.querySelectorAll(".pattern-swatch"),
        ).find(
          (el) =>
            el.dataset.patternUrl?.split("?")[0] === patternUrl.split("?")[0],
        );

        if (sw && sw.dataset.patternType === "full") {
          applyOne(patternUrl, "bottom");
          applyOne(sw.dataset.patternUrlTop, "top");
        } else {
          const type =
            sw?.dataset.patternType ||
            (isRectangleModel(modelAlt) ? "top" : "bottom");
          applyOne(patternUrl, type);
        }
      } else {
        targets.forEach((matName) => clearMaterialTexture(viewer, matName));
      }
    });

    // Efficient swatch update
    const cleanUrl = patternUrl.split("?")[0];
    let matched = null;
    document.querySelectorAll(".pattern-swatch").forEach((sw) => {
      if (sw.dataset.patternUrl?.split("?")[0] === cleanUrl) matched = sw;
    });

    if (lastSelectedEl && lastSelectedEl !== matched)
      lastSelectedEl.classList.remove("selected");
    if (matched && !matched.classList.contains("selected")) {
      matched.classList.add("selected");

      // ✅ AUTO-EXPAND CATEGORY: Ensure the category accordion is open
      const parentLi = matched.closest("li");
      const header = parentLi?.querySelector(".accordion-header");
      if (header && !header.classList.contains("active")) {
        header.click();
      }
    }
    lastSelectedEl = matched;

    state.patternUrl = cleanUrl;
    state.lastLibraryPatternUrl = cleanUrl;
    state.isEdited = false;
    state.autoPatternIdx++;
  }, interval);
}

function stopPatternCycle(syncToggle = true) {
  if (state.patternCycleTimer) {
    console.log("Stopping pattern cycle");
    clearInterval(state.patternCycleTimer);
    state.patternCycleTimer = null;

    if (syncToggle) {
      const toggle = document.getElementById("autoApplyToggle");
      if (toggle) toggle.checked = false;
    }
  }
}

// Utility: detect rectangle model
function isRectangleModel(name) {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  // These categories are "rectangular" because they use the Lid/Top material logic
  const keywords = [
    "rectangle",
    "rect",
    "rectangular",
    "sweet box",
    "sweet box tamper evident",
    "sweet box te",
  ];
  const result = keywords.some((k) => lower.includes(k));
  console.log(
    `[isRectangleModel] "${name}" => ${result ? "✅ RECT" : "❌ ROUND"}`,
  );
  return result;
}

// Utility: Clear texture from a material
function clearMaterialTexture(viewer, materialName) {
  if (!viewer || !viewer.model) return;
  const names = Array.isArray(materialName) ? materialName : [materialName];

  names.forEach((n) => {
    const material = viewer.model.materials.find((m) => m.name === n);
    if (
      material &&
      material.pbrMetallicRoughness &&
      material.pbrMetallicRoughness.baseColorTexture
    ) {
      material.pbrMetallicRoughness.baseColorTexture.setTexture(null);
    }
  });
}

/********** APPLY PATTERN TO ALL VIEWERS **********/
async function applyPatternToAll(
  patternUrl,
  {
    forceReload = false,
    materialOverride = null,
    patternUrlTop = null,
    isFullSet = false,
    isEdited = false,
  } = {},
) {
  if (!patternUrl) return;

  const cleanSelectedUrl = patternUrl.split("?")[0];
  state.patternUrl = cleanSelectedUrl;
  state.lastLibraryPatternUrl = isEdited
    ? state.lastLibraryPatternUrl
    : cleanSelectedUrl;
  state.isEdited = isEdited;

  // Track top pattern specifically for Rectangle/Sweet Box models
  if (patternUrlTop) {
    state.patternUrlTop = patternUrlTop.split("?")[0];
  } else if (isRectangleModel(mainViewer.alt)) {
    // If we only have one URL and it's a rectangle model, it's effectively the top/lid one
    state.patternUrlTop = cleanSelectedUrl;
  } else {
    state.patternUrlTop = null;
  }

  // Highlight swatch
  document.querySelectorAll(".pattern-swatch").forEach((sw) => {
    const swatchUrl = sw.dataset.patternUrl?.split("?")[0];
    sw.classList.toggle("selected", swatchUrl === cleanSelectedUrl);
  });

  const allViewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );

  const applyTask = async (viewer) => {
    if (!viewer) return;
    if (!viewer.model) {
      await new Promise((resolve) =>
        viewer.addEventListener("load", resolve, { once: true }),
      );
    }

    // 1. Determine if this viewer should receive the pattern
    let shouldApply = viewer === mainViewer;

    if (!shouldApply && state.modelViewers && state.thumbnails) {
      const idxInList = state.modelViewers.indexOf(viewer);
      const thumb = state.thumbnails[idxInList];
      if (
        thumb &&
        getCanonicalShape(thumb.shape) === state.currentShapeFilter
      ) {
        shouldApply = true;
      }
    }

    if (!shouldApply) return;

    // 2. Determine material name(s) dynamically
    const modelAlt = (viewer.alt || "").toLowerCase();
    const isBox =
      modelAlt.includes("sweet box") ||
      modelAlt.includes("sweetbox") ||
      modelAlt.includes("square");

    let targets = [];
    if (isBox) {
      const isTE = modelAlt.includes("te");
      if (state.currentPatternType === "top")
        targets = RECTANGLE_PATTERN_MATERIAL_NAME;
      else if (state.currentPatternType === "bottom")
        targets = PATTERN_MATERIAL_NAME;
      else
        targets = [
          ...RECTANGLE_PATTERN_MATERIAL_NAME,
          ...PATTERN_MATERIAL_NAME,
        ];
    } else {
      targets = isRectangleModel(modelAlt)
        ? RECTANGLE_PATTERN_MATERIAL_NAME
        : PATTERN_MATERIAL_NAME;
    }

    const applyOne = async (pUrl, pType) => {
      if (!pUrl) return;
      const isTE = modelAlt.includes("te");
      let matNames = [];
      if (isBox) {
        matNames =
          pType === "top"
            ? RECTANGLE_PATTERN_MATERIAL_NAME
            : PATTERN_MATERIAL_NAME;
      } else {
        matNames = isRectangleModel(modelAlt)
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;
      }
      let rot =
        isBox &&
        isTE &&
        RECTANGLE_PATTERN_MATERIAL_NAME.some((n) => matNames.includes(n))
          ? 90
          : 0;
      await tryApplyMaterialTexture(viewer, matNames, pUrl, {
        skipWait: true,
        rotation: rot,
      });
    };

    if (patternUrlTop) {
      await Promise.all([
        applyOne(patternUrl, "bottom"),
        applyOne(patternUrlTop, "top"),
      ]);
    } else {
      await applyOne(patternUrl, state.currentPatternType || "bottom");
    }
  };

  // 🚀 Start main viewer immediately and AWAIT it
  await applyTask(mainViewer);

  // Background the rest
  allViewers
    .filter((v) => v !== mainViewer)
    .forEach((v) => applyTask(v).catch(() => {}));
}

/********** CREATE LOGO CANVAS WITHOUT STRETCH **********/
function createLogoCanvas(file, canvasSize = 512, logoScale = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext("2d");

      // Force image to a consistent % of canvas size
      const targetW = canvasSize * logoScale;
      const aspect = img.width / img.height;
      let w = targetW;
      let h = targetW;

      if (aspect > 1) {
        // Wider than tall
        h = targetW / aspect;
      } else {
        // Taller than wide
        w = targetW * aspect;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (canvasSize - w) / 2, (canvasSize - h) / 2, w, h);

      resolve(canvas.toDataURL());
    };
  });
}

/********** OPTIMIZED: TRY APPLY MATERIAL TEXTURE **********/
async function tryApplyMaterialTexture(
  viewer,
  materialNames,
  textureUrl,
  { skipWait = false, forceReload = false, rotation = 0, offset = [0, 0] } = {},
) {
  if (!viewer || !textureUrl) return;

  if (!viewer.model && !skipWait) {
    await new Promise((res) =>
      viewer.addEventListener("load", res, { once: true }),
    );
  }

  const names = (
    Array.isArray(materialNames) ? materialNames : [materialNames]
  ).map((n) => n.toLowerCase());
  const matchingMaterials = (viewer.model?.materials || []).filter((m) =>
    names.includes(m.name.toLowerCase()),
  );

  if (matchingMaterials.length === 0) {
    console.warn(
      `[tryApplyMaterialTexture] No matching materials found for:`,
      materialNames,
    );
    return;
  }

  try {
    let vcache = viewerTextureCache.get(viewer);
    if (!vcache) {
      vcache = new Map();
      viewerTextureCache.set(viewer, vcache);
    }

    const normalizedNew = stripQuery(textureUrl);
    const cacheKey = `${normalizedNew}_rot${rotation}`;
    let tex;

    if (!forceReload && vcache.has(cacheKey)) {
      tex = vcache.get(cacheKey);
    } else {
      // Physically rotate the image if needed before creating texture
      const finalUrl =
        rotation !== 0 ? await rotateImage(textureUrl, rotation) : textureUrl;
      tex = await viewer.createTexture(finalUrl);
      vcache.set(cacheKey, tex);
    }

    matchingMaterials.forEach((mat) => {
      // Normalize URLs to avoid repeated application
      const currentUri =
        mat.pbrMetallicRoughness.baseColorTexture?.texture?.source?.uri;
      const normalizedCurrent = currentUri ? stripQuery(currentUri) : null;

      if (normalizedCurrent === normalizedNew && !forceReload) return;

      if (mat.pbrMetallicRoughness.baseColorTexture) {
        mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
      }

      if (tex.texture) {
        // We handle rotation physically now, so transform is just identity
        tex.texture.transform = {
          offset: [0, 0],
          scale: [1, 1],
          rotation: 0,
        };
        if (
          tex.texture.sampler &&
          typeof tex.texture.sampler.setWrapMode === "function"
        ) {
          tex.texture.sampler.setWrapMode("CLAMP_TO_EDGE");
        }
      }

      mat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
      mat.setAlphaMode("BLEND");
    });
  } catch (err) {
    console.warn("Failed to apply texture:", err);
  }
}

/********** LOGO UPLOAD **********/
if (logoInput) {
  logoInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const logoDataUrl = await createLogoCanvas(file, 512, 0.8); // Canvas size and logo scale
    state.logoDataUrl = logoDataUrl;

    const viewers = Array.from(
      new Set([mainViewer, ...(state.modelViewers || [])].filter(Boolean)),
    );

    await Promise.all(
      viewers.map((v) => {
        const alt = (v.alt || "").toLowerCase();
        const isBox =
          alt.includes("sweet box") ||
          alt.includes("sweetbox") ||
          alt.includes("square");
        const isTE = alt.includes("te");
        const rotation = isBox && isTE ? 90 : 0;
        return tryApplyMaterialTexture(
          v,
          LOGO_MATERIAL_NAME,
          state.logoDataUrl,
          {
            rotation,
          },
        );
      }),
    );
  });
}

const modelContainer = document.getElementById("modelcontainer");
modelContainer.style.backgroundColor = "pink";

// Elements
const mainbg = document.getElementById("modelcontainer");
const modalContent = document.querySelector(".modal-content");
const pickrContainer = document.getElementById("bgColorPicker");
const trigger = document.getElementById("bgColorPickerTrigger");

// Brightness calculation (used for border contrast)
function getBrightness(hex) {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Apply chosen color
function applyColor(colorStr) {
  mainbg.style.backgroundColor = colorStr;
  modalContent.style.backgroundColor = colorStr;
  localStorage.setItem("bgColor", colorStr);
}

// Border contrast for preview
function updatePickrBorderColor(hexColor) {
  const brightness = getBrightness(hexColor);
  const previewButton = document.querySelector(".pickr .pcr-button");

  if (previewButton) {
    previewButton.style.border = `0.15vw solid ${
      brightness < 128 ? "white" : "black"
    }`;
  }
}

// Initialize Pickr
const pickr = Pickr.create({
  el: "#bgColorPicker",
  theme: "nano",
  default: "#c7c7c7ff",
  components: {
    preview: true,
    opacity: true,
    hue: true,
    interaction: {
      input: true,
      save: true,
    },
  },
});

// Restore saved color on init
pickr.on("init", () => {
  const savedColor = localStorage.getItem("bgColor") || "#c7c7c7ff";
  applyColor(savedColor);
  pickr.setColor(savedColor);
  updatePickrBorderColor(savedColor);
});

// Update color on change
pickr.on("change", (color) => {
  const rgbaColor = color.toRGBA().toString();
  const hexColor = color.toHEXA().toString();

  applyColor(rgbaColor);
  updatePickrBorderColor(hexColor);
});

// Hide picker on save
pickr.on("save", () => {
  pickr.hide();
});

// Show picker when image is clicked
trigger.addEventListener("click", () => {
  pickr.show();
});

// Part Color Picker Initialization
const partTrigger = document.getElementById("partColorPickerTrigger");
const partPickr = Pickr.create({
  el: "#partColorPicker",
  theme: "nano",
  default: "#ffffffff",
  components: {
    preview: true,
    opacity: true,
    hue: true,
    interaction: {
      input: true,
      save: true,
    },
  },
});

partPickr.on("change", (color) => {
  const hexColor = color.toHEXA().toString();
  const currentPart = partSelect.value;
  updateMaterialColor(currentPart, hexColor);

  // Uncheck all radios if custom color is picked
  const radios = document.querySelectorAll('input[name="color"]');
  radios.forEach((r) => (r.checked = false));
});

partPickr.on("save", () => {
  partPickr.hide();
});

partTrigger.addEventListener("click", () => {
  partPickr.show();
});

function preloadImages(urls = []) {
  urls.forEach((url) => {
    const img = new Image();
    img.src = url + "?preload=" + Date.now(); // force preload with unique param
  });
}

// JavaScript
let canvas = null;
let baseImageObj = null;
let logoImageObj = null;

const editBtn = document.querySelector(".edit_btn");
const modal = document.getElementById("editModal");
const closeModal = document.querySelector(".close-button");
const previewLoader = document.getElementById("previewLoader");
const previewWrapper = document.getElementById("previewWrapper");
const uploadInput = document.getElementById("uploadBtn");
const saveLogoBtn = document.getElementById("saveLogoBtn");

// Prevent modal from closing when clicking outside the modal-content
modal.addEventListener("click", (event) => {
  // If the clicked target is the modal background (not modal-content), do nothing
  if (event.target === modal) {
    // Optional: show a warning or just ignore the click
    event.stopPropagation(); // Just ignore it
  }
});

// Helper: get bounding rect of base image on canvas (in canvas coords)
function getBaseImageBounds() {
  if (!baseImageObj) return null;

  const imgLeft =
    baseImageObj.left - (baseImageObj.width * baseImageObj.scaleX) / 2;
  const imgTop =
    baseImageObj.top - (baseImageObj.height * baseImageObj.scaleY) / 2;
  const imgWidth = baseImageObj.width * baseImageObj.scaleX;
  const imgHeight = baseImageObj.height * baseImageObj.scaleY;

  return {
    left: imgLeft,
    top: imgTop,
    right: imgLeft + imgWidth,
    bottom: imgTop + imgHeight,
    width: imgWidth,
    height: imgHeight,
  };
}

const fabricCanvasElem = document.getElementById("fabricCanvas");

// Resize canvas to fit wrapper size
function resizeCanvas() {
  const container = document.getElementById("model_body"); // your target element

  if (!container) {
    console.warn("model_body not found!");
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  fabricCanvasElem.width = width;
  fabricCanvasElem.height = height;

  if (canvas) {
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.renderAll();
  }
}

// Initialize Fabric canvas and load base image (pattern)
function initFabricCanvas() {
  if (canvas) {
    canvas.dispose(); // clean up old canvas if exists
  }

  canvas = new fabric.Canvas("fabricCanvas", {
    selection: false,
    preserveObjectStacking: true,
  });

  resizeCanvas();

  // For Rectangle/Sweet Box models, prioritize the Top (Lid) pattern for editing
  const modelName = mainViewer.alt || "";
  const editUrl = isRectangleModel(modelName)
    ? state.patternUrlTop || state.patternUrl
    : state.patternUrl;

  if (editUrl) {
    previewLoader.style.display = "block"; // show loader before base image loads

    fabric.Image.fromURL(
      editUrl + "?t=" + Date.now(),
      (img) => {
        baseImageObj = img;

        // Scale image to exactly fit canvas width and height (may stretch)
        img.set({
          scaleX: canvas.width / img.width,
          scaleY: canvas.height / img.height,
          selectable: false,
          evented: false,
          left: canvas.width / 2,
          top: canvas.height / 2,
          originX: "center",
          originY: "center",
        });

        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          previewLoader.style.display = "none";
        });
      },
      { crossOrigin: "anonymous" },
    );
  } else {
    previewLoader.style.display = "none"; // no base image, hide loader immediately
  }
}

// Add logo to canvas with drag, resize, rotate enabled
function addLogoToCanvas(dataUrl) {
  if (logoImageObj) {
    canvas.remove(logoImageObj);
    logoImageObj = null;
  }

  fabric.Image.fromURL(
    dataUrl,
    (img) => {
      logoImageObj = img;

      const maxDisplaySize =
        Math.min(canvas.getWidth(), canvas.getHeight()) / 2;
      const scaleRatio = maxDisplaySize / Math.max(img.width, img.height);
      img.scale(scaleRatio);

      img.set({
        originX: "left",
        originY: "top",
        cornerStyle: "circle",
        cornerColor: "yellow",
        transparentCorners: false,
        lockScalingFlip: true,
        selectable: true,
        hasRotatingPoint: true,
        cornerSize: 12,
        minScaleLimit: 0.1,
      });

      // Initial logo position
      img.set({
        left: 10,
        top: 10,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

      // Enforce boundaries when modified
      img.on("modified", () => {
        const bound = img.getBoundingRect();
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

        let newLeft = img.left;
        let newTop = img.top;

        const padding = 1;
        let moved = false;

        // Check horizontal bounds
        if (bound.left < padding) {
          newLeft += padding - bound.left;
          moved = true;
        } else if (bound.left + bound.width > canvasWidth - padding) {
          newLeft -= bound.left + bound.width - canvasWidth + padding;
          moved = true;
        }

        // Check vertical bounds
        if (bound.top < padding) {
          newTop += padding - bound.top;
          moved = true;
        } else if (bound.top + bound.height > canvasHeight - padding) {
          newTop -= bound.top + bound.height - canvasHeight + padding;
          moved = true;
        }

        if (moved) {
          const startLeft = img.left;
          const startTop = img.top;

          fabric.util.animate({
            startValue: 0,
            endValue: 1,
            duration: 400,
            easing: fabric.util.ease.easeOutCubic,
            onChange: (t) => {
              img.set({
                left: startLeft + (newLeft - startLeft) * t,
                top: startTop + (newTop - startTop) * t,
              });
              canvas.renderAll();
            },
            onComplete: () => {
              img.set({ left: newLeft, top: newTop });
              canvas.renderAll();
            },
          });
        }
      });
    },
    { crossOrigin: "anonymous" },
  );
}

function getModelWithoutLogoPath(selectedIndex) {
  const selectedModelName = state.thumbnails[selectedIndex]?.name;
  if (!selectedModelName) return null;

  for (const models of Object.values(MODEL_CATEGORIES_WITHOUT_LOGO)) {
    const found = models.find((m) => m.name === selectedModelName);
    if (found) return found.path;
  }
  return null;
}

function getWithLogoModelPathByName(name) {
  if (!name) return null;
  for (const models of Object.values(MODEL_CATEGORIES)) {
    const found = models.find((m) => m.name === name);
    if (found) return found.path;
  }
  return null;
}

// Open modal and initialize everything
editBtn.addEventListener("click", async () => {
  if (state.patternCycleTimer) {
    await showConfirmModal(
      "Please select the pattern before editing.",
      "Pattern Required",
      true,
    );
    return;
  }

  state.logoDataUrl = null;

  // Get "without logo" model path based on current selection
  const withoutLogoPath = getModelWithoutLogoPath(state.selectedIndex);
  if (withoutLogoPath && mainViewer) {
    const encoded =
      encodeURI(withoutLogoPath) +
      (withoutLogoPath.includes("?") ? "&" : "?") +
      "t=" +
      Date.now();

    // Listen for model load event before applying colors
    mainViewer.addEventListener(
      "load",
      () => {
        // Apply lid and tub colors after model is fully loaded
        Object.entries(state.selectedColors).forEach(([part, color]) => {
          updateMaterialColor(part, color, { skipWait: true });
        });
      },
      { once: true },
    );

    mainViewer.src = encoded;
    state.isWithoutLogoModel = true; // set true when loading without logo model
  }

  if (modal) modal.classList.add("show");

  previewLoader.style.display = "block"; // show loader immediately

  initFabricCanvas();

  // If logo uploaded, add logo asynchronously (no loader wait)
  if (state.logoDataUrl) {
    addLogoToCanvas(state.logoDataUrl);
  }
});

// Upload logo and add to canvas
uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 🔒 Check if file is PNG
  if (file.type !== "image/png") {
    alert("Please upload a PNG image only.");
    uploadInput.value = ""; // Clear input
    return;
  }

  previewLoader.style.display = "block";

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    state.logoDataUrl = dataUrl;

    addLogoToCanvas(dataUrl);
    toggleLogoVisibility(state.hideLogo); // Ensure it shows if toggle is off

    previewLoader.style.display = "none";
  };
  reader.readAsDataURL(file);
});

// Optional: close modal logic
if (closeModal) {
  closeModal.addEventListener("click", () => {
    if (modal) modal.classList.remove("show");

    const currentIndex = state.selectedIndex;
    const selectedModelName = state.thumbnails[currentIndex]?.name;

    if (!selectedModelName || !mainViewer) return;

    // Determine the model path to restore (WITH logo)
    let pathWithLogo = null;

    if (state.isWithoutLogoModel) {
      // If currently on without logo model, restore the corresponding with logo path
      pathWithLogo = getWithLogoModelPathByName(selectedModelName);
    } else {
      // Otherwise just use original selected thumbnail path
      pathWithLogo = state.thumbnails[currentIndex]?.path;
    }

    if (!pathWithLogo) return;

    const encoded =
      encodeURI(pathWithLogo) +
      (pathWithLogo.includes("?") ? "&" : "?") +
      "t=" +
      Date.now();

    // Apply textures and colors AFTER model loads
    mainViewer.addEventListener(
      "load",
      async () => {
        const isRect = isRectangleModel(mainViewer.alt || "");

        // 1. Restore patterns (both lid and tub)
        if (state.patternUrl) {
          await applyPatternToAll(state.patternUrl, {
            patternUrlTop: state.patternUrlTop,
            forceReload: true,
            isEdited: state.isEdited,
          });
        }

        // 2. Restore custom logo if it existed
        if (state.logoDataUrl) {
          await tryApplyMaterialTexture(
            mainViewer,
            LOGO_MATERIAL_NAME,
            state.logoDataUrl,
          );
        }

        // 3. Restore brand logo visibility and colors
        toggleLogoVisibility(state.hideLogo);

        Object.entries(state.selectedColors).forEach(([part, color]) => {
          updateMaterialColor(part, color, { skipWait: true });
        });

        state.isWithoutLogoModel = false; // reset flag after restoring
      },
      { once: true },
    );

    mainViewer.src = encoded;

    if (canvas) {
      if (logoImageObj) {
        canvas.remove(logoImageObj);
        logoImageObj = null;
      }
      canvas.dispose();
      canvas = null;
      baseImageObj = null;
    }

    // Clear session-level logo data
    state.logoDataUrl = null;
    uploadInput.value = "";
  });
}

// Resize canvas on window resize
window.addEventListener("resize", debounce(resizeCanvas, 150));

saveLogoBtn.addEventListener("click", async () => {
  if (!canvas || !baseImageObj) {
    alert("Canvas or base image not ready.");
    return;
  }

  const dataUrl = canvas.toDataURL({
    format: "png",
    quality: 1.0,
    multiplier: baseImageObj.width / canvas.getWidth(),
  });

  // ✅ RESTORE "WITH LOGO" model but HIDE the logo physically
  const selectedModelName = state.thumbnails[state.selectedIndex]?.name;
  const pathWithLogo = getWithLogoModelPathByName(selectedModelName);

  if (pathWithLogo && mainViewer) {
    const encoded =
      encodeURI(pathWithLogo) +
      (pathWithLogo.includes("?") ? "&" : "?") +
      "t=" +
      Date.now();

    mainViewer.addEventListener(
      "load",
      async () => {
        // 1. Hide the baked-in brand logo
        state.hideLogo = true;
        const hideLogoToggle = document.getElementById("hideLogoToggle");
        if (hideLogoToggle) hideLogoToggle.checked = true;
        toggleLogoVisibility(true);

        // 2. Apply patterns (re-applying both lid and tub to ensure nothing is lost)
        const isRect = isRectangleModel(mainViewer.alt);
        if (isRect) {
          state.patternUrlTop = dataUrl;
        } else {
          state.patternUrl = dataUrl;
        }
        state.isEdited = true;

        await applyPatternToAll(state.patternUrl, {
          patternUrlTop: state.patternUrlTop,
          isEdited: true,
          forceReload: true,
        });

        // 3. Restore colors
        Object.entries(state.selectedColors).forEach(([part, color]) => {
          updateMaterialColor(part, color, { skipWait: true });
        });

        state.isWithoutLogoModel = false;
      },
      { once: true },
    );

    mainViewer.src = encoded;
  } else {
    console.error(
      "[Save] Could not find with-logo path for:",
      selectedModelName,
    );
    // Fallback: Apply to current model directly
    const matName = isRectangleModel(mainViewer.alt)
      ? RECTANGLE_PATTERN_MATERIAL_NAME
      : PATTERN_MATERIAL_NAME;
    state.patternUrl = dataUrl;
    state.isEdited = true;
    await tryApplyMaterialTexture(mainViewer, matName, dataUrl, {
      forceReload: true,
    });
    state.hideLogo = true;
  }

  // Modal and UI cleanup
  modal.classList.remove("show");
  if (logoImageObj) {
    canvas.remove(logoImageObj);
    logoImageObj = null;
  }
  state.logoDataUrl = null;
});

/********** INIT **********/
document.addEventListener("DOMContentLoaded", async () => {
  const preloader = document.getElementById("preloader");
  if (preloader) preloader.style.display = "flex";

  const saved = localStorage.getItem("selectedColors");
  if (saved) {
    state.selectedColors = JSON.parse(saved);
  } else {
    // Keep empty to let shape-based defaults apply on first load
    state.selectedColors = {};
  }

  // ✅ Wait for thumbnails and categories to load
  await initModelAccordion();
  state.allPatterns = await initCategoryAccordion(); // must return all patterns!

  // ✅ Apply default filter for "Round" since it's opened by default
  filterPatternAccordion("Round");

  if (mainViewer && !state.modelViewers.includes(mainViewer)) {
    state.modelViewers.push(mainViewer);
  }

  if (partSelect) {
    partSelect.value = "tub";
    updatePart("tub");
    partSelect.addEventListener("change", () => {
      updatePart(partSelect.value);
      // Sync color picker with current part's color if it's a custom hex
      const currentColor = state.selectedColors[partSelect.value];
      if (currentColor && currentColor.startsWith("#") && partPickr) {
        partPickr.setColor(currentColor, true);
      }
    });
  }

  // Auto Rotate Toggle Logic
  const autoRotateToggle = document.getElementById("autoRotateToggle");
  if (autoRotateToggle && mainViewer) {
    autoRotateToggle.addEventListener("change", (e) => {
      updateAutoRotateSmooth(e.target.checked);
    });
  }

  // Auto Apply Toggle Logic
  const autoApplyToggle = document.getElementById("autoApplyToggle");
  if (autoApplyToggle) {
    autoApplyToggle.addEventListener("change", async (e) => {
      if (e.target.checked) {
        if (state.isEdited) {
          const confirmed = await showConfirmModal(
            "Enabling Auto Apply will replace your edited pattern. Proceed?",
          );
          if (!confirmed) {
            e.target.checked = false;
            return;
          }
        }
        if (state.allPatterns && state.allPatterns.length > 0) {
          startPatternCycle(state.allPatterns, 2000);
        }
      } else {
        stopPatternCycle();
      }
    });
  }

  // Hide Logo Toggle Logic
  const hideLogoToggle = document.getElementById("hideLogoToggle");
  if (hideLogoToggle) {
    hideLogoToggle.addEventListener("change", (e) => {
      state.hideLogo = e.target.checked;
      toggleLogoVisibility(state.hideLogo);
    });
  }

  // ✅ Restore saved colors
  Object.keys(state.selectedColors).forEach((part) => {
    const savedColor =
      state.selectedColors[part] || options[part][0].toLowerCase();
    updateMaterialColor(part, savedColor);
  });

  // ✅ Preload and cycle patterns (after loading categories)
  if (state.allPatterns && state.allPatterns.length > 0) {
    preloadImages(state.allPatterns);
    if (autoApplyToggle && autoApplyToggle.checked) {
      startPatternCycle(state.allPatterns, 2000);
    }
  }

  // ✅ Hide preloader
  if (preloader) {
    preloader.classList.add("fade-out");
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500);
  }
});

function toggleLogoVisibility(hide) {
  const viewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );
  viewers.forEach((viewer) => {
    if (!viewer || !viewer.model) return;

    // Find ALL materials that contain "logo" just to be safe
    const logoMaterials = viewer.model.materials.filter(
      (m) =>
        m.name.toLowerCase().includes("logo") ||
        m.name.toLowerCase() === LOGO_MATERIAL_NAME.toLowerCase(),
    );

    logoMaterials.forEach((logoMat) => {
      // Force BLEND mode to support transparency and avoid black quads
      logoMat.setAlphaMode("BLEND");

      if (hide) {
        // Transparent
        logoMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 0]);
      } else {
        // Fully visible + White factor (preserves original texture colors)
        logoMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
      }
    });
  });
}

/********** CUSTOM CONFIRM MODAL **********/
function showConfirmModal(
  message = "",
  title = "Confirm Action",
  hideCancel = false,
) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    if (!modal || !okBtn || !cancelBtn) {
      resolve(confirm(message));
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    // Control and reset buttons
    okBtn.textContent = "OK";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.display = hideCancel ? "none" : "flex";

    modal.classList.add("show");

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.classList.remove("show");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}
