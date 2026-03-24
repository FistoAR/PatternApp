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
function updateMaterialColor(
  part,
  color,
  { skipWait = false, specificViewer = null } = {},
) {
  const viewers = specificViewer
    ? [specificViewer]
    : Array.from(
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
            mat.pbrMetallicRoughness.setRoughnessFactor(0.39);
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
      path: "./assets/Model_with_logo/120ml_round_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.25m",
      minCameraOrbit: "auto auto 0.25m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "250ml Round Container",
      path: "./assets/Model_with_logo/250ml_round_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.35m",
      minCameraOrbit: "auto auto 0.35m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "300ml Round Container",
      path: "./assets/Model_with_logo/300ml_round_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.35m",
      minCameraOrbit: "auto auto 0.35m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "500ml Round Container",
      path: "./assets/Model_with_logo/500ml_round_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.30m",
      minCameraOrbit: "auto auto 0.30m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "750ml Round Container",
      path: "./assets/Model_with_logo/750ml_round_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.35m",
      minCameraOrbit: "auto auto 0.35m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "1000ml Round Container",
      path: "./assets/Model_with_logo/1000ml_round_with_logo.glb",
    },
  ],
  "Round Square": [
    {
      name: "450ml/500gms Container",
      path: "./assets/Model_with_logo/450ml_round_square_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.35m",
      minCameraOrbit: "auto auto 0.35m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "500ml Container",
      path: "./assets/Model_with_logo/500ml_round_square_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.33m",
      minCameraOrbit: "auto auto 0.33m",
      maxCameraOrbit: "auto auto 0.95m",
    },
  ],
  Rectangle: [
    {
      name: "500ml Rectangular Container",
      path: "./assets/Model_with_logo/500ml_rectangle_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.45m",
      minCameraOrbit: "auto auto 0.45m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "650ml Rectangular Container",
      path: "./assets/Model_with_logo/650ml_rectangle_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.45m",
      minCameraOrbit: "auto auto 0.45m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "750ml Rectangular Container",
      path: "./assets/Model_with_logo/750ml_rectangle_with_logo.glb",
    },
  ],
  "Sweet Box": [
    {
      name: "250gms Sweet Box",
      path: "./assets/Model_with_logo/250gms_sweet_box_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.60m",
      minCameraOrbit: "auto auto 0.60m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "500gms Sweet Box",
      path: "./assets/Model_with_logo/500gms_sweet_box_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.55m",
      minCameraOrbit: "auto auto 0.55m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "1kg Sweet Box",
      path: "./assets/Model_with_logo/1kg_sweet_box_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.60m",
      minCameraOrbit: "auto auto 0.60m",
      maxCameraOrbit: "auto auto 0.95m",
    },
  ],
  "Sweet Box Tamper Evident": [
    {
      name: "250gms Sweet Box Tamper Evident",
      path: "./assets/Model_with_logo/250gms_sweet_box_TE_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.45m",
      minCameraOrbit: "auto auto 0.45m",
      maxCameraOrbit: "auto auto 0.95m",
    },
    {
      name: "500gms Sweet Box Tamper Evident",
      path: "./assets/Model_with_logo/500gms_sweet_box_TE_with_logo.glb",
      cameraOrbit: "0deg 75deg 0.45m",
      minCameraOrbit: "auto auto 0.45m",
      maxCameraOrbit: "auto auto 0.95m",
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
  lastLibraryPatternUrlTop: null, // Store the last non-edited pattern for Rectangle Lid
  lastLogoState: null, // Stores {dataUrl, left, top, scaleX, scaleY, angle}
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
        ...model,
        card,
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
      if (
        header.parentElement &&
        header.parentElement.classList.contains("pattern-group")
      ) {
        header.parentElement.style.display = typeVisible ? "flex" : "none";
      }
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
}

/********** MODEL SELECTION **********/
async function selectModel(index) {
  if (index < 0 || index >= state.thumbnails.length) return;

  const modelLoader = document.getElementById("modelLoader");
  if (modelLoader) {
    modelLoader.classList.add("active");
  }

  // 🛑 STOP CYCLE: Prevent auto-pattern from firing during model load/transition
  stopPatternCycle(false);

  // 🔄 REVERT CANVAS EDITS: If switching models, clear edited pattern and restore brand logo
  if (state.isEdited) {
    const confirmed = await showConfirmModal(
      "Your edited pattern will be lost. Are you sure you want to switch models?",
    );
    if (!confirmed) {
      if (modelLoader) modelLoader.classList.remove("active");
      return;
    }

    console.log(
      "[CategorySwitch] Reverting edited pattern to last library pattern.",
    );
    state.patternUrl = state.lastLibraryPatternUrl; // Restore last non-edited pattern
    state.patternUrlTop = state.lastLibraryPatternUrlTop;
    state.logoDataUrl = null; // Clear uploaded logo
    state.isEdited = false;
    state.hideLogo = false;
    state.lastLogoState = null;

    // Update UI toggle
    const hideLogoToggle = document.getElementById("hideLogoToggle");
    if (hideLogoToggle) hideLogoToggle.checked = false;

    // Note: toggleLogoVisibility will be called inside the "load" listener below
  }

  state.selectedIndex = index;
  markSelectedThumbnail(index);

  // Clear any uploaded logo and reset state
  const hadCustomLogo = !!state.logoDataUrl;
  state.logoDataUrl = null;
  if (logoInput) logoInput.value = "";

  // If we had a custom logo, we must refresh thumbnails to restore their default GLB look
  // because setTexture(null) removes the baked-in logo. Reloading is the only way to revert.
  if (hadCustomLogo && state.modelViewers) {
    state.modelViewers.forEach((v) => {
      if (v && v.src) {
        const base = v.src.split("?")[0];
        v.src = base + "?t=" + Date.now();
      }
    });
  }

  const selectedModel = state.thumbnails[index];
  if (!mainViewer) return;

  const transitionStart = Date.now();

  // Set reveal="auto" (we use our own overlay for the transition)
  mainViewer.reveal = "auto";
  mainViewer.alt = selectedModel.name;
  mainModelTitle.textContent = selectedModel.name;

  // 🔎 PRE-CALCULATE SHAPE INFO (needed for load listener and accordion filtering)
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

    // Reset pattern URLs to NULL whenever we change model type (Round -> Rectangle etc.)
    // This allows the "load" event listener below to identify the NEW first compatible
    // pattern for the fresh shape, avoiding any flicker from the previous model's pattern.
    state.patternUrl = null;
    state.patternUrlTop = null;
  } else {
    console.log("[CategorySwitch] Same type, continuing pattern sequence.");
  }

  // ✅ Apply Per-Model View Settings BEFORE loading source
  if (selectedModel) {
    let minOrbit = selectedModel.minCameraOrbit || "auto auto 0.25m";
    let maxOrbit = selectedModel.maxCameraOrbit || "auto auto 0.95m";
    let orbit = selectedModel.cameraOrbit || "0deg 75deg auto";

    mainViewer.setAttribute("min-camera-orbit", minOrbit);
    mainViewer.setAttribute("max-camera-orbit", maxOrbit);
    mainViewer.setAttribute("camera-orbit", orbit);
    mainViewer.cameraOrbit = orbit;
  }

  filterPatternAccordion(shapeFilter, !typeChanged);

  const modelPath = encodeURI(selectedModel.path);

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

          // Apply to the 3D model (Main Viewer only to avoid lag)
          updateMaterialColor("lid", state.selectedColors.lid, {
            skipWait: true,
            specificViewer: mainViewer,
          });
          updateMaterialColor("tub", state.selectedColors.tub, {
            skipWait: true,
            specificViewer: mainViewer,
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

        // ✅ RE-APPLY per-model camera settings AFTER load to ensure they stick
        if (selectedModel) {
          const minO = selectedModel.minCameraOrbit || "auto auto 0.25m";
          const maxO = selectedModel.maxCameraOrbit || "auto auto 0.95m";
          const orb = selectedModel.cameraOrbit || "0deg 75deg auto";

          mainViewer.setAttribute("min-camera-orbit", minO);
          mainViewer.setAttribute("max-camera-orbit", maxO);
          mainViewer.setAttribute("camera-orbit", orb);
          mainViewer.cameraOrbit = orb;
        }

        // Material detection
        const curShape = getCanonicalShape(selectedModel.shape);
        const isRect =
          isRectangleModel(selectedModel.name) || curShape === "Rectangle";
        const materialName = isRect
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;

        state.patternMaterialOverride = materialName;

        // Resolve pattern logic
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

        // 🚀 PERFORM ALL UPDATES IN PARALLEL for maximum speed
        const updateTasks = [];
        if (state.patternUrl) {
          updateTasks.push(
            applyPatternToAll(state.patternUrl, {
              materialOverride: materialName,
              patternUrlTop: state.patternUrlTop,
              isEdited: state.isEdited,
            }),
          );
        }
        if (state.logoDataUrl) {
          updateTasks.push(
            tryApplyMaterialTexture(
              mainViewer,
              LOGO_MATERIAL_NAME,
              state.logoDataUrl,
            ),
          );
        }
        for (const [part, color] of Object.entries(state.selectedColors)) {
          updateTasks.push(
            updateMaterialColor(part, color, {
              skipWait: true,
              specificViewer: mainViewer,
            }),
          );
        }

        // Wait for ALL visual updates
        await Promise.all(updateTasks);

        // Update swatch UI
        if (state.patternUrl) {
          document.querySelectorAll(".pattern-swatch").forEach((el) => {
            el.classList.toggle(
              "selected",
              el.dataset.patternUrl?.split("?")[0] === state.patternUrl,
            );
          });
        }

        // ✅ CONSISTENT 1S LOADING: Calculate remaining time to wait
        const elapsed = Date.now() - transitionStart;
        const remaining = Math.max(120, 1000 - elapsed); // Minimum 120ms for render frame, or up to 1s total

        setTimeout(() => {
          if (modelLoader) modelLoader.classList.remove("active");
        }, remaining);

        console.log("Model ready:", selectedModel.name);

        // ✅ RESUME CYCLE: Only restart the auto-cycle after everything is applied and model is ready
        const autoApplyToggle = document.getElementById("autoApplyToggle");
        if (
          autoApplyToggle &&
          autoApplyToggle.checked &&
          state.allPatterns.length > 0
        ) {
          startPatternCycle(state.allPatterns, 2000, true);
        }
      } catch (err) {
        console.error("Error applying pattern or logo:", err);
        if (modelLoader) modelLoader.classList.remove("active");
      }
    },
    { once: true },
  );

  // Force reload if we just reverted an edit
  if (mainViewer.src === modelPath) {
    mainViewer.src =
      modelPath + (modelPath.includes("?") ? "&" : "?") + "t=" + Date.now();
  } else {
    mainViewer.src = modelPath;
  }
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
      const noteMsg = document.createElement("div");
      noteMsg.textContent =
        "Stop auto apply pattern to double click to view pattern";
      noteMsg.style.fontSize = "0.7vw";
      noteMsg.style.color = "#888";
      noteMsg.style.fontStyle = "italic";
      noteMsg.style.padding = "0.5vw 0.5vw 0 0.5vw";
      content.appendChild(noteMsg);

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

          sw.addEventListener("dblclick", () => {
            const autoApplyToggle = document.getElementById("autoApplyToggle");
            if (autoApplyToggle && autoApplyToggle.checked) return;
            openPatternFullView(urlBottom, urlTop);
          });

          sw.addEventListener("click", async () => {
            stopPatternCycle();

            if (state.isEdited || state.isWithoutLogoModel) {
              let confirmed = false;
              if (state.isEdited) {
                confirmed = await showConfirmModal(
                  "Your edited pattern will be lost. Are you sure you want to select a new library pattern?",
                );
              } else if (state.isWithoutLogoModel) {
                confirmed = await showConfirmModal(
                  "Selecting a new pattern will remove your custom logo. Proceed?",
                );
              }

              if (!confirmed) return;

              // After user clicks OK, explicitly clear the logo
              state.logoDataUrl = null;
              state.lastLogoState = null;
              state.hideLogo = false;
              state.isWithoutLogoModel = false;

              const logoInp = document.getElementById("logoUpload");
              if (logoInp) logoInp.value = "";

              const hideLogoToggle = document.getElementById("hideLogoToggle");
              if (hideLogoToggle) hideLogoToggle.checked = false;

              // Re-enable visibility (if it was just hidden)
              toggleLogoVisibility(false);

              // If a custom 3D material logo was applied, clearing requires model reload to get baked-in texture back
              // But we can just clear it visually or reload it. The easiest is calling clearMaterialTexture to wipe the override.
              // But wait, clearMaterialTexture removes the baked-in one too.
              // We'll just leave it un-overridden for now, or reload if necessary.
              // Actually, since we're applying a new pattern and the user explicitly asked to clear the logo:
              const allViewers = Array.from(
                new Set(
                  [...(state.modelViewers || []), mainViewer].filter(Boolean),
                ),
              );
              allViewers.forEach((v) => {
                if (v && v.src && v.src.includes("?t=")) {
                  v.src = v.src.split("?")[0] + "?t=" + Date.now();
                }
              });
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

            sw.addEventListener("dblclick", () => {
              const autoApplyToggle =
                document.getElementById("autoApplyToggle");
              if (autoApplyToggle && autoApplyToggle.checked) return;
              openPatternFullView(
                patObj.type === "bottom" ? url : null,
                patObj.type === "top" ? url : null,
              );
            });

            sw.addEventListener("click", async () => {
              stopPatternCycle();

              if (state.isEdited || state.isWithoutLogoModel) {
                let confirmed = false;
                if (state.isEdited) {
                  confirmed = await showConfirmModal(
                    "Your edited pattern will be lost. Are you sure you want to select a new library pattern?",
                  );
                } else if (state.isWithoutLogoModel) {
                  confirmed = await showConfirmModal(
                    "Selecting a new pattern will remove your custom logo. Proceed?",
                  );
                }

                if (!confirmed) return;

                // After user clicks OK, explicitly clear the logo
                state.logoDataUrl = null;
                state.lastLogoState = null;
                state.hideLogo = false;
                state.isWithoutLogoModel = false;

                const logoInp = document.getElementById("logoUpload");
                if (logoInp) logoInp.value = "";

                const hideLogoToggle =
                  document.getElementById("hideLogoToggle");
                if (hideLogoToggle) hideLogoToggle.checked = false;

                toggleLogoVisibility(false);

                const allViewers = Array.from(
                  new Set(
                    [...(state.modelViewers || []), mainViewer].filter(Boolean),
                  ),
                );
                allViewers.forEach((v) => {
                  if (v && v.src && v.src.includes("?t=")) {
                    v.src = v.src.split("?")[0] + "?t=" + Date.now();
                  }
                });
              }
              state.currentPatternType = patObj.type;
              await applyPatternToAll(url);
            });

            if (patObj.type === "top") lidGroup.appendChild(sw);
            else tubGroup.appendChild(sw);
          });
        }
      });

      if (lidGroup.children.length <= 1) lidGroup.style.display = "none";
      if (tubGroup.children.length <= 1) tubGroup.style.display = "none";
      if (fullGroup.children.length <= 1) fullGroup.style.display = "none";

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

