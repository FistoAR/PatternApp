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

/********** AVAILABLE OPTIONS **********/
const options = {
  lid: ["White", "Transparency"],
  tub: ["White", "Transparency", "Black"],
};

/********** PART MATERIAL NAMES **********/
const PART_MATERIALS = {
  lid: ["Top", "Top1_1"], // adjust based on console logs
  tub: ["Bottom1", "Bottom_1"], // can hold multiple names
};

/********** UPDATE MATERIAL COLOR **********/
function updateMaterialColor(part, color, { skipWait = false } = {}) {
  const viewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );

  const factors = {
    white: [1, 1, 1, 1],
    black: [0, 0, 0, 1],
    transparency: [1, 1, 1, 0.3],
  };

  let factor = factors[color.toLowerCase()];

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
      materialNames.forEach((name) => {
        const mat = viewer.model?.materials.find((m) => m.name === name);
        if (!mat) return;

        if (mat.pbrMetallicRoughness.baseColorTexture) {
          mat.pbrMetallicRoughness.baseColorTexture.setTexture(null);
        }

        mat.pbrMetallicRoughness.setBaseColorFactor(factor);
        mat.setAlphaMode(factor[3] < 1 ? "BLEND" : "OPAQUE");
        mat.doubleSided = true;
      });
    };

    if (!viewer.model && !skipWait) {
      viewer.addEventListener("load", applyToViewer, { once: true });
    } else {
      applyToViewer();
    }
  });

  state.selectedColors[part] = color.toLowerCase();
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
const MODEL_CATEGORIES = {
  Round: [
    {
      name: "120ml Round Container",
      path: "./assets/Model_with_logo/120ml round with logo.glb",
    },
    {
      name: "500ml Round Container",
      path: "./assets/Model_with_logo/500ml Round  with logo.glb",
    },
  ],
  Square: [
    {
      name: "500gms/450ml Container",
      path: "./assets/Model_with_logo/450ml cont with logo.glb",
    },
  ],
  "Sweet Boxes": [
    {
      name: "250gms Sweet Box",
      path: "./assets/Model_with_logo/250gms SB with logo.glb",
    },
  ],
  "TE Sweet Boxes": [
    {
      name: "250gms Sweet BoxTE",
      path: "./assets/Model_with_logo/TE 250 sb with logo.glb",
    },
  ],
};

const Rectangle_MODEL_CATEGORIES = {
  Biryani: [
    {
      name: "500ml Rectangular Container",
      path: "./assets/Model_with_logo/500ml Rect with logo.glb",
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
      name: "500ml Round Container",
      path: "./assets/Model_without_logo/500ml Round  without logo.glb",
    },
  ],
  Square: [
    {
      name: "500gms/450ml Container",
      path: "./assets/Model_without_logo/450ml cont without logo.glb",
    },
  ],
  "Sweet Boxes": [
    {
      name: "250gms Sweet Box",
      path: "./assets/Model_without_logo/250gms SB without logo.glb",
    },
  ],
  "TE Sweet Boxes": [
    {
      name: "250gms Sweet BoxTE",
      path: "./assets/Model_without_logo/TE 250 sb without logo.glb",
    },
  ],
};

const RECTANGLE_MODEL_CATEGORIES_WITHOUT_LOGO = {
  Biryani: [
    {
      name: "500ml Rectangular Container",
      path: "./assets/Model_without_logo/500ml Rect without logo.glb",
    },
  ],
};

const PATTERN_MATERIAL_NAME = "Bottom";
const RECTANGLE_PATTERN_MATERIAL_NAME = "Top_1";
const LOGO_MATERIAL_NAME = "Logo";

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

  const categories = { ...MODEL_CATEGORIES, ...Rectangle_MODEL_CATEGORIES };

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

      state.thumbnails.push({ card, name: model.name, path: model.path });
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
}

function markSelectedThumbnail(index) {
  state.thumbnails.forEach((t, i) =>
    t.card.classList.toggle("selected", i === index),
  );
}