// ---- UHD Export helpers ----

/**
 * Composite a transparent-background PNG data-URL over a solid fill colour.
 * Returns a new data-URL with the background baked in (required for JPG/PDF).
 */
function compositeWithBackground(pngDataUrl, bgColor, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/png", 1.0));
    };
    img.src = pngDataUrl;
  });
}

/**
 * Wait for N animation frames then an extra delay.
 * Used so WebGL has time to re-render after a resize.
 */
function waitFrames(count = 6, extraMs = 600) {
  return new Promise((resolve) => {
    let n = count;
    const tick = () => {
      if (--n > 0) requestAnimationFrame(tick);
      else setTimeout(resolve, extraMs);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Capture a UHD (3840x2160) screenshot using the LIVE mainViewer —
 * completely invisible to the user.
 *
 * How it works:
 *  1. Record the viewer's current on-screen bounding rect.
 *  2. Switch it to position:fixed at UHD size (3840×2160).
 *  3. Immediately apply a CSS transform:scale() that shrinks it back to
 *     its original visual footprint → the user sees nothing change.
 *  4. WebGL re-renders at the new DOM size (3840×2160) — transforms are
 *     applied AFTER GPU rasterisation, so the canvas IS UHD.
 *  5. toDataURL() captures the full 3840×2160 canvas.
 *  6. Restore all styles.
 */
async function captureUHDImage() {
  const UHD_W = 3840;
  const UHD_H = 2160;

  // Background colour
  const bgRaw =
    document.getElementById("modelcontainer")?.style.backgroundColor ||
    "#c7c7c7";

  // ── 1. Snapshot current visual position & size ───────────────────────────
  const rect = mainViewer.getBoundingClientRect();
  const scaleX = rect.width / UHD_W;
  const scaleY = rect.height / UHD_H;

  // ── 2. Save existing inline styles ───────────────────────────────────────
  const savedStyle = {
    position: mainViewer.style.position,
    top: mainViewer.style.top,
    left: mainViewer.style.left,
    width: mainViewer.style.width,
    height: mainViewer.style.height,
    transform: mainViewer.style.transform,
    transformOrigin: mainViewer.style.transformOrigin,
    zIndex: mainViewer.style.zIndex,
    flex: mainViewer.style.flex,
    minWidth: mainViewer.style.minWidth,
    minHeight: mainViewer.style.minHeight,
    maxWidth: mainViewer.style.maxWidth,
    maxHeight: mainViewer.style.maxHeight,
  };

  try {
    // ── 3. Resize to UHD, scale back to original visual size ─────────────
    //    position:fixed takes it out of layout flow (no reflow / shift).
    //    transform:scale shrinks the visual output so nothing is visible.
    Object.assign(mainViewer.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${UHD_W}px`,
      height: `${UHD_H}px`,
      transform: `scale(${scaleX}, ${scaleY})`,
      transformOrigin: "top left",
      zIndex: "1",
      flex: "none",
      minWidth: "unset",
      minHeight: "unset",
      maxWidth: "unset",
      maxHeight: "unset",
    });

    // ── 4. Wait for WebGL to produce a UHD frame ─────────────────────────
    await waitFrames(8, 700);

    // ── 5. Capture at full UHD resolution ────────────────────────────────
    const rawDataUrl = await mainViewer.toDataURL("image/png", 1.0);
    return { rawDataUrl, bgRaw };
  } finally {
    // ── 6. Restore all original styles ───────────────────────────────────
    Object.assign(mainViewer.style, savedStyle);
  }
}

// ── Full-screen export overlay helpers ───────────────────────────────────────

function showExportOverlay() {
  const old = document.getElementById("uhd-export-overlay");
  if (old) old.remove();

  // Inject styles once
  if (!document.getElementById("uhd-overlay-style")) {
    const s = document.createElement("style");
    s.id = "uhd-overlay-style";
    s.textContent = `
      #uhd-export-overlay {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: all;
      }
      #uhd-export-overlay.visible { opacity: 1; }
      .uhd-overlay-spinner {
        width: 56px; height: 56px;
        border: 5px solid rgba(255,255,255,.18);
        border-top-color: #fff;
        border-radius: 50%;
        animation: uhd-ov-spin .85s linear infinite;
      }
      @keyframes uhd-ov-spin { to { transform: rotate(360deg); } }
      .uhd-overlay-label {
        color: #fff;
        font-family: sans-serif;
        font-size: 15px;
        font-weight: 500;
        letter-spacing: .4px;
        opacity: .85;
      }
    `;
    document.head.appendChild(s);
  }

  const overlay = document.createElement("div");
  overlay.id = "uhd-export-overlay";
  overlay.innerHTML = `
    <div class="uhd-overlay-spinner"></div>
    <span class="uhd-overlay-label">Generating UHD export…</span>
  `;
  document.body.appendChild(overlay);

  // Trigger fade-in on next frame
  requestAnimationFrame(() => overlay.classList.add("visible"));
  return overlay;
}

function hideExportOverlay() {
  const overlay = document.getElementById("uhd-export-overlay");
  if (!overlay) return;
  overlay.classList.remove("visible");
  setTimeout(() => overlay.remove(), 250);
}

// ─────────────────────────────────────────────────────────────────────────────

// ---- Main export button listener ----

exportBtn.addEventListener("click", async () => {
  const format = exportFormat.value;

  if (!mainViewer) return;

  // Disable button + show full-screen overlay instantly
  const originalText = exportBtn.textContent;
  exportBtn.disabled = true;
  exportBtn.textContent = "Exporting…";
  showExportOverlay();

  try {
    const UHD_W = 3840;
    const UHD_H = 2160;

    // Wait 3 seconds so the loading screen is fully visible before capture starts
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const { rawDataUrl, bgRaw } = await captureUHDImage();

    // Generate a clean filename: replace spaces with underscores and remove non-alphanumeric chars
    const modelName = mainModelTitle.textContent
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    if (format === "pdf") {
      // ── PDF: embed UHD image into a 3840×2160 pt page ───────────────────
      const composited = await compositeWithBackground(
        rawDataUrl,
        bgRaw,
        UHD_W,
        UHD_H,
      );
      const { jsPDF } = window.jspdf;
      // Use millimetre units, landscape, custom UHD size (scaled to mm: 1pt≈0.3528mm)
      // 3840×2160 px at 96 dpi → in mm: (3840/96)*25.4 = 1016mm × 571.5mm
      const mmW = (UHD_W / 96) * 25.4;
      const mmH = (UHD_H / 96) * 25.4;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [mmW, mmH],
      });
      pdf.addImage(composited, "PNG", 0, 0, mmW, mmH, "", "FAST");
      pdf.save(`${modelName}_Mockup.pdf`);
    } else if (format === "jpg") {
      // ── JPG: composite background then re-encode as JPEG for max quality ──
      const composited = await compositeWithBackground(
        rawDataUrl,
        bgRaw,
        UHD_W,
        UHD_H,
      );
      // Convert to JPEG at quality 1.0
      const jpgCanvas = document.createElement("canvas");
      jpgCanvas.width = UHD_W;
      jpgCanvas.height = UHD_H;
      const ctx = jpgCanvas.getContext("2d");
      const img = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = composited;
      });
      ctx.drawImage(img, 0, 0);
      const jpgDataUrl = jpgCanvas.toDataURL("image/jpeg", 1.0);
      const link = document.createElement("a");
      link.href = jpgDataUrl;
      link.download = `${modelName}.jpg`;
      link.click();
    } else {
      // ── PNG: transparent-background UHD export ────────────────────────────
      const link = document.createElement("a");
      link.href = rawDataUrl;
      link.download = `${modelName}.png`;
      link.click();
    }
  } catch (err) {
    console.error("UHD Export failed:", err);
    alert("Export failed. Please try again.");
  } finally {
    hideExportOverlay();
    exportBtn.disabled = false;
    exportBtn.textContent = originalText;
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
      const isTE_Model =
        modelAlt.includes("te") ||
        modelAlt.includes("tamper evident") ||
        modelAlt.includes("sweet box te");

      if (isBox) {
        if (typeFromSwatch === "top") targets = RECTANGLE_PATTERN_MATERIAL_NAME;
        else if (typeFromSwatch === "bottom") targets = PATTERN_MATERIAL_NAME;
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

          tryApplyMaterialTexture(viewer, matNames, pUrl, {
            skipWait: true,
            rotation: rot,
          }).catch(() => {});
        };

        // Use the existing 'sw' variable found earlier
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
  const names = (
    Array.isArray(materialName) ? materialName : [materialName]
  ).map((n) => n.toLowerCase());

  viewer.model.materials.forEach((material) => {
    const matName = material.name.toLowerCase();
    if (
      names.some((n) => matName === n) &&
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

  // 🛡️ SHIELD: Show loader for Sweet Box multi-pattern application to hide the sequential apply
  const modelLoader = document.getElementById("modelLoader");
  const modelName = mainViewer ? mainViewer.alt : "";
  const canonical = getCanonicalShape(modelName);
  const isSweetBox = canonical.toLowerCase().includes("sweet box");
  const loaderWasActive = modelLoader
    ? modelLoader.classList.contains("active")
    : false;
  const needsLoader =
    isSweetBox && patternUrlTop && modelLoader && !loaderWasActive;

  if (needsLoader) {
    modelLoader.classList.add("active");
  }

  const cleanSelectedUrl = patternUrl.split("?")[0];
  state.patternUrl = cleanSelectedUrl;
  state.lastLibraryPatternUrl = isEdited
    ? state.lastLibraryPatternUrl
    : cleanSelectedUrl;

  // Track top pattern specifically for Rectangle/Sweet Box models
  if (patternUrlTop) {
    const cleanTop = patternUrlTop.split("?")[0];
    state.patternUrlTop = cleanTop;
    if (!isEdited) state.lastLibraryPatternUrlTop = cleanTop;
  } else if (isRectangleModel(mainViewer.alt)) {
    state.patternUrlTop = cleanSelectedUrl;
    if (!isEdited) state.lastLibraryPatternUrlTop = cleanSelectedUrl;
  } else {
    state.patternUrlTop = null;
    if (!isEdited) state.lastLibraryPatternUrlTop = null;
  }

  // Clear last logo state if we are applying a NEW library pattern
  if (!isEdited) {
    state.lastLogoState = null;
  }

  state.isEdited = isEdited;

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

    const isTE_Model =
      modelAlt.includes("te") ||
      modelAlt.includes("tamper evident") ||
      modelAlt.includes("sweet box te");

    let tasks = [];
    if (patternUrlTop) {
      tasks = [
        { url: patternUrl, type: "bottom" },
        { url: patternUrlTop, type: "top" },
      ];
    } else {
      tasks = [{ url: patternUrl, type: state.currentPatternType || "bottom" }];
    }

    // 🚀 STEP 1: LOAD ALL TEXTURES IN PARALLEL
    // We pre-create the textures and put them in cache so they are ready for instant application
    await Promise.all(
      tasks.map(async (task) => {
        if (!task.url) return;
        let vcache = viewerTextureCache.get(viewer);
        if (!vcache) {
          vcache = new Map();
          viewerTextureCache.set(viewer, vcache);
        }
        const cacheKey = `${stripQuery(task.url)}_rot0`;
        if (!forceReload && vcache.has(cacheKey)) return;

        try {
          const tex = await viewer.createTexture(task.url);
          vcache.set(cacheKey, tex);
        } catch (e) {
          console.error("[applyTask] Failed to preload texture:", task.url, e);
        }
      }),
    );

    // 🚀 STEP 2: APPLY ALL TEXTURES (Now synchronous from cache)
    for (const task of tasks) {
      let matNames = [];
      if (isBox) {
        matNames =
          task.type === "top"
            ? RECTANGLE_PATTERN_MATERIAL_NAME
            : PATTERN_MATERIAL_NAME;
      } else {
        matNames = isRectangleModel(modelAlt)
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;
      }

      // This call will now find the texture in cache and apply it instantly without awaiting
      await tryApplyMaterialTexture(viewer, matNames, task.url, {
        skipWait: true,
        rotation: 0,
        forceReload,
      });
    }
  };

  // 🚀 Start main viewer immediately and AWAIT it
  await applyTask(mainViewer);

  // Background the rest
  allViewers
    .filter((v) => v !== mainViewer)
    .forEach((v) => applyTask(v).catch(() => {}));

  // Hide shield after apply is done
  if (needsLoader) {
    setTimeout(() => {
      modelLoader.classList.remove("active");
    }, 1000);
  }
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
  const matchingMaterials = (viewer.model?.materials || []).filter((m) => {
    const matName = m.name.toLowerCase();
    return names.some((n) => {
      if (n === "logo") return matName === "logo";
      return matName.includes(n);
    });
  });

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
      mat.setAlphaMode("MASK");
      mat.setAlphaCutoff(0.5);
      mat.doubleSided = true;
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
        const isTE_Model =
          alt.includes("te") ||
          alt.includes("tamper evident") ||
          alt.includes("sweet box te");
        const rotation = isBox && isTE_Model ? 90 : 0;
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
// modelContainer.style.backgroundColor = "pink"; // Removed debug color

// Elements
const mainbg = document.getElementById("modelcontainer");
const modalContent = document.querySelector(".modal-content");
const pickrContainer = document.getElementById("bgColorPicker");
const trigger = document.getElementById("bgColorPickerTrigger");

// Brightness calculation (handles hex, rgba, and color names)
function getBrightness(color) {
  if (!color || typeof color !== "string") return 255; // Default to light

  let r, g, b;
  if (color.startsWith("#")) {
    r = parseInt(color.substr(1, 2), 16) || 0;
    g = parseInt(color.substr(3, 2), 16) || 0;
    b = parseInt(color.substr(5, 2), 16) || 0;
  } else if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match) {
      [r, g, b] = match.map(Number);
    }
  } else {
    // Fallback for "white", "black" etc
    const lower = color.toLowerCase();
    if (lower === "white") return 255;
    if (lower === "black") return 0;
    return 200; // default light-ish
  }
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Apply chosen color
function applyColor(colorStr, hexColor = null, opaqueColor = null) {
  mainbg.style.backgroundColor = colorStr;
  modalContent.style.backgroundColor = colorStr;

  // Also update the loader overlay to match exactly - FORCE OPAQUE
  // User asked for no transparency on loader to hide glitches
  const modelLoader = document.getElementById("modelLoader");
  if (modelLoader) {
    modelLoader.style.backgroundColor = opaqueColor || hexColor || colorStr;
  }

  // Handle text contrast based on brightness
  const colorToMeasure = hexColor || colorStr;
  const brightness = getBrightness(colorToMeasure);

  if (brightness < 128) {
    mainbg.classList.add("bg-dark");
  } else {
    mainbg.classList.remove("bg-dark");
  }

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
  // On init, extract hex if possible for the opaque base
  const opaqueBase =
    savedColor && savedColor.startsWith("#")
      ? savedColor.substring(0, 7)
      : savedColor;
  applyColor(savedColor, savedColor, opaqueBase);
  pickr.setColor(savedColor);
  updatePickrBorderColor(savedColor);
});

// Update color on change
pickr.on("change", (color) => {
  const rgbaColor = color.toRGBA().toString();
  const hexColor = color.toHEXA().toString();
  // Get 6-digit hex for the opaque base by slicing the 8-digit HEXA string
  const opaqueColor = hexColor.slice(0, 7);

  applyColor(rgbaColor, hexColor, opaqueColor);
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

async function preloadImages(urls = []) {
  if (!urls || urls.length === 0) return;
  const viewer = mainViewer || document.getElementById("mainViewer");
  if (!viewer) {
    console.warn(
      "[Preload] No viewer found, falling back to basic image preload.",
    );
    urls.forEach((url) => {
      if (url) new Image().src = url;
    });
    return;
  }

  console.log(
    `[Preload] Priming 3D texture cache for ${urls.length} images...`,
  );

  // Create textures in small batches to keep the GPU and UI thread responsive
  const batchSize = 3;
  let current = 0;

  const loadBatch = async () => {
    const batch = urls.slice(current, current + batchSize);

    await Promise.all(
      batch.map(async (url) => {
        if (!url) return;

        let vcache = viewerTextureCache.get(viewer);
        if (!vcache) {
          vcache = new Map();
          viewerTextureCache.set(viewer, vcache);
        }

        const cacheKey = `${stripQuery(url)}_rot0`;
        // If already in cache (either from previous preload or manual use), skip
        if (vcache.has(cacheKey)) return;

        try {
          // This is the heavy lifting: pre-creating the WebGL texture
          const tex = await viewer.createTexture(url);
          vcache.set(cacheKey, tex);
        } catch (e) {
          // Silent fail for background preloading
        }
      }),
    );

    current += batchSize;
    if (current < urls.length) {
      // Slight delay between batches to allow for render frames
      setTimeout(loadBatch, 400);
    } else {
      console.log("[Preload] 3D cache priming complete.");
    }
  };

  loadBatch();
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

// Resize canvas to fit wrapper size while maintaining aspect ratio if image exists
function resizeCanvas() {
  const container = document.getElementById("model_body");
  if (!container) {
    console.warn("model_body not found!");
    return;
  }

  const contW = container.clientWidth;
  const contH = container.clientHeight;

  let finalW = contW;
  let finalH = contH;

  // If a pattern is loaded, calculate dimensions to fit while preserving aspect ratio
  if (baseImageObj) {
    const imgAspect = baseImageObj.width / baseImageObj.height;
    const contAspect = contW / contH;

    if (imgAspect > contAspect) {
      // Image is wider than container aspect
      finalW = contW;
      finalH = contW / imgAspect;
    } else {
      // Image is taller than container aspect
      finalH = contH;
      finalW = contH * imgAspect;
    }
  }

  fabricCanvasElem.width = finalW;
  fabricCanvasElem.height = finalH;

  if (canvas) {
    canvas.setWidth(finalW);
    canvas.setHeight(finalH);

    // Update base image scaling and position to match new canvas size
    if (baseImageObj) {
      baseImageObj.set({
        scaleX: finalW / baseImageObj.width,
        scaleY: finalH / baseImageObj.height,
        left: finalW / 2,
        top: finalH / 2,
      });
    }

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

  // Choose the background pattern: If edited before, use the original library pattern
  const modelName = mainViewer.alt || "";
  let editUrl = null;

  if (state.isEdited) {
    editUrl = isRectangleModel(modelName)
      ? state.lastLibraryPatternUrlTop || state.lastLibraryPatternUrl
      : state.lastLibraryPatternUrl;
  } else {
    editUrl = isRectangleModel(modelName)
      ? state.patternUrlTop || state.patternUrl
      : state.patternUrl;
  }

  if (editUrl) {
    previewLoader.style.display = "block"; // show loader before base image loads

    fabric.Image.fromURL(
      editUrl + "?t=" + Date.now(),
      (img) => {
        baseImageObj = img;

        // Set non-geometric properties first
        img.set({
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        });

        // Trigger resize with the now-known image properties
        resizeCanvas();

        canvas.setBackgroundImage(img, () => {
          // RESTORE LOGO IF IT EXISTS (Prioritize saved state over session logo)
          if (state.lastLogoState && state.logoDataUrl) {
            fabric.Image.fromURL(
              state.logoDataUrl,
              (logoImg) => {
                logoImageObj = logoImg;

                // Calculate absolute values from proportional factors
                const finalScale =
                  state.lastLogoState.scaleFactor * canvas.width;
                const finalLeft = state.lastLogoState.leftFactor * canvas.width;
                const finalTop = state.lastLogoState.topFactor * canvas.height;

                logoImg.set({
                  left: finalLeft,
                  top: finalTop,
                  scaleX: finalScale,
                  scaleY: finalScale,
                  angle: state.lastLogoState.angle,
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
                canvas.add(logoImg);
                canvas.setActiveObject(logoImg);
                canvas.renderAll();
              },
              { crossOrigin: "anonymous" },
            );
          } else if (state.logoDataUrl) {
            // First time editing with a logo already uploaded
            addLogoToCanvas(state.logoDataUrl);
          }

          canvas.renderAll();
          previewLoader.style.display = "none";
        });
      },
      { crossOrigin: "anonymous" },
    );
  } else {
    resizeCanvas(); // Fallback for no pattern
    previewLoader.style.display = "none";
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

  // NOTE: do not clear logoDataUrl here, we want it to potentially persist or be restored via lastLogoState

  // Hide baked-in logo while editing
  toggleLogoVisibility(true);
  state.isWithoutLogoModel = true;

  if (modal) modal.classList.add("show");

  previewLoader.style.display = "block"; // show loader immediately

  initFabricCanvas();
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

    // Restore original logo visibility
    toggleLogoVisibility(state.hideLogo);
    state.isWithoutLogoModel = false;

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

  // Save the state of the logo so it can be re-edited later
  // Save the state of the logo relative to canvas size
  if (logoImageObj) {
    state.lastLogoState = {
      leftFactor: logoImageObj.left / canvas.width,
      topFactor: logoImageObj.top / canvas.height,
      scaleFactor: logoImageObj.scaleX / canvas.width,
      angle: logoImageObj.angle,
    };
  } else {
    state.lastLogoState = null;
  }

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
  // Modal and UI cleanup
  modal.classList.remove("show");
  if (logoImageObj) {
    canvas.remove(logoImageObj);
    logoImageObj = null;
  }
});

/********** INIT **********/
document.addEventListener("DOMContentLoaded", async () => {
  const preloader = document.getElementById("preloader");
  const video = document.getElementById("preloaderVideo");
  if (preloader) preloader.style.display = "flex";

  // 📹 VIDEO COMPLETION PROMISE: Ensure we see the animation at least once
  const videoCyclePromise = new Promise((resolve) => {
    if (!video) {
      resolve();
      return;
    }
    const checkEnd = () => {
      if (video.duration > 0 && video.currentTime >= video.duration - 0.2) {
        video.removeEventListener("timeupdate", checkEnd);
        resolve();
      }
    };
    video.addEventListener("timeupdate", checkEnd);
    setTimeout(resolve, 8000); // fallback
  });

  const saved = localStorage.getItem("selectedColors");
  if (saved) {
    state.selectedColors = JSON.parse(saved);
  } else {
    // Keep empty to let shape-based defaults apply on first load
    state.selectedColors = {};
  }

  // ✅ Wait for thumbnails and categories to load
  state.allPatterns = await initCategoryAccordion();
  await initModelAccordion();

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

  // Zoom & Reset Logic
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const resetViewBtn = document.getElementById("resetViewBtn");

  const getViewer = () => document.getElementById("mainViewer");

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      const viewer = getViewer();
      if (!viewer) return;

      // Use FOV for smoother "optical" zoom that doesn't jump position
      let currentFOV = parseFloat(viewer.fieldOfView);
      if (isNaN(currentFOV)) currentFOV = 30; // Default fallback for 'auto'

      const newFOV = Math.max(5, currentFOV * 0.8);
      viewer.fieldOfView = `${newFOV}deg`;
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      const viewer = getViewer();
      if (!viewer) return;

      let currentFOV = parseFloat(viewer.fieldOfView);
      if (isNaN(currentFOV)) currentFOV = 30;

      const newFOV = Math.min(60, currentFOV * 1.2);
      viewer.fieldOfView = `${newFOV}deg`;
    });
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", () => {
      const viewer = getViewer();
      if (!viewer) return;

      const thumb = state.thumbnails[state.selectedIndex];
      if (thumb && thumb.cameraOrbit) {
        viewer.cameraOrbit = thumb.cameraOrbit;
      } else {
        viewer.cameraOrbit = "0deg 75deg auto";
      }
      viewer.fieldOfView = "auto";
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

  // ✅ Preload ALL patterns (across all models/shapes) for instant switching
  if (state.rawPatterns && state.rawPatterns.length > 0) {
    const allUrls = [];
    state.rawPatterns.forEach((p) => {
      if (p.pattern_url) allUrls.push(resolvePatternUrl(p.pattern_url));
      if (p.pattern_url_top) allUrls.push(resolvePatternUrl(p.pattern_url_top));
    });
    const uniqueUrls = [...new Set(allUrls)];
    preloadImages(uniqueUrls);

    if (
      autoApplyToggle &&
      autoApplyToggle.checked &&
      state.allPatterns.length > 0
    ) {
      startPatternCycle(state.allPatterns, 2000);
    }
  }

  // ✅ Wait for at least one video cycle
  await videoCyclePromise;

  // ✅ Hide preloader
  if (preloader) {
    preloader.classList.add("fade-out");
    setTimeout(() => {
      preloader.style.display = "none";
    }, 800);
  }
});

function toggleLogoVisibility(hide) {
  const viewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );
  viewers.forEach((viewer) => {
    if (!viewer || !viewer.model) return;

    // Target the specific logo material only
    const logoMaterials = viewer.model.materials.filter(
      (m) => m.name.toLowerCase() === LOGO_MATERIAL_NAME.toLowerCase(),
    );

    logoMaterials.forEach((logoMat) => {
      // Always ensure the default glb logo is double sided to fix rotation culling bug
      logoMat.doubleSided = true;

      // Use MASK mode to avoid z-fighting with transparent tub
      logoMat.setAlphaMode("MASK");
      logoMat.setAlphaCutoff(0.5);

      const currentColor = logoMat.pbrMetallicRoughness.baseColorFactor;
      if (hide) {
        // Transparent
        logoMat.pbrMetallicRoughness.setBaseColorFactor([
          currentColor[0],
          currentColor[1],
          currentColor[2],
          0,
        ]);
      } else {
        // Show Logo
        // If it's a built-in logo (no custom URL) or a custom logo, we must ensure it is visible
        logoMat.pbrMetallicRoughness.setBaseColorFactor([
          currentColor[0],
          currentColor[1],
          currentColor[2],
          1,
        ]);
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

/********** FULL VIEW PATTERN MODAL **********/
let fullViewImages = [];
let fullViewCurrentIndex = 0;

function openPatternFullView(bottomUrl, topUrl) {
  fullViewImages = [];
  if (topUrl && bottomUrl) {
    fullViewImages = [topUrl, bottomUrl]; // index 0 top (lid), index 1 bottom (tub)
  } else if (topUrl) {
    fullViewImages = [topUrl];
  } else if (bottomUrl) {
    fullViewImages = [bottomUrl];
  }

  if (fullViewImages.length === 0) return;

  const selectedModel = state.thumbnails[state.selectedIndex];
  const isSweetBox = selectedModel && selectedModel.shape === "Sweet Box";
  const isSweetBoxTE =
    selectedModel && selectedModel.shape === "Sweet Box Tamper Evident";

  const singleContainer = document.getElementById("fullViewSingle");
  const dualContainer = document.getElementById("fullViewDual");
  const verticalContainer = document.getElementById("fullViewVertical");

  if (isSweetBoxTE && topUrl && bottomUrl) {
    // Show Dual Side-by-Side View
    if (singleContainer) singleContainer.style.display = "none";
    if (verticalContainer) verticalContainer.style.display = "none";
    if (dualContainer) {
      dualContainer.style.display = "flex";
      const imgLid = document.getElementById("fullViewImageLid");
      const imgTub = document.getElementById("fullViewImageTub");
      if (imgLid) imgLid.src = topUrl;
      if (imgTub) imgTub.src = bottomUrl;
    }
  } else if (isSweetBox && topUrl && bottomUrl) {
    // Show Dual Vertical View (60/30)
    if (singleContainer) singleContainer.style.display = "none";
    if (dualContainer) dualContainer.style.display = "none";
    if (verticalContainer) {
      verticalContainer.style.display = "flex";
      const imgLidVer = document.getElementById("fullViewImageLidVertical");
      const imgTubVer = document.getElementById("fullViewImageTubVertical");
      if (imgLidVer) imgLidVer.src = topUrl;
      if (imgTubVer) imgTubVer.src = bottomUrl;
    }
  } else {
    // Show Single View (Standard)
    if (dualContainer) dualContainer.style.display = "none";
    if (verticalContainer) verticalContainer.style.display = "none";
    if (singleContainer) {
      singleContainer.style.display = "flex";
      fullViewCurrentIndex = 0;
      updateFullViewModal();
    }
  }

  const modal = document.getElementById("fullViewModal");
  if (modal) {
    modal.classList.add("show");
    modal.style.display = "flex";
  }
}

function updateFullViewModal() {
  const img = document.getElementById("fullViewImage");
  const nextBtn = document.getElementById("fullViewNextBtn");

  if (img) {
    img.src = fullViewImages[fullViewCurrentIndex];
  }

  if (nextBtn) {
    if (fullViewImages.length > 1) {
      nextBtn.style.display = "block";
      nextBtn.textContent =
        fullViewCurrentIndex === 0 ? "Show Tub Image" : "Show Lid Image";
      nextBtn.onclick = () => {
        fullViewCurrentIndex =
          (fullViewCurrentIndex + 1) % fullViewImages.length;
        updateFullViewModal();
      };
    } else {
      nextBtn.style.display = "none";
    }
  }
}

// Close full view modal
const closeFullViewBtn = document.getElementById("closeFullViewModal");
if (closeFullViewBtn) {
  closeFullViewBtn.addEventListener("click", () => {
    const modal = document.getElementById("fullViewModal");
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  });
}