/********** MODEL SELECTION **********/
async function selectModel(index) {
  if (index < 0 || index >= state.thumbnails.length) return;
  state.selectedIndex = index;
  markSelectedThumbnail(index);
  const selectedModel = state.thumbnails[index];
  if (!mainViewer) return;

  mainViewer.src = encodeURI(selectedModel.path + "?" + Date.now());
  mainViewer.alt = selectedModel.name;
  mainModelTitle.textContent = selectedModel.name;

  mainViewer.addEventListener(
    "load",
    async () => {
      try {
        // ✅ Wait for model to be available after 'load' fires
        while (!mainViewer.model) {
          await new Promise((r) => requestAnimationFrame(r));
        }

        // Apply current auto-rotate state smoothly
        const autoRotateToggle = document.getElementById("autoRotateToggle");
        if (autoRotateToggle) {
          updateAutoRotateSmooth(autoRotateToggle.checked, true);
        }

        console.log("Model fully available:", selectedModel.name);
        console.log("logoDataUrl exists?", state.logoDataUrl ? true : false);

        // Material detection
        const isRect = isRectangleModel(selectedModel.name);
        const materialName = isRect
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;

        state.patternMaterialOverride = materialName;

        if (state.patternUrl) {
          await applyPatternToAll(state.patternUrl, {
            forceReload: true,
            materialOverride: materialName,
          });
        }

        if (state.logoDataUrl) {
          const viewers = [mainViewer];
          console.log(
            "Available materials on mainViewer:",
            mainViewer.model?.materials?.map((m) => m.name),
          );

          await Promise.all(
            viewers.map((v) =>
              tryApplyMaterialTexture(
                v,
                LOGO_MATERIAL_NAME,
                state.logoDataUrl,
                { forceReload: true },
              ),
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

// Fetch Patterns by Category with categoryName as a parameter
async function fetchPatternsByCategory(categoryName) {
  if (!categoryName) return [];

  try {
    const formData = new FormData();
    formData.append("category_name", categoryName);
    const res = await fetch(
      "https://terratechpacks.com/App_3D/pattern_url.php",
      { method: "POST", body: formData },
    );
    const json = await res.json();
    // Check if data is valid and return the patterns that match the selected category
    if (json.status === "success" && Array.isArray(json.data)) {
      return json.data.filter(
        (p) => p.category_name.toLowerCase() === categoryName.toLowerCase(),
      );
    }
    return [];
  } catch (err) {
    console.error(
      `Failed to fetch patterns for category: ${categoryName}`,
      err,
    );
    return [];
  }
}

// Initialize Category Accordion with lazy loading
async function initCategoryAccordion() {
  const accordion = document.getElementById("patternAccordion");
  if (!accordion) return;

  const categories = await fetchCategories();
  let allPatterns = [];

  const baseurl = "https://terratechpacks.com/App_3D/";

  for (const cat of categories) {
    const patterns = await fetchPatternsByCategory(cat.category);
    patterns.forEach((p) => {
      const patternUrl = resolvePatternUrl(p.pattern_url);
      allPatterns.push(patternUrl);
    });

    const li = document.createElement("li");

    const header = document.createElement("div");
    header.className = "accordion-header";

    // Fix logo image source and style
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

    li.appendChild(header);
    li.appendChild(content);
    accordion.appendChild(li);

    header.addEventListener("click", async () => {
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

        if (!content.dataset.loaded) {
          content.innerHTML = "";

          // Add loading message
          const loader = document.createElement("div");
          loader.className = "pattern-loader";
          loader.textContent = "Loading...";
          loader.style.fontSize = "0.85vw";
          content.appendChild(loader);

          if (patterns.length) {
            let loadedCount = 0;

            patterns.forEach((p, index) => {
              const patternUrl = resolvePatternUrl(p.pattern_url);
              const img = new Image();
              img.src = patternUrl;

              img.onload = () => {
                const sw = document.createElement("div");
                sw.className = "pattern-swatch";
                sw.style.backgroundImage = `url('${patternUrl}')`;
                sw.title = `${p.category_name} - ${index + 1}`;
                sw.dataset.patternUrl = patternUrl;

                sw.addEventListener("click", async () => {
                  console.log("Pattern selected:", sw.dataset.patternUrl);
                  stopPatternCycle();

                  if (state.isWithoutLogoModel) {
                    const confirmed = confirm(
                      "Selecting a new pattern will remove your custom logo. Proceed?",
                    );
                    if (!confirmed) return;
                  }

                  const selectedUrl = sw.dataset.patternUrl?.split("?")[0];
                  state.patternUrl = selectedUrl;

                  document.querySelectorAll(".pattern-swatch").forEach((el) => {
                    const elUrl = el.dataset.patternUrl?.split("?")[0];
                    el.classList.toggle("selected", elUrl === selectedUrl);
                  });

                  await applyPatternToAll(sw.dataset.patternUrl);

                  if (state.isWithoutLogo) {
                    state.logoDataUrl = null;
                  }
                });

                // Add the swatch before the loader
                content.insertBefore(sw, loader);
                checkIfAllLoaded();
              };

              img.onerror = () => {
                const sw = document.createElement("div");
                sw.className = "pattern-swatch error";
                sw.textContent = "Failed to load";
                content.insertBefore(sw, loader);
                checkIfAllLoaded();
              };

              function checkIfAllLoaded() {
                loadedCount++;
                if (loadedCount === patterns.length) {
                  loader.remove();
                  content.dataset.loaded = "true";
                  content.style.maxHeight = content.scrollHeight + "px";
                  header.querySelector(".drop").className =
                    "fa-solid fa-angle-up drop";
                }
              }
            });

            // Expand right away
            content.style.maxHeight = content.scrollHeight + "px";
            header.querySelector(".drop").className =
              "fa-solid fa-angle-up drop";
          } else {
            content.innerHTML = "";
            const noPattern = document.createElement("div");
            noPattern.textContent = "No patterns available for this category";
            noPattern.style.padding = "0.6vw";
            noPattern.style.fontSize = "0.85vw";
            content.appendChild(noPattern);
            content.dataset.loaded = "true";
            content.style.maxHeight = content.scrollHeight + "px";
            header.querySelector(".drop").className =
              "fa-solid fa-angle-up drop";
          }
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
          header.querySelector(".drop").className = "fa-solid fa-angle-up drop";
        }
      }
    });
  }

  return allPatterns;
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

/********** PATTERN CYCLE (update this part) **********/
function startPatternCycle(patternUrls = [], interval = 2000) {
  stopPatternCycle();
  if (!patternUrls.length) return;

  let idx = 0;
  let lastSelectedEl = null;

  state.patternCycleTimer = setInterval(() => {
    const patternUrl = patternUrls[idx % patternUrls.length];
    if (!patternUrl) {
      idx++;
      return;
    }

    // apply to all viewers in parallel (skip wait)
    const viewers = Array.from(
      new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
    );
    viewers.forEach((viewer) => {
      if (!viewer.model) return;
      const modelName = (viewer.alt || "").toLowerCase();
      const materialName = isRectangleModel(modelName)
        ? RECTANGLE_PATTERN_MATERIAL_NAME
        : PATTERN_MATERIAL_NAME;
      tryApplyMaterialTexture(viewer, materialName, patternUrl, {
        skipWait: true,
      }).catch(() => {});
    });

    // efficient swatch update: only touch the previously selected and the new one
    const cleanUrl = patternUrl.split("?")[0];
    let matched = null;
    document.querySelectorAll(".pattern-swatch").forEach((sw) => {
      if (sw.dataset.patternUrl?.split("?")[0] === cleanUrl) matched = sw;
    });

    if (lastSelectedEl && lastSelectedEl !== matched)
      lastSelectedEl.classList.remove("selected");
    if (matched && !matched.classList.contains("selected"))
      matched.classList.add("selected");
    lastSelectedEl = matched;

    state.patternUrl = cleanUrl;
    idx++;
  }, interval);
}

function stopPatternCycle() {
  if (state.patternCycleTimer) {
    console.log("Stopping pattern cycle");
    clearInterval(state.patternCycleTimer);
    state.patternCycleTimer = null;
  }
}

// Utility: detect rectangle model
function isRectangleModel(name) {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  const keywords = ["rect", "rectangular", "biryani"];
  const result = keywords.some((k) => lower.includes(k));
  console.log(
    `[isRectangleModel] "${name}" => ${result ? "✅ RECT" : "❌ ROUND"}`,
  );
  return result;
}

/********** APPLY PATTERN TO ALL VIEWERS **********/
async function applyPatternToAll(
  patternUrl,
  { forceReload = false, materialOverride = null } = {},
) {
  if (!patternUrl) return;

  const cleanSelectedUrl = patternUrl.split("?")[0];
  state.patternUrl = cleanSelectedUrl;

  // Highlight swatch
  document.querySelectorAll(".pattern-swatch").forEach((sw) => {
    const swatchUrl = sw.dataset.patternUrl?.split("?")[0];
    sw.classList.toggle("selected", swatchUrl === cleanSelectedUrl);
  });

  const viewers = Array.from(
    new Set([...(state.modelViewers || []), mainViewer].filter(Boolean)),
  );

  await Promise.all(
    viewers.map(async (viewer) => {
      if (!viewer.model) {
        await new Promise((resolve) =>
          viewer.addEventListener("load", resolve, { once: true }),
        );
      }

      // Always decide material: use override if provided, else detect rectangle
      let materialName = materialOverride;
      if (!materialName) {
        materialName = isRectangleModel(viewer.alt || "")
          ? RECTANGLE_PATTERN_MATERIAL_NAME
          : PATTERN_MATERIAL_NAME;
      }

      // Clear old texture before applying new
      const mat = viewer.model?.materials.find((m) => m.name === materialName);
      if (mat?.pbrMetallicRoughness.baseColorTexture) {
        mat.pbrMetallicRoughness.baseColorTexture.setTexture(null);
      }

      await tryApplyMaterialTexture(viewer, materialName, patternUrl, {
        skipWait: true,
        forceReload,
      });
    }),
  );
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
  { skipWait = false, forceReload = false } = {},
) {
  if (!viewer || !textureUrl) return;

  // Wait for model to load if necessary
  if (!viewer.model && !skipWait) {
    await new Promise((res) =>
      viewer.addEventListener("load", res, { once: true }),
    );
  }

  // Normalize material names to an array
  const names = Array.isArray(materialNames) ? materialNames : [materialNames];

  // Find the first matching material on the viewer
  const mat = names
    .map((n) => viewer.model?.materials?.find((m) => m.name === n))
    .find(Boolean);

  if (!mat) {
    console.warn(`Materials [${names.join(", ")}] not found on viewer`);
    return;
  }

  // Normalize URLs to avoid repeated application
  const currentUri =
    mat.pbrMetallicRoughness.baseColorTexture?.texture?.source?.uri;
  const normalizedCurrent = currentUri ? stripQuery(currentUri) : null;
  const normalizedNew = stripQuery(textureUrl);

  if (normalizedCurrent === normalizedNew && !forceReload) {
    return; // Texture already applied
  }

  try {
    // Initialize per-viewer cache
    let vcache = viewerTextureCache.get(viewer);
    if (!vcache) {
      vcache = new Map();
      viewerTextureCache.set(viewer, vcache);
    }

    const cacheKey = mat.name + "::" + normalizedNew;
    let tex;

    if (!forceReload && vcache.has(cacheKey)) {
      tex = vcache.get(cacheKey); // Use cached texture
    } else {
      tex = await viewer.createTexture(encodeURI(textureUrl)); // Load new texture
      vcache.set(cacheKey, tex);
    }

    // Apply texture
    mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);

    // Ensure proper transform and wrapping
    if (tex.texture) {
      tex.texture.transform = { offset: [0, 0], scale: [1, 1], rotation: 0 };
      if (
        tex.texture.sampler &&
        typeof tex.texture.sampler.setWrapMode === "function"
      ) {
        tex.texture.sampler.setWrapMode("CLAMP_TO_EDGE");
      }
    }

    // Reset base color to white and opaque
    mat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
    mat.setAlphaMode("BLEND");
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
      viewers.map((v) =>
        tryApplyMaterialTexture(v, LOGO_MATERIAL_NAME, state.logoDataUrl),
      ),
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
  default: "#fbb4ffff",
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
  const savedColor = localStorage.getItem("bgColor") || "#ffffffff";
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

  if (state.patternUrl) {
    previewLoader.style.display = "block"; // show loader before base image loads

    fabric.Image.fromURL(
      state.patternUrl + "?t=" + Date.now(),
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

  // Search in regular without logo categories
  for (const models of Object.values(MODEL_CATEGORIES_WITHOUT_LOGO)) {
    const found = models.find((m) => m.name === selectedModelName);
    if (found) return found.path;
  }

  // Search also inside rectangle without logo categories
  for (const models of Object.values(RECTANGLE_MODEL_CATEGORIES_WITHOUT_LOGO)) {
    const found = models.find((m) => m.name === selectedModelName);
    if (found) return found.path;
  }

  return null;
}

// Open modal and initialize everything
editBtn.addEventListener("click", () => {
  if (state.patternCycleTimer) {
    alert("Please select the pattern before editing.");
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

    // Function to find WITH logo path by name in categories
    function getWithLogoModelPathByName(name) {
      // Search in regular model categories
      for (const models of Object.values(MODEL_CATEGORIES)) {
        const found = models.find((m) => m.name === name);
        if (found) return found.path;
      }
      // Search in rectangle model categories
      for (const models of Object.values(Rectangle_MODEL_CATEGORIES)) {
        const found = models.find((m) => m.name === name);
        if (found) return found.path;
      }
      return null;
    }

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
        if (state.patternUrl) {
          const isRect = isRectangleModel(mainViewer.alt || "");
          const matName = isRect
            ? RECTANGLE_PATTERN_MATERIAL_NAME
            : PATTERN_MATERIAL_NAME;

          await tryApplyMaterialTexture(mainViewer, matName, state.patternUrl, {
            forceReload: true,
          });
        }

        if (state.logoDataUrl) {
          await tryApplyMaterialTexture(
            mainViewer,
            LOGO_MATERIAL_NAME,
            state.logoDataUrl,
          );
        }
        Object.entries(state.selectedColors).forEach(([part, color]) => {
          updateMaterialColor(part, color, { skipWait: true });
        });

        state.isWithoutLogoModel = false; // reset flag after restoring
      },
      { once: true },
    );

    mainViewer.src = encoded;

    if (canvas) {
      // Remove logo if present
      if (logoImageObj) {
        canvas.remove(logoImageObj);
        logoImageObj = null;
      }
      canvas.dispose();
      canvas = null;
      baseImageObj = null;
    }

    // Clear state
    state.logoDataUrl = null;

    // Optionally clear file input
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

  // Helper to apply pattern based on model type (rectangle vs round)
  async function applyPatternBasedOnModelType(viewer, textureUrl) {
    if (!viewer || !textureUrl) return;

    const modelName = viewer.alt || "";
    const isRect = isRectangleModel(modelName);

    if (isRect) {
      await tryApplyMaterialTexture(
        viewer,
        RECTANGLE_PATTERN_MATERIAL_NAME,
        textureUrl,
      ); // Apply on "Top_1"
    } else {
      await tryApplyMaterialTexture(viewer, PATTERN_MATERIAL_NAME, textureUrl); // Apply on "Bottom"
    }
  }

  // Apply pattern/logo texture to mainViewer conditionally
  await applyPatternBasedOnModelType(mainViewer, dataUrl);

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
    state.selectedColors = { lid: "white", tub: "white" };
  }

  // ✅ Wait for thumbnails and categories to load
  await initModelAccordion();
  const allPatterns = await initCategoryAccordion(); // must return all patterns!

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

  // ✅ Restore saved colors
  Object.keys(state.selectedColors).forEach((part) => {
    const savedColor =
      state.selectedColors[part] || options[part][0].toLowerCase();
    updateMaterialColor(part, savedColor);
  });

  // ✅ Preload and cycle patterns (after loading categories)
  if (allPatterns && allPatterns.length > 0) {
    preloadImages(allPatterns);
    startPatternCycle(allPatterns, 2000);
  }

  // ✅ Hide preloader
  if (preloader) {
    preloader.classList.add("fade-out");
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500); // Optional fade-out
  }
});
