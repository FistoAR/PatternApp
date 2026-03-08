window.addEventListener("DOMContentLoaded", () => {
  const renderedImages = document.getElementById("renderedImages");
  const modelViewer = document.getElementById("modelViewer");
  const textureTitle = document.getElementById("textureTitle");
  const textureFile = document.getElementById("textureFile");
  const topColor = document.getElementById("topColor");
  const tubColor = document.getElementById("tubColor");
  const bgColor = document.getElementById("bgColor");
  const modelbg = document.getElementById("modelview");
  const renderBtn = document.getElementById("renderBtn");
  const exportBtn = document.getElementById("export_btn");
  const customLogoInput = document.getElementById("customLogoInput");
  const customLogoPreview = document.getElementById("customLogoPreview");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const scrollLeftBtn = document.getElementById("scrollLeftBtn");
  const scrollRightBtn = document.getElementById("scrollRightBtn");

  // Transparency Checkboxes
  const tubTransparent = document.getElementById("tubTransparent");
  const lidTransparent = document.getElementById("lidTransparent");

  // Dual Texture Upload Elements
  const lidTextureFile = document.getElementById("lidTextureFile");
  const lidFileName = document.getElementById("lidFileName");
  const fileName = document.getElementById("fileName");
  const tubTextureGroup = document.getElementById("tubTextureGroup");
  const lidTextureGroup = document.getElementById("lidTextureGroup");
  const textureLabel = document.getElementById("textureLabel");

  function toggleClearButtonState() {
    if (!clearAllBtn) return;
    if (renderedModels.length === 0) {
      clearAllBtn.disabled = true;
      clearAllBtn.style.opacity = "0.5";
    } else {
      clearAllBtn.disabled = false;
      clearAllBtn.style.opacity = "1";
    }
  }

  // Horizontal Scroll Button Listeners
  if (scrollLeftBtn && scrollRightBtn && renderedImages) {
    scrollLeftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderedImages.scrollLeft -= 120;
    });

    scrollRightBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderedImages.scrollLeft += 120;
    });

    renderedImages.addEventListener("scroll", updateScrollButtons, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollButtons);
  }

  const modelSrc = "./assets/model.glb";
  const TubColorMaterials = ["tub", "Tub", "bottom"];
  const LidColorMaterials = ["lid", "Lid", "top"];
  const TubTextureMaterials = ["tub_label", "bottom_label"];
  const LidTextureMaterials = ["lid_label", "top_label"];
  const viewerTextureCache = new WeakMap();
  let renderedModels = [];
  let cardCounter = 1;

  // Scroll rotation variables
  // let baseRotationY = -540.9;
  // let currentScrollRotation = 0;
  let isScrolling = false;
  let scrollTimeout;

  // --- Shape-Specific Camera Configs ---
  // Zoom levels - updated dynamically in updateMainViewer
  let zoomLevels = [0.45, 0.35];
  let currentZoomIndex = 0;
  let currentZoom = 0.45;
  let originalBottomTexture = null;
  let currentTubTextureDataURL = null;
  let currentLidTextureDataURL = null;
  let lidColorManualSet = false;
  let tubColorManualSet = false;
  const originalMaterialsCache = new Map(); // Store original material properties for reset

  async function syncViewerState(viewer) {
    if (!viewer || !viewer.model) return;

    // Sync pickers with model defaults on first load (if not manually set)
    const firstLid = viewer.model.materials.find((m) =>
      LidColorMaterials.includes(m.name),
    );
    const firstTub = viewer.model.materials.find((m) =>
      TubColorMaterials.includes(m.name),
    );

    if (firstLid && !lidColorManualSet) {
      const c = firstLid.pbrMetallicRoughness.baseColorFactor;
      topColor.value = rgbToHex(c[0], c[1], c[2]);
    }
    if (firstTub && !tubColorManualSet) {
      const c = firstTub.pbrMetallicRoughness.baseColorFactor;
      tubColor.value = rgbToHex(c[0], c[1], c[2]);
    }

    // 1. Apply Lid State
    updatePartTransparency(
      viewer,
      "lid",
      lidTransparent.checked,
      lidColorManualSet ? topColor.value : null,
    );

    // 2. Apply Tub State
    updatePartTransparency(
      viewer,
      "tub",
      tubTransparent.checked,
      tubColorManualSet ? tubColor.value : null,
    );

    // 3. Apply Tub Texture (if any)
    if (currentTubTextureDataURL) {
      await tryApplyMaterialTexture(
        viewer,
        TubTextureMaterials,
        currentTubTextureDataURL,
      );
    }

    // 4. Apply Lid Texture (if any)
    if (currentLidTextureDataURL) {
      await tryApplyMaterialTexture(
        viewer,
        LidTextureMaterials,
        currentLidTextureDataURL,
      );
    }
  }

  modelViewer.addEventListener("load", () => {
    syncViewerState(modelViewer);
  });

  // --- Scroll to rotate functionality ---
  // function updateModelRotation(rotationY) {
  //   modelViewer.setAttribute("camera-orbit", `${rotationY}deg 84.49deg 0.7649m`);
  // }

  function handleScroll(event) {
    event.preventDefault();

    const zoomSensitivity = 0.0005;
    const zoomDelta = event.deltaY * zoomSensitivity;

    // Define min and max zoom
    const minDistance = 0.35; // max zoom in
    const maxDistance = 0.45; // Lock zoom out at a tighter perspective to keep model large

    // Update zoom distance
    currentZoom += zoomDelta;
    currentZoom = Math.max(minDistance, Math.min(maxDistance, currentZoom));

    // Get current rotation angles from the viewer
    const currentOrbit = modelViewer.getAttribute("camera-orbit").split(" ");

    // Update camera with new zoom, keeping current rotation
    modelViewer.setAttribute(
      "camera-orbit",
      `${currentOrbit[0]} ${currentOrbit[1]} ${currentZoom}m`,
    );

    if (!isScrolling) {
      isScrolling = true;
      document.body.style.cursor = "grabbing";
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      document.body.style.cursor = "default";
    }, 150);
  }

  // modelViewer.addEventListener("wheel", handleScroll, { passive: false });
  // renderedImages.addEventListener("wheel", handleScroll, { passive: false });

  // // Touch/drag support for mobile
  // let isDragging = false;
  // let lastTouchX = 0;

  // function handleTouchStart(event) {
  //   isDragging = true;
  //   lastTouchX = event.touches[0].clientX;
  //   document.body.style.cursor = "grabbing";
  // }

  // function handleTouchMove(event) {
  //   if (!isDragging) return;
  //   event.preventDefault();

  //   const currentTouchX = event.touches[0].clientX;
  //   const deltaX = currentTouchX - lastTouchX;
  //   lastTouchX = currentTouchX;

  //   const touchSensitivity = 0.3;
  //   const rotationDelta = deltaX * touchSensitivity;

  //   // currentScrollRotation += rotationDelta;
  //   // const finalRotationY = baseRotationY + currentScrollRotation;

  //   // updateModelRotation(finalRotationY);
  // }

  // function handleTouchEnd() {
  //   isDragging = false;
  //   document.body.style.cursor = "default";
  // }

  // modelViewer.addEventListener("touchstart", handleTouchStart, { passive: false });
  // modelViewer.addEventListener("touchmove", handleTouchMove, { passive: false });
  // modelViewer.addEventListener("touchend", handleTouchEnd);

  // renderedImages.addEventListener("touchstart", handleTouchStart, { passive: false });
  // renderedImages.addEventListener("touchmove", handleTouchMove, { passive: false });
  // renderedImages.addEventListener("touchend", handleTouchEnd);

  // Keyboard controls for rotation
  // document.addEventListener("keydown", (event) => {
  //   if (event.target.tagName === "INPUT") return;

  //   let rotationStep = 0;
  //   switch (event.key) {
  //     case "ArrowLeft":
  //       rotationStep = -10;
  //       break;
  //     case "ArrowRight":
  //       rotationStep = 10;
  //       break;
  //     case "r":
  //     case "R":
  //       // currentScrollRotation = 0;
  //       // updateModelRotation(baseRotationY);
  //       return;
  //   }

  //   if (rotationStep !== 0) {
  //     event.preventDefault();
  //     // currentScrollRotation += rotationStep;
  //     // const finalRotationY = baseRotationY + currentScrollRotation;
  //     // updateModelRotation(finalRotationY);
  //   }
  // });

  // --- Utilities ---
  function truncateFileName(name) {
    if (!name) return "No file chosen";
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return name.length > 7 ? name.substring(0, 7) + "...." : name;
    }
    const extension = name.substring(lastDotIndex + 1);
    const fileNameWithoutExtension = name.substring(0, lastDotIndex);
    if (fileNameWithoutExtension.length > 7) {
      return fileNameWithoutExtension.substring(0, 7) + "...." + extension;
    }
    return name;
  }

  function stripQuery(url) {
    try {
      return (
        new URL(url, location.href).origin +
        new URL(url, location.href).pathname
      );
    } catch {
      return url;
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : null;
  }

  function hexToRgbArray(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? [rgb.r, rgb.g, rgb.b] : [1, 1, 1];
  }

  function rgbToHex(r, g, b) {
    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  // --- Enhanced texture and color application ---
 async function tryApplyMaterialTexture(
    viewer,
    materialNames,
    textureUrl,
    topMaterialColor = null,
    tubMaterialColor = null,
  ) {
    console.log(`Checking model viewer before`);
    if (!viewer || !textureUrl) return;
    console.log(`Checking model viewer after`);
    if (!viewer.model) {
      await new Promise((res) =>
        viewer.addEventListener("load", res, { once: true }),
      );
    }
 
    const names = Array.isArray(materialNames)
      ? materialNames
      : [materialNames];
 
    console.log(`Names: ${names}`);
    // Process main materials (typically for textures)
    const targetMaterials =
      viewer.model?.materials?.filter(m =>
  names.some(n => m.name.toLowerCase().includes(n.toLowerCase()))
) || [];
 
    console.log(`Target materials: ${targetMaterials}`);
 
    for (const mat of targetMaterials) {
      console.log(`Mat: ${JSON.stringify(mat, 2, null)}`);
      try {
        let vcache = viewerTextureCache.get(viewer) || new Map();
        viewerTextureCache.set(viewer, vcache);
 
        const cacheKey = mat.name + "::" + stripQuery(textureUrl);
        let tex =
          vcache.get(cacheKey) ||
          (await viewer.createTexture(encodeURI(textureUrl)));
        vcache.set(cacheKey, tex);
 
        if (mat.pbrMetallicRoughness.baseColorTexture) {
          mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
          // Always reset color factor to white for stickers/labels to ensure original texture color
          mat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
          console.info('Applied texture to: ' + mat);
        } else {
          console.warn(
            `Material ${mat.name} does not have a baseColorTexture slot and no tint fallback provided.`,
          );
        }
      } catch (err) {
        console.error("Failed to apply texture:", err);
      }
    }
 
    // Colors are now handled externally via syncViewerState or updatePartTransparency
  }

  // --- Transparency Logic ---
  function updatePartTransparency(
    viewer,
    part,
    isTransparent,
    colorHex = null,
  ) {
    if (!viewer || !viewer.model) return;

    const names = part === "tub" ? TubColorMaterials : LidColorMaterials;
    const targetMaterials =
      viewer.model?.materials?.filter((m) => names.includes(m.name)) || [];

    targetMaterials.forEach((mat) => {
      try {
        // Cache original properties if not already cached
        if (!originalMaterialsCache.has(mat)) {
          originalMaterialsCache.set(mat, {
            baseColorFactor: [...mat.pbrMetallicRoughness.baseColorFactor],
            emissiveFactor: [...mat.emissiveFactor],
            metallicFactor: mat.pbrMetallicRoughness.metallicFactor,
            roughnessFactor: mat.pbrMetallicRoughness.roughnessFactor,
            alphaMode: mat.alphaMode,
          });
        }

        const defaults = originalMaterialsCache.get(mat);

        if (isTransparent) {
          // Applying Color + Transparency (Stacking)
          let colorArray;
          if (colorHex) {
            // Use manual color
            colorArray = hexToRgbArray(colorHex);
          } else {
            // Use GLB default color (existing color)
            colorArray = [
              defaults.baseColorFactor[0],
              defaults.baseColorFactor[1],
              defaults.baseColorFactor[2],
            ];
          }

          mat.pbrMetallicRoughness.setBaseColorFactor([...colorArray, 0.36]);
          mat.setEmissiveFactor([
            colorArray[0] * 0.4,
            colorArray[1] * 0.4,
            colorArray[2] * 0.4,
          ]);
          mat.pbrMetallicRoughness.setMetallicFactor(0.8);
          mat.pbrMetallicRoughness.setRoughnessFactor(0.18);
          mat.setAlphaMode("BLEND");
        } else if (colorHex) {
          // Applying Manual Opaque Color
          const colorArray = hexToRgbArray(colorHex);
          mat.pbrMetallicRoughness.setBaseColorFactor([...colorArray, 1]);
          mat.setEmissiveFactor([0, 0, 0]);

          if (colorHex.toLowerCase() === "#ffffff") {
            mat.pbrMetallicRoughness.setMetallicFactor(1.0);
            mat.pbrMetallicRoughness.setRoughnessFactor(0.53);
          } else {
            mat.pbrMetallicRoughness.setMetallicFactor(0.0);
            mat.pbrMetallicRoughness.setRoughnessFactor(1.0);
          }
          mat.setAlphaMode("OPAQUE");
        } else {
          // RESET: Back to original GLB defaults
          mat.pbrMetallicRoughness.setBaseColorFactor(defaults.baseColorFactor);
          mat.setEmissiveFactor(defaults.emissiveFactor);
          mat.pbrMetallicRoughness.setMetallicFactor(defaults.metallicFactor);
          mat.pbrMetallicRoughness.setRoughnessFactor(defaults.roughnessFactor);
          mat.setAlphaMode(defaults.alphaMode);
        }
        mat.doubleSided = true;
      } catch (err) {
        console.error(`Failed to apply transparency/color to ${part}:`, err);
      }
    });
  }

  topColor.addEventListener("input", () => {
    lidColorManualSet = true;
    syncViewerState(modelViewer);
  });

  tubColor.addEventListener("input", () => {
    tubColorManualSet = true;
    syncViewerState(modelViewer);
  });

  // Adding transparency change to manual set to ensure it reapplies correctly
  lidTransparent.addEventListener("change", () => {
    syncViewerState(modelViewer);
  });

  tubTransparent.addEventListener("change", () => {
    syncViewerState(modelViewer);
  });

  bgColor.addEventListener("input", () => {
    modelbg.style.backgroundColor = bgColor.value;
  });

  function checkFormValidity() {
    const fileWrapper = textureFile.closest(".file-upload-wrapper");
    const lidFileWrapper = lidTextureFile.closest(".file-upload-wrapper");
    const hasTitle = textureTitle.value.trim().length > 0;
    const hasFile = textureFile.files.length > 0;

    const isTubVisible = tubTextureGroup.style.display !== "none";
    const isLidVisible = lidTextureGroup.style.display !== "none";
    const hasLidFile = lidTextureFile.files.length > 0;

    // Highlight Title
    if (hasTitle) {
      textureTitle.classList.remove("error-highlight");
      textureTitle.classList.add("valid-highlight");
    } else {
      textureTitle.classList.remove("valid-highlight", "error-highlight");
    }

    // Highlight File
    if (hasFile) {
      fileWrapper.classList.remove("error-highlight");
      fileWrapper.classList.add("valid-highlight");
    } else {
      fileWrapper.classList.remove("valid-highlight", "error-highlight");
    }

    // Highlight Lid File (if visible)
    if (isLidVisible) {
      if (hasLidFile) {
        lidFileWrapper.classList.remove("error-highlight");
        lidFileWrapper.classList.add("valid-highlight");
      } else {
        lidFileWrapper.classList.remove("valid-highlight", "error-highlight");
      }
    } else {
      lidFileWrapper.classList.remove("error-highlight", "valid-highlight");
    }

    // Reset Tub highlight if not visible
    if (!isTubVisible) {
      fileWrapper.classList.remove("error-highlight", "valid-highlight");
    }

    renderBtn.disabled = false; // Keep it enabled for manual trigger
  }

  // Update main model viewer
  async function updateMainModelViewer() {
    const tubFile = textureFile.files[0];
    const lidFile = lidTextureFile.files[0];
    const isTubVisible = tubTextureGroup.style.display !== "none";
    const isLidVisible = lidTextureGroup.style.display !== "none";

    // Only return if at least one file is required but neither is provided
    if (isTubVisible && isLidVisible && !tubFile && !lidFile) return;
    if (isTubVisible && !isLidVisible && !tubFile) return;
    if (isLidVisible && !isTubVisible && !lidFile) return;

    const topMaterialColor = topColor.value;

    if (tubFile) {
      const tubReader = new FileReader();
      tubReader.onload = async (event) => {
        currentTubTextureDataURL = event.target.result;
        await syncViewerState(modelViewer);
      };
      tubReader.readAsDataURL(tubFile);
    }

    if (isLidVisible && lidFile) {
      const lidReader = new FileReader();
      lidReader.onload = async (event) => {
        currentLidTextureDataURL = event.target.result;
        await syncViewerState(modelViewer);
      };
      lidReader.readAsDataURL(lidFile);
    }
  }

  function createRenderedCard(
    tubTextureDataURL,
    title,
    topMaterialColor,
    modelSrcForCard,
    snapshotDataURL = null,
    backgroundColor = "#ffffff",
    lidTextureDataURL = null,
    cameraOrbit = null,
    fieldOfView = null,
    tubMaterialColor = null,
    isTubTransparent = false,
    isLidTransparent = false,
  ) {
    const card = document.createElement("div");
    card.className = "rendered-card";
    card.dataset.id = cardCounter++;
    card.dataset.textureDataUrl = tubTextureDataURL;
    card.dataset.lidTextureDataUrl = lidTextureDataURL || "";
    card.dataset.title = title;
    card.dataset.topMaterialColor = topMaterialColor;
    card.dataset.tubMaterialColor = tubMaterialColor || "#ffffff";
    card.dataset.modelSrc = modelSrcForCard;
    card.dataset.backgroundColor = backgroundColor;
    card.dataset.cameraOrbit = cameraOrbit || "";
    card.dataset.fieldOfView = fieldOfView || "";
    card.dataset.selectedLogo = ""; // Store selected logo for this card
    card.dataset.isTubTransparent = isTubTransparent ? "true" : "false";
    card.dataset.isLidTransparent = isLidTransparent ? "true" : "false";
    if (snapshotDataURL) {
      card.dataset.snapshot = snapshotDataURL;
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      removeRenderedCard(card);
    };

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "selection-checkbox";
    checkbox.checked = true;
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleCardSelection(card, checkbox.checked);
    };

    const optionTheme = document.createElement("div");
    optionTheme.className = "option-theme";
    optionTheme.textContent = `Option - ${card.dataset.id}   Theme - ${title}`;

    const logoSelectionDiv = document.createElement("div");
    logoSelectionDiv.className = "card-logo-selection";
    logoSelectionDiv.innerHTML = `
    <div class="card-logo-options">
      <img src="./assets/Logo/terratechpacks.png" data-logo="./assets/Logo/terratechpacks.png" 
           class="card-selectable-logo" />
      <img src="./assets/Logo/terratechpacks_white.png" data-logo="./assets/Logo/terratechpacks_white.png" 
           class="card-selectable-logo" />
      <img src="./assets/Logo/white.png" data-logo="./assets/Logo/white.png" 
           class="card-selectable-logo" />
    </div>
  `;

    // Use snapshot image if available
    if (snapshotDataURL) {
      const snapshotImg = document.createElement("img");
      snapshotImg.src = snapshotDataURL;
      snapshotImg.alt = title;
      snapshotImg.className = "snapshot-img";

      card.appendChild(deleteBtn);
      card.appendChild(checkbox);
      card.appendChild(optionTheme);
      card.appendChild(snapshotImg);
      card.appendChild(logoSelectionDiv);
    } else {
      // Fallback to model-viewer if snapshot failed
      const cardModelViewer = document.createElement("model-viewer");
      cardModelViewer.src = modelSrcForCard || modelSrc;
      cardModelViewer.setAttribute("camera-controls", "");
      cardModelViewer.setAttribute("exposure", "1");
      cardModelViewer.setAttribute("shadow-intensity", "0.5");
      cardModelViewer.setAttribute("disable-tap", "");
      cardModelViewer.setAttribute("disable-pan", "");
      cardModelViewer.setAttribute("interaction-prompt", "none");
      cardModelViewer.setAttribute("field-of-view", "33deg");
      cardModelViewer.style.width = "100%";
      cardModelViewer.style.height = "8vw";
      cardModelViewer.style.pointerEvents = "none";

      cardModelViewer.addEventListener("load", async () => {
        // Apply plastic colors first
        updatePartTransparency(
          cardModelViewer,
          "lid",
          isLidTransparent,
          topMaterialColor,
        );
        updatePartTransparency(
          cardModelViewer,
          "tub",
          isTubTransparent,
          tubMaterialColor,
        );

        if (tubTextureDataURL) {
          await tryApplyMaterialTexture(
            cardModelViewer,
            TubTextureMaterials,
            tubTextureDataURL,
          );
        }
        if (lidTextureDataURL) {
          await tryApplyMaterialTexture(
            cardModelViewer,
            LidTextureMaterials,
            lidTextureDataURL,
          );
        }
      });

      card.appendChild(deleteBtn);
      card.appendChild(checkbox);
      card.appendChild(optionTheme);
      card.appendChild(cardModelViewer);
      card.appendChild(logoSelectionDiv);
    }

    // Add event listener for logo selection within this card
    logoSelectionDiv.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent card selection
      if (e.target.classList.contains("card-selectable-logo")) {
        // Remove selection from all logos in this card
        logoSelectionDiv
          .querySelectorAll(".card-selectable-logo")
          .forEach((logo) => {
            logo.classList.remove("selected-logo");
          });
        // Highlight selected logo
        e.target.classList.add("selected-logo");
        // Store selected logo in card dataset
        card.dataset.selectedLogo = e.target.dataset.logo;
      }
    });

    // Set default logo selection (first logo)
    const firstLogo = logoSelectionDiv.querySelector(".card-selectable-logo");
    if (firstLogo) {
      firstLogo.classList.add("selected-logo");
      card.dataset.selectedLogo = firstLogo.dataset.logo;
    }

    card.onclick = (e) => {
      if (
        e.target === checkbox ||
        e.target === deleteBtn ||
        e.target.classList.contains("card-selectable-logo")
      )
        return;
      checkbox.checked = !checkbox.checked;
      toggleCardSelection(card, checkbox.checked);
    };

    return card;
  }

  // Toggle card selection
  function toggleCardSelection(card, selected) {
    if (selected) {
      card.classList.add("selected");
      if (!renderedModels.includes(card)) {
        renderedModels.push(card);
      }
    } else {
      card.classList.remove("selected");
      const index = renderedModels.indexOf(card);
      if (index > -1) {
        renderedModels.splice(index, 1);
      }
    }
    updateSelectionInfo();
  }

  // Remove rendered card
  function removeRenderedCard(card) {
    const index = renderedModels.indexOf(card);
    if (index > -1) {
      renderedModels.splice(index, 1);
    }
    card.remove();
    updateSelectionInfo();
  }

  // Update selection info and export button
  function updateSelectionInfo() {
    const selectedCount = renderedModels.length;
    exportBtn.disabled = selectedCount === 0;

    if (selectedCount === 0) {
      exportBtn.textContent = "Export Selected PDF";
    } else {
      exportBtn.textContent = `Export ${selectedCount} Selected PDF`;
    }

    // Also toggle the Clear All button based on selection
    if (typeof toggleClearButtonState === "function") {
      toggleClearButtonState();
    }

    // Update scroll buttons visibility
    if (typeof updateScrollButtons === "function") {
      updateScrollButtons();
    }
  }

  // Event listeners
  textureTitle.addEventListener("input", checkFormValidity);
  textureFile.addEventListener("change", () => {
    const fileWrapper = textureFile.closest(".file-upload-wrapper");
    if (textureFile.files.length > 0) {
      fileName.textContent = truncateFileName(textureFile.files[0].name);
      fileWrapper.classList.remove("error-highlight");
    } else {
      fileName.textContent = "No file chosen";
    }

    checkFormValidity();
    updateMainModelViewer();
  });

  lidTextureFile.addEventListener("change", () => {
    if (lidTextureFile.files.length > 0) {
      lidFileName.textContent = truncateFileName(lidTextureFile.files[0].name);
      lidTextureFile
        .closest(".file-upload-wrapper")
        .classList.remove("error-highlight");
    } else {
      lidFileName.textContent = "No file chosen";
    }
    checkFormValidity();
    updateMainModelViewer();
  });

  topColor.addEventListener("change", updateMainModelViewer);

  renderBtn.addEventListener("click", async () => {
    const tubFile = textureFile.files[0];
    const lidFile = lidTextureFile.files[0];
    const title = textureTitle.value.trim();
    const topMaterialColor = topColor.value;
    const backgroundColor = bgColor.value;
    const isDualMode = lidTextureGroup.style.display !== "none";

    const fileWrapper = textureFile.closest(".file-upload-wrapper");
    const lidFileWrapper = lidTextureFile.closest(".file-upload-wrapper");

    // Reset highlights
    textureTitle.classList.remove("error-highlight");
    fileWrapper.classList.remove("error-highlight");
    lidFileWrapper.classList.remove("error-highlight");

    // Validate
    let isValid = true;

    if (!title) {
      textureTitle.classList.remove("valid-highlight");
      textureTitle.classList.add("error-highlight");
      setTimeout(() => textureTitle.classList.remove("error-highlight"), 2000);
      isValid = false;
    }

    if (!tubFile) {
      fileWrapper.classList.remove("valid-highlight");
      fileWrapper.classList.add("error-highlight");
      setTimeout(() => fileWrapper.classList.remove("error-highlight"), 2000);
      isValid = false;
    }

    if (isDualMode && !lidFile) {
      lidFileWrapper.classList.remove("valid-highlight");
      lidFileWrapper.classList.add("error-highlight");
      setTimeout(
        () => lidFileWrapper.classList.remove("error-highlight"),
        2000,
      );
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    const tubReader = new FileReader();
    tubReader.onload = async (event) => {
      const tubTextureDataURL = event.target.result;
      let lidTextureDataURL = null;

      const finalizeRender = async (lidDataURL) => {
        const currentModelSrc = modelViewer.getAttribute("src");
        let snapshotDataURL = null;
        try {
          const modelDataURL = modelViewer.toDataURL({ mimeType: "image/png" });
          const modelImg = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = modelDataURL;
          });
          const canvas = document.createElement("canvas");
          canvas.width = modelImg.width;
          canvas.height = modelImg.height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(modelImg, 0, 0);
          snapshotDataURL = canvas.toDataURL("image/png", 1.0);
        } catch (err) {
          console.error("Failed to capture model snapshot:", err);
        }

        const orbit = modelViewer.getCameraOrbit();
        const currentLiveOrbit = `${((orbit.theta * 180) / Math.PI).toFixed(2)}deg ${((orbit.phi * 180) / Math.PI).toFixed(2)}deg ${orbit.radius.toFixed(4)}m`;
        const currentLiveFOV = `${modelViewer.getFieldOfView().toFixed(2)}deg`;

        const card = createRenderedCard(
          tubTextureDataURL,
          title,
          topMaterialColor,
          currentModelSrc,
          snapshotDataURL,
          backgroundColor,
          lidDataURL,
          currentLiveOrbit,
          currentLiveFOV,
          tubColor.value,
          tubTransparent.checked,
          lidTransparent.checked,
        );
        renderedImages.appendChild(card);
        renderedModels.push(card);
        card.classList.add("selected");
        updateSelectionInfo();

        // Scroll to the new card
        setTimeout(() => {
          renderedImages.scrollTo({
            left: renderedImages.scrollWidth,
            behavior: "smooth",
          });
        }, 100);

        // Clear form
        resetTextureInputs();
        topColor.value = "#ffffff";
        bgColor.value = "#c7c7c7";
        tubTransparent.checked = false;
        lidTransparent.checked = false;
        modelbg.style.backgroundColor = "#c7c7c7";
        checkFormValidity();

        // Reset model materials
        if (modelViewer.model) {
          const bottomMat = modelViewer.model.materials.find(
            (m) => m.name === materialName,
          );
          if (bottomMat) {
            bottomMat.pbrMetallicRoughness.baseColorTexture.setTexture(
              originalBottomTexture || null,
            );
            bottomMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
          }
          const topMat = modelViewer.model.materials.find(
            (m) => m.name === TopmaterialName,
          );
          if (topMat) {
            topMat.pbrMetallicRoughness.baseColorTexture.setTexture(null);
            topMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
          }
        }
      };

      if (isDualMode && lidFile) {
        const lidReader = new FileReader();
        lidReader.onload = (e) => finalizeRender(e.target.result);
        lidReader.readAsDataURL(lidFile);
      } else {
        finalizeRender(null);
      }
    };
    tubReader.readAsDataURL(tubFile);
  });

  // Lid color picker live preview
  topColor.addEventListener("input", function (e) {
    const pickedColor = e.target.value;
    if (modelViewer.model) {
      const topMat = modelViewer.model.materials.find(
        (m) => m.name === TopmaterialName,
      );
      if (topMat) {
        const rgb = hexToRgbArray(pickedColor);
        topMat.pbrMetallicRoughness.setBaseColorFactor([...rgb, 1]);
        // Also ensure it's not metallic/rough for a clean look
        topMat.pbrMetallicRoughness.setMetallicFactor(0);
        topMat.pbrMetallicRoughness.setRoughnessFactor(1);
      }
    }
  });

  // BG color picker live preview
  bgColor.addEventListener("input", function (e) {
    // Set 'background' to override the default radial-gradient in CSS
    modelbg.style.background = e.target.value;
  });

  const selectAllToggle = document.getElementById("selectAllToggle");

  selectAllToggle.addEventListener("change", () => {
    const allCards = document.querySelectorAll(".rendered-card");
    renderedModels = [];

    if (selectAllToggle.checked) {
      allCards.forEach((card) => {
        card.classList.add("selected");
        const checkbox = card.querySelector(".selection-checkbox");
        if (checkbox) checkbox.checked = true;
        renderedModels.push(card);
      });
    } else {
      allCards.forEach((card) => {
        card.classList.remove("selected");
        const checkbox = card.querySelector(".selection-checkbox");
        if (checkbox) checkbox.checked = false;
      });
    }

    updateSelectionInfo();
  });

  renderedImages.addEventListener("change", (event) => {
    if (event.target.classList.contains("selection-checkbox")) {
      const allCheckboxes = renderedImages.querySelectorAll(
        ".selection-checkbox",
      );
      const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);

      selectAllToggle.checked = allChecked;

      const card = event.target.closest(".rendered-card");
      if (card) {
        if (event.target.checked) {
          card.classList.add("selected");
          if (!renderedModels.includes(card)) {
            renderedModels.push(card);
          }
        } else {
          card.classList.remove("selected");
          renderedModels = renderedModels.filter((c) => c !== card);
        }
      }

      updateSelectionInfo();
    }
  });

  // Custom logo upload preview
  customLogoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const logoFileNameText = document.getElementById("logoFileName");
    if (file) {
      logoFileNameText.textContent = truncateFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        customLogoPreview.src = event.target.result;
        customLogoPreview.style.display = "block";
        customLogoPreview.dataset.preview = event.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      logoFileNameText.textContent = "No logo chosen";
    }
  });

  // Selected logo source
  window.selectedLogoSrc = null;

  // const logoSelectionContainer = document.getElementById('logoSelection');
  // logoSelectionContainer.addEventListener('click', event => {
  //   if (event.target.classList.contains('selectable-logo')) {
  //     document.querySelectorAll('.selectable-logo').forEach(el => el.classList.remove('selected'));
  //     event.target.classList.add('selected');
  //     window.selectedLogoSrc = event.target.src;
  //   }
  // });

  // --- Clear All Functionality ---

  clearAllBtn.addEventListener("click", () => {
    showCustomModal({
      title: "Clear All Renders",
      message:
        "Are you sure you want to clear all rendered models? This action cannot be undone.",
      type: "confirm",
      onConfirm: () => {
        renderedModels.length = 0;
        renderedImages.innerHTML = "";
        console.log("Cleared all rendered models");

        // Update UI states
        updateSelectionInfo();
        toggleClearButtonState();

        showCustomModal({
          title: "Success",
          message: "All rendered models have been cleared!",
          type: "alert",
        });
      },
    });
  });

  toggleClearButtonState();

  const categorizedModels = [
    {
      category: "Round",
      models: [
        {
          name: "120ml Round",
          frontSrc:
            "./assets/Angles/round-containers/120ml-round/120ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/120ml-round/120ml-main.glb",
              cameraOrbit: "0deg 75deg 0.35m",
              minDist: 0.35,
              maxDist: 0.35,
              image:
                "./assets/Angles/round-containers/120ml-round/120ml-round-Main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/120ml-round/120ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/120ml-round/120ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/120ml-round/120ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/120ml-round/120ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "250ml Round",
          frontSrc:
            "./assets/Angles/round-containers/250ml-round/250ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/250ml-round/250ml-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.55,
              image:
                "./assets/Angles/round-containers/250ml-round/250ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/250ml-round/250ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.50m",
              minDist: 0.5,
              maxDist: 0.5,
              image:
                "./assets/Angles/round-containers/250ml-round/250ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/250ml-round/250ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.50m",
              minDist: 0.5,
              maxDist: 0.5,
              image:
                "./assets/Angles/round-containers/250ml-round/250ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "300ml Round",
          frontSrc:
            "./assets/Angles/round-containers/300ml-round/300ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/300ml-round/300ml-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/300ml-round/300ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/300ml-round/300ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/round-containers/300ml-round/300ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/300ml-round/300ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/round-containers/300ml-round/300ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "500ml Round",
          frontSrc:
            "./assets/Angles/round-containers/500ml-round/500ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/500ml-round/500ml-main.glb",
              cameraOrbit: "0deg 75deg 0.35m",
              minDist: 0.35,
              maxDist: 0.35,
              image:
                "./assets/Angles/round-containers/500ml-round/500ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/500ml-round/500ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/500ml-round/500ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/500ml-round/500ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/500ml-round/500ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "750ml Round",
          frontSrc:
            "./assets/Angles/round-containers/750ml-round/750ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/750ml-round/750ml-main.glb",
              cameraOrbit: "0deg 75deg 0.50m",
              minDist: 0.5,
              maxDist: 0.5,
              image:
                "./assets/Angles/round-containers/750ml-round/750ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/750ml-round/750ml-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.90m",
              minDist: 0.9,
              maxDist: 0.9,
              image:
                "./assets/Angles/round-containers/750ml-round/750ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/750ml-round/750ml-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.75m",
              minDist: 0.75,
              maxDist: 0.75,
              image:
                "./assets/Angles/round-containers/750ml-round/750ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "1000ml Round",
          frontSrc:
            "./assets/Angles/round-containers/1000ml-round/1000ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-containers/1000ml-round/1000ml-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-containers/1000ml-round/1000ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-containers/1000ml-round/1000ml-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/round-containers/1000ml-round/1000ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-containers/1000ml-round/1000ml-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.75m",
              minDist: 0.75,
              maxDist: 0.75,
              image:
                "./assets/Angles/round-containers/1000ml-round/1000ml-round-angle-2.png",
            },
          ],
        },
      ],
    },
    {
      category: "Round Square",
      models: [
        {
          name: "450ml/500g Round Square",
          frontSrc:
            "./assets/Angles/round-square-containers/450ml-round-square/450ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-square-containers/450ml-round-square/450ml-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-square-containers/450ml-round-square/450ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-square-containers/450ml-round-square/450ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/round-square-containers/450ml-round-square/450ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-square-containers/450ml-round-square/450ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.6m",
              minDist: 0.6,
              maxDist: 0.6,
              image:
                "./assets/Angles/round-square-containers/450ml-round-square/450ml-round-angle-2.png",
            },
          ],
        },
        {
          name: "500ml Round Square",
          frontSrc:
            "./assets/Angles/round-square-containers/500ml-round-square/500ml-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/round-square-containers/500ml-round-square/500ml-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/round-square-containers/500ml-round-square/500ml-round-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/round-square-containers/500ml-round-square/500ml-angle-glb-1.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/round-square-containers/500ml-round-square/500ml-round-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/round-square-containers/500ml-round-square/500ml-angle-glb-2.glb",
              cameraOrbit: "0deg 75deg 0.6m",
              minDist: 0.6,
              maxDist: 0.6,
              image:
                "./assets/Angles/round-square-containers/500ml-round-square/500ml-round-angle-2.png",
            },
          ],
        },
      ],
    },
    {
      category: "Rectangle",
      models: [
        {
          name: "500ml Rectangle",
          frontSrc:
            "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-main.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.75m",
              minDist: 0.75,
              maxDist: 0.75,
              image:
                "./assets/Angles/Rectangle/500ml-rectangle/500ml-rectangular-angle-2.png",
            },
          ],
        },
        {
          name: "650ml Rectangle",
          frontSrc:
            "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-main.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.75m",
              minDist: 0.75,
              maxDist: 0.75,
              image:
                "./assets/Angles/Rectangle/650ml-rectangle/650ml-rectangular-angle-2.png",
            },
          ],
        },
        {
          name: "750ml Rectangle",
          frontSrc:
            "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-main.glb",
              cameraOrbit: "0deg 75deg 0.55m",
              minDist: 0.55,
              maxDist: 0.55,
              image:
                "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.75m",
              minDist: 0.75,
              maxDist: 0.75,
              image:
                "./assets/Angles/Rectangle/750ml-rectangle/750ml-rectangular-angle-2.png",
            },
          ],
        },
      ],
    },
    {
      category: "Sweet Box",
      models: [
        {
          name: "250g Sweet Box",
          frontSrc:
            "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-main.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-angle-1.glb",
              cameraOrbit: "0deg 75deg 1.05m",
              minDist: 1.05,
              maxDist: 1.05,
              image:
                "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-angle-2.glb",
              cameraOrbit: "0deg 75deg 1.05m",
              minDist: 1.05,
              maxDist: 1.05,
              image:
                "./assets/Angles/Sweet-Box/250g-sweet-box/250g-sweet-box-angle-2.png",
            },
          ],
        },
        {
          name: "500g Sweet Box",
          frontSrc:
            "./assets/Angles/sweet-Box/500g-sweet-box/500g-sweet-box-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/sweet-Box/500g-sweet-box/500g-sweet-box-main.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box/500g-sweet-box/500g-sweet-box-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/sweet-Box/500g-sweet-box/500g-sweet-box-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.85m",
              minDist: 0.85,
              maxDist: 0.85,
              image:
                "./assets/Angles/Sweet-Box/500g-sweet-box/500g-sweet-box-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/sweet-Box/500g-sweet-box/500g-sweet-box-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.85m",
              minDist: 0.85,
              maxDist: 0.85,
              image:
                "./assets/Angles/Sweet-Box/500g-sweet-box/500g-sweet-box-angle-2.png",
            },
          ],
        },
        {
          name: "1kg Sweet Box",
          frontSrc:
            "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-main.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.85m",
              minDist: 0.85,
              maxDist: 0.85,
              image:
                "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.85m",
              minDist: 0.85,
              maxDist: 0.85,
              image:
                "./assets/Angles/Sweet-Box/1kg-sweet-box/1kg-sweet-box-angle-2.png",
            },
          ],
        },
      ],
    },
    {
      category: "Square Box TE",
      models: [
        {
          name: "250g Sweet Box TE",
          frontSrc:
            "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box-TE/250g-sweet-box-te/250g-sweet-box-te-angle-2.png",
            },
          ],
        },
        {
          name: "500g Sweet Box TE",
          frontSrc:
            "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-main.glb",
          angles: [
            {
              name: "Main",
              src: "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-main.glb",
              cameraOrbit: "0deg 75deg 0.45m",
              minDist: 0.45,
              maxDist: 0.45,
              image:
                "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-main.png",
            },
            {
              name: "Front",
              src: "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-angle-1.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-angle-1.png",
            },
            {
              name: "Side",
              src: "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-angle-2.glb",
              cameraOrbit: "0deg 75deg 0.65m",
              minDist: 0.65,
              maxDist: 0.65,
              image:
                "./assets/Angles/Sweet-Box-TE/500g-sweet-box-te/500g-sweet-box-te-angle-2.png",
            },
          ],
        },
      ],
    },
  ];

  // Flatten models for internal logic compatibility
  const models = categorizedModels.flatMap((cat) => cat.models);

  const modelContainer = document.getElementById("modelcardContainer");
  const angleContainer = document.getElementById("angleCardContainer");
  const mainModelViewer = document.getElementById("modelViewer");

  let selectedModelIndex = null;
  let selectedAngleIndex = null;

  function renderModels() {
    modelContainer.innerHTML = "";
    let overallModelIndex = 0;

    categorizedModels.forEach((categoryData, catIdx) => {
      const categoryEl = document.createElement("div");
      categoryEl.className = "model-category-item";
      if (catIdx === 0) categoryEl.classList.add("open");

      categoryEl.innerHTML = `
        <div class="model-category-header">
          <span>${categoryData.name || categoryData.category}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </div>
      `;

      const header = categoryEl.querySelector(".model-category-header");
      const wrapper = document.createElement("div");
      wrapper.className = "model-category-content-wrapper";
      const content = document.createElement("div");
      content.className = "model-category-content";

      header.onclick = () => {
        // Close others for exclusive accordion
        document.querySelectorAll(".model-category-item").forEach((item) => {
          if (item !== categoryEl) item.classList.remove("open");
        });

        categoryEl.classList.toggle("open");
      };

      categoryData.models.forEach((model) => {
        const mIdx = overallModelIndex++;
        const modelCard = document.createElement("div");
        modelCard.className = "model-card-item";
        modelCard.dataset.index = mIdx;

        const mv = document.createElement("model-viewer");
        mv.src = model.frontSrc;
        mv.setAttribute("disable-tap", "");
        mv.setAttribute("disable-pan", "");
        mv.setAttribute("interaction-prompt", "none");

        // Use auto framing for thumbnails to ensure they fit the card
        const orbit = model.angles[0].cameraOrbit || "0deg 75deg 0.75m";
        const parts = orbit.split(" ");
        mv.setAttribute("camera-orbit", `${parts[0]} ${parts[1]} auto`);
        mv.setAttribute("min-camera-orbit", "auto auto auto");
        mv.setAttribute("field-of-view", "auto");
        mv.setAttribute("shadow-intensity", "0");
        mv.setAttribute("exposure", "1");
        mv.style.pointerEvents = "none"; // Thumbnails don't need interaction

        const label = document.createElement("div");
        label.textContent = model.name;

        modelCard.appendChild(mv);
        modelCard.appendChild(label);

        modelCard.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent accordion toggle
          selectedModelIndex = mIdx;
          selectedAngleIndex = 0;

          // Reset everything to default look when switching models
          lidColorManualSet = false;
          tubColorManualSet = false;
          lidTransparent.checked = false;
          tubTransparent.checked = false;
          resetTextureInputs();

          highlightSelectedInAccordion();
          renderAngles();
          highlightSelected(angleContainer, 0);
          updateMainViewer();
        });

        content.appendChild(modelCard);
      });

      wrapper.appendChild(content);
      categoryEl.appendChild(wrapper);
      modelContainer.appendChild(categoryEl);
    });

    // Default Selection
    if (models.length > 0) {
      selectedModelIndex = 0;
      selectedAngleIndex = 0;
      highlightSelectedInAccordion();
      renderAngles();
      setTimeout(() => {
        highlightSelected(angleContainer, 0);
      }, 100);
      updateMainViewer();
    }
  }

  function highlightSelectedInAccordion() {
    document.querySelectorAll(".model-card-item").forEach((card) => {
      if (parseInt(card.dataset.index) === selectedModelIndex) {
        card.classList.add("active");
        // Ensure its parent category is open
        card.closest(".model-category-item").classList.add("open");
      } else {
        card.classList.remove("active");
      }
    });
  }

  function renderAngles() {
    angleContainer.innerHTML = "";

    if (selectedModelIndex === null) return;

    const selectedModel = models[selectedModelIndex];

    selectedModel.angles.forEach((angle, i) => {
      const angleCard = document.createElement("div");
      angleCard.className = "angle-card-item";

      const img = document.createElement("img");
      img.src = angle.image || "";
      img.alt = angle.name;

      angleCard.appendChild(img);

      angleCard.addEventListener("click", () => {
        selectedAngleIndex = i;

        // Reset everything to default look when switching angles
        lidColorManualSet = false;
        tubColorManualSet = false;
        lidTransparent.checked = false;
        tubTransparent.checked = false;
        resetTextureInputs();

        highlightSelected(angleContainer, selectedAngleIndex);
        updateMainViewer();
      });

      angleContainer.appendChild(angleCard);
    });

    // Update upload UI based on category
    const modelCategory = categorizedModels.find((c) =>
      c.models.includes(selectedModel),
    )?.category;

    const isSweetBox =
      modelCategory === "Sweet Box" ||
      modelCategory === "Sweet Box TE" ||
      modelCategory === "Square" ||
      modelCategory === "Square TE" ||
      modelCategory === "Square Box TE";
    const isRectangle = modelCategory === "Rectangle";
    const isRound =
      modelCategory === "Round" || modelCategory === "Round Square";

    if (selectedModel.name === "1kg Sweet Box") {
      tubTextureGroup.style.display = "none";
      lidTextureGroup.style.display = "flex";
    } else if (isSweetBox) {
      tubTextureGroup.style.display = "flex";
      lidTextureGroup.style.display = "flex";
      textureLabel.innerHTML = 'Tub Texture <span style="color: red;">*</span>';
    } else if (isRectangle) {
      tubTextureGroup.style.display = "none";
      lidTextureGroup.style.display = "flex";
    } else if (isRound) {
      tubTextureGroup.style.display = "flex";
      lidTextureGroup.style.display = "none";
      textureLabel.innerHTML = 'Tub Texture <span style="color: red;">*</span>';
    } else {
      // Default fallback
      tubTextureGroup.style.display = "flex";
      lidTextureGroup.style.display = "none";
      textureLabel.innerHTML =
        'Upload Texture <span style="color: red;">*</span>';
    }

    resetTextureInputs();
    checkFormValidity();
  }

  function resetTextureInputs() {
    if (textureFile) {
      textureFile.value = "";
      if (fileName) {
        fileName.textContent = "No file chosen";
      }
      currentTubTextureDataURL = null;
      const fileWrapper = textureFile.closest(".file-upload-wrapper");
      if (fileWrapper) {
        fileWrapper.classList.remove("valid-highlight", "error-highlight");
      }
    }
    if (lidTextureFile) {
      lidTextureFile.value = "";
      if (lidFileName) {
        lidFileName.textContent = "No file chosen";
      }
      currentLidTextureDataURL = null;
      const lidFileWrapper = lidTextureFile.closest(".file-upload-wrapper");
      if (lidFileWrapper) {
        lidFileWrapper.classList.remove("valid-highlight", "error-highlight");
      }
    }
    if (textureTitle) {
      textureTitle.value = "";
      textureTitle.classList.remove("valid-highlight", "error-highlight");
    }
  }

  function updateMainViewer() {
    if (selectedModelIndex === null || selectedAngleIndex === null) return;

    const selectedModel = models[selectedModelIndex];
    const selectedAngle = selectedModel.angles[selectedAngleIndex];

    // Support per-angle zoom and FOV overrides
    const minDist = selectedAngle.minDist || 0.6;
    const maxDist = selectedAngle.maxDist || 0.6;
    const fov = selectedAngle.fov || "20deg";

    mainModelViewer.setAttribute("src", selectedAngle.src);

    // Apply specific constraints
    mainModelViewer.setAttribute(
      "min-camera-orbit",
      selectedAngle.minCameraOrbit || `auto auto ${minDist}m`,
    );
    mainModelViewer.setAttribute(
      "max-camera-orbit",
      selectedAngle.maxCameraOrbit || `auto auto ${maxDist}m`,
    );

    // Allow FOV range for zooming to work
    mainModelViewer.setAttribute("min-field-of-view", "10deg");
    mainModelViewer.setAttribute("max-field-of-view", "45deg");
    mainModelViewer.setAttribute("field-of-view", fov);

    mainModelViewer.setAttribute("shadow-intensity", "0");
    mainModelViewer.setAttribute("exposure", "1");
    mainModelViewer.setAttribute("environment-image", "neutral");

    // Apply the stored camera orbit (including distance)
    mainModelViewer.setAttribute(
      "camera-orbit",
      selectedAngle.cameraOrbit || `0deg 75deg 0.6m`,
    );
  }

  function highlightSelected(container, index) {
    Array.from(container.children).forEach((child, i) => {
      if (i === index) {
        child.classList.add("active");
      } else {
        child.classList.remove("active");
      }
    });
  }

  // Helper to trim transparent pixels from an image (Optimized)
  async function trimTransparency(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;
        let rmin = h,
          rmax = 0,
          cmin = w,
          cmax = 0;

        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            if (data[(r * w + c) * 4 + 3] > 0) {
              if (r < rmin) rmin = r;
              if (r > rmax) rmax = r;
              if (c < cmin) cmin = c;
              if (c > cmax) cmax = c;
            }
          }
        }

        if (rmax < rmin || cmax < cmin) return resolve(dataUrl);

        const width = cmax - cmin + 1;
        const height = rmax - rmin + 1;
        const trimmed = document.createElement("canvas");
        trimmed.width = width;
        trimmed.height = height;
        trimmed
          .getContext("2d")
          .drawImage(canvas, cmin, rmin, width, height, 0, 0, width, height);
        resolve(trimmed.toDataURL("image/png"));
      };
      img.src = dataUrl;
    });
  }

  renderModels();
  renderAngles();

  // --- PDF-specific model viewer creation ---
  async function createPDFModelViewer(
    modelSrcForCard,
    tubTextureDataURL,
    topMaterialColor = null,
    customSize = 800,
    lidTextureDataURL = null,
    cameraOrbit = null,
    fieldOfView = null,
    tubMaterialColor = null,
    isTubTransparent = false,
    isLidTransparent = false,
    backgroundColor = "transparent",
    cameraTarget = null,
  ) {
    console.log("Creating PDF model viewer...");

    const pdfModelViewer = document.createElement("model-viewer");
    pdfModelViewer.src = modelSrcForCard || modelSrc;

    // Use the stored orbit rotation but set distance to 'auto' to prevent cropping
    if (cameraOrbit) {
      const parts = cameraOrbit.split(" ");
      pdfModelViewer.setAttribute(
        "camera-orbit",
        `${parts[0]} ${parts[1]} auto`,
      );
    } else {
      pdfModelViewer.setAttribute("camera-orbit", "auto auto auto");
    }

    if (fieldOfView) {
      pdfModelViewer.setAttribute("field-of-view", fieldOfView);
    } else {
      pdfModelViewer.setAttribute("field-of-view", "auto");
    }

    if (cameraTarget) {
      pdfModelViewer.setAttribute("camera-target", cameraTarget);
    } else {
      pdfModelViewer.setAttribute("camera-target", "auto auto auto");
    }
    // Use manual values from selected angle if possible, otherwise use fallbacks
    // Try to find the matching angle's config from categorizedModels
    let manualMinDist = 0.6;
    let manualMaxDist = 0.6;
    let manualFov = "20deg";

    const currentModel = categorizedModels
      .flatMap((c) => c.models)
      .find((m) => m.frontSrc === modelSrcForCard);

    if (currentModel && currentModel.angles && currentModel.angles.length > 0) {
      // Use the first angle as default for PDF if specific one isn't tracked here
      const firstAngle = currentModel.angles[0];
      manualMinDist = firstAngle.minDist || 0.6;
      manualMaxDist = firstAngle.maxDist || 0.6;
      manualFov = firstAngle.fov || "20deg";
    }

    pdfModelViewer.setAttribute(
      "min-camera-orbit",
      `auto auto ${manualMinDist}m`,
    );
    pdfModelViewer.setAttribute(
      "max-camera-orbit",
      `auto auto ${manualMaxDist}m`,
    );
    pdfModelViewer.setAttribute("field-of-view", manualFov);
    pdfModelViewer.setAttribute("disable-tap", "");
    pdfModelViewer.setAttribute("disable-pan", "");
    pdfModelViewer.setAttribute("interaction-prompt", "none");
    pdfModelViewer.setAttribute("shadow-intensity", "0.5");
    pdfModelViewer.style.width = `${customSize}px`;
    pdfModelViewer.style.height = `${customSize}px`;
    pdfModelViewer.style.position = "fixed";
    pdfModelViewer.style.left = "50%";
    pdfModelViewer.style.top = "50%";
    pdfModelViewer.style.transform = "translate(-50%, -50%)";
    pdfModelViewer.style.zIndex = "-1";
    pdfModelViewer.style.backgroundColor = backgroundColor;

    document.body.appendChild(pdfModelViewer);
    console.log("PDF model viewer added to DOM");

    let attempts = 0;
    const maxAttempts = 50;

    while (!pdfModelViewer.model && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;
      console.log(`Waiting for model to load... attempt ${attempts}`);
    }

    if (!pdfModelViewer.model) {
      console.error("Model failed to load after", maxAttempts * 200, "ms");
      return null;
    }

    console.log("Model loaded successfully");
    console.log("Applying colors and textures...");

    // Apply plastic colors and transparency explicitly
    updatePartTransparency(
      pdfModelViewer,
      "lid",
      isLidTransparent,
      topMaterialColor,
    );
    updatePartTransparency(
      pdfModelViewer,
      "tub",
      isTubTransparent,
      tubMaterialColor,
    );

    if (tubTextureDataURL) {
      await tryApplyMaterialTexture(
        pdfModelViewer,
        TubTextureMaterials,
        tubTextureDataURL,
      );
    }
    if (lidTextureDataURL) {
      await tryApplyMaterialTexture(
        pdfModelViewer,
        LidTextureMaterials,
        lidTextureDataURL,
      );
    }
    console.log("Texture and color applied");

    // Increased wait time for UHD 4K rendering and anti-aliasing
    await new Promise((r) => setTimeout(r, 1500));
    console.log("Ready for capture");

    return pdfModelViewer;
  }

  // --- Capture from PDF model viewer ---
  async function capturePDFModelImage(
    pdfModelViewer,
    mimeType = "image/png",
    quality = 1.0,
    backgroundColor = "transparent",
  ) {
    if (!pdfModelViewer) {
      console.error("No model viewer provided");
      return null;
    }

    console.log(`Attempting to capture image as ${mimeType}...`);

    let canvas = null;

    if (pdfModelViewer.shadowRoot) {
      canvas = pdfModelViewer.shadowRoot.querySelector("canvas");
    }

    if (!canvas) {
      canvas = pdfModelViewer.querySelector("canvas");
    }

    if (canvas) {
      try {
        console.log("Canvas dimensions:", canvas.width, "x", canvas.height);

        // Create a temporary canvas for compositing the background
        const compositeCanvas = document.createElement("canvas");
        compositeCanvas.width = canvas.width;
        compositeCanvas.height = canvas.height;
        const ctx = compositeCanvas.getContext("2d");

        // Fill background if not transparent
        if (backgroundColor !== "transparent") {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        }

        // Draw the model-viewer canvas on top
        ctx.drawImage(canvas, 0, 0);

        const dataURL = compositeCanvas.toDataURL(mimeType, quality);
        console.log("Image captured successfully, length:", dataURL.length);
        return dataURL;
      } catch (e) {
        console.error("Canvas capture failed:", e);
      }
    } else {
      console.error("No canvas found in model viewer");
    }

    return null;
  }

  // PDF Export functionality
  exportBtn.addEventListener("click", async () => {
    if (renderedModels.length === 0) {
      alert("Please select at least one model to export.");
      return;
    }

    const loadingOverlay = document.getElementById("pdfLoadingOverlay");
    loadingOverlay.style.display = "flex";

    const sortedModels = [...renderedModels].sort((a, b) => {
      const idA = parseInt(a.dataset.id);
      const idB = parseInt(b.dataset.id);
      return idA - idB;
    });

    console.log("PDF Export started");
    console.log(`Found ${renderedModels.length} selected models to export`);

    // if (!window.selectedLogoSrc) {
    //   alert("Please select a logo for the PDF (except the 1st and last pages).");
    //   loadingOverlay.style.display = "none";
    //   return;
    // }

    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        console.error("jsPDF not found");
        loadingOverlay.style.display = "none";
        return alert("jsPDF library not loaded");
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      console.log(`Page size: ${pageWidth} x ${pageHeight}`);

      const totalPages = sortedModels.length + 2;
      // --- Cover Page ---
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      const bgImage = new Image();
      bgImage.src = "./assets/pattern/pattern-6.webp";
      await new Promise((res) => {
        bgImage.onload = res;
      });

      pdf.addImage(bgImage, "PNG", 0, 0, pageWidth, pageHeight);

      const terraLogo1 = new Image();
      terraLogo1.src = "./assets/Logo/terratechpacks.png";

      const customLogo = new Image();
      customLogo.src =
        customLogoPreview.dataset.preview || "./assets/Logo/terratechpacks.png";

      await Promise.all([
        new Promise((res) => (terraLogo1.onload = res)),
        new Promise((res) => (customLogo.onload = res)),
      ]);

      const centerX = pageWidth / 2;
      let currentY1 = pageHeight / 4;

      const terraWidth = 250;
      const terraHeight =
        (terraLogo1.naturalHeight / terraLogo1.naturalWidth) * terraWidth;
      pdf.addImage(
        terraLogo1,
        "PNG",
        centerX - terraWidth / 2,
        currentY1,
        terraWidth,
        terraHeight,
      );
      currentY1 += terraHeight + 40;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(60);
      pdf.text("X", centerX, currentY1 + 60, { align: "center" });
      currentY1 += 120;

      const customWidth = 250;
      const customHeight =
        (customLogo.naturalHeight / customLogo.naturalWidth) * customWidth;
      pdf.addImage(
        customLogo,
        "PNG",
        centerX - customWidth / 2,
        currentY1,
        customWidth,
        customHeight,
      );
      currentY1 += customHeight + 40;

      // --- Option Pages ---
      const headerHeight = 110;
      const footerHeight = 60;
      const sideMargin = 30;
      const availableWidth = pageWidth - sideMargin * 2;
      const availableHeight = pageHeight - headerHeight - footerHeight;
      const contentCenterX = pageWidth / 2;
      const contentCenterY = headerHeight + availableHeight / 2;
      const pdfModelSize = 3840; // UHD 4K Resolution
      const loadingText = loadingOverlay.querySelector("span");

      const terraLogo = new Image();
      terraLogo.src =
        window.selectedLogoSrc || "./assets/Logo/terratechpacks.png";

      await Promise.race([
        new Promise((res) => (terraLogo.onload = res)),
        new Promise((res) => setTimeout(res, 1000)),
      ]);

      for (let i = 0; i < sortedModels.length; i++) {
        if (loadingText)
          loadingText.textContent = `Rendering page ${i + 1} of ${sortedModels.length}...`;
        pdf.addPage();

        const card = sortedModels[i];
        const modelTitle = card.dataset.title || "Untitled";
        const tubTextureDataURL = card.dataset.textureDataUrl;
        const lidTextureDataURL = card.dataset.lidTextureDataUrl;
        const topMaterialColor = card.dataset.topMaterialColor || "#ffffff";
        const tubMaterialColor = card.dataset.tubMaterialColor || "#ffffff";
        const backgroundColor = card.dataset.backgroundColor || "#f5d2da";
        const modelSrcForCard = card.dataset.modelSrc;
        const snapshotDataURL = card.dataset.snapshot;
        const cardLogoSrc =
          card.dataset.selectedLogo ||
          window.selectedLogoSrc ||
          "./assets/Logo/terratechpacks.png"; // Use card-specific logo

        console.log(`Card ${i + 1}: ${modelTitle}, Logo: ${cardLogoSrc}`);

        // Background color
        const bgRgb = hexToRgb(backgroundColor);
        if (bgRgb) {
          pdf.setFillColor(bgRgb.r * 255, bgRgb.g * 255, bgRgb.b * 255);
        } else {
          pdf.setFillColor(245, 210, 218);
        }
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        // Header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Option - ${card.dataset.id}`, pageWidth / 2, 70, {
          align: "center",
        });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(24);
        pdf.text(`Theme - ${modelTitle}`, pageWidth / 2, 105, {
          align: "center",
        });

        // Logo on top right
        const cardLogo = new Image();
        cardLogo.src = cardLogoSrc;

        await Promise.race([
          new Promise((res) => (cardLogo.onload = res)),
          new Promise((res) => setTimeout(res, 1000)),
        ]);

        if (cardLogo.complete && cardLogo.naturalWidth > 0) {
          const logoHeight = 25;
          const logoWidth =
            (cardLogo.naturalWidth * logoHeight) / cardLogo.naturalHeight;
          const topMargin = 60;
          pdf.addImage(
            cardLogo,
            "PNG",
            pageWidth - logoWidth - 25,
            topMargin,
            logoWidth,
            logoHeight,
          );
        }

        // ALWAYS capture new high-res image for the PDF, ignore low-res UI snapshot
        let modelImageData = null;

        if (tubTextureDataURL || lidTextureDataURL) {
          try {
            console.log(`Rendering high-res capture for PDF: ${modelTitle}...`);
            const pdfModelViewer = await createPDFModelViewer(
              modelSrcForCard,
              tubTextureDataURL,
              topMaterialColor,
              pdfModelSize,
              lidTextureDataURL,
              card.dataset.cameraOrbit,
              card.dataset.fieldOfView,
              tubMaterialColor,
              card.dataset.isTubTransparent === "true",
              card.dataset.isLidTransparent === "true",
            );
            if (pdfModelViewer) {
              modelImageData = await capturePDFModelImage(pdfModelViewer);
              if (pdfModelViewer && document.body.contains(pdfModelViewer)) {
                document.body.removeChild(pdfModelViewer);
              }
            }
          } catch (error) {
            console.error("Model capture failed:", error);
            // Fallback to snapshot only if high-res fails
            modelImageData = snapshotDataURL;
          }
        } else {
          modelImageData = snapshotDataURL;
        }

        if (modelImageData) {
          try {
            // Trim transparency to make the model look larger
            modelImageData = await trimTransparency(modelImageData);
          } catch (e) {
            console.warn("Trimming failed, using original image", e);
          }

          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = modelImageData;
          });

          const imageAspectRatio = img.width / img.height;
          const availableAspectRatio = availableWidth / availableHeight;

          let finalWidth, finalHeight;
          if (imageAspectRatio > availableAspectRatio) {
            finalWidth = availableWidth * 0.75; // Reduced from 0.98 for better margins
            finalHeight = finalWidth / imageAspectRatio;
          } else {
            finalHeight = availableHeight * 0.75; // Reduced from 0.98 for better margins
            finalWidth = finalHeight * imageAspectRatio;
          }

          const imageX = contentCenterX - finalWidth / 2;
          const imageY = contentCenterY - finalHeight / 2;
          pdf.addImage(
            modelImageData,
            "PNG",
            imageX,
            imageY,
            finalWidth,
            finalHeight,
            undefined,
            "FAST",
          );
        }

        // Footer
        const pageNumber = i + 2;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(
          `${pageNumber}/${totalPages}`,
          pageWidth / 2,
          pageHeight - 25,
          { align: "center" },
        );
      }

      // --- Summary Page ---
      pdf.addPage();
      pdf.setFillColor(245, 210, 218);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text("All Applied Textures", pageWidth / 2, 50, { align: "center" });

      const marginX = 40;
      const startY = 80;
      const spaceBetween = 20;
      let currentY = startY;

      const maxImageWidth = pageWidth - marginX * 2;
      const availableHeight1 = pageHeight - startY - 40;
      const cardsCount = sortedModels.length;
      const maxHeightPerImage =
        (availableHeight1 - (cardsCount - 1) * spaceBetween) / cardsCount;

      for (let i = 0; i < sortedModels.length; i++) {
        const tubUrl = sortedModels[i].dataset.textureDataUrl;
        const lidUrl = sortedModels[i].dataset.lidTextureDataUrl;

        const drawTexture = async (url) => {
          if (!url) return;
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.width / img.height;
              let imgWidth = maxImageWidth / (lidUrl ? 2.1 : 1);
              let imgHeight = imgWidth / aspectRatio;
              if (imgHeight > maxHeightPerImage) {
                imgHeight = maxHeightPerImage;
                imgWidth = imgHeight * aspectRatio;
              }
              const imageX = lidUrl
                ? url === tubUrl
                  ? pageWidth / 2 - imgWidth - 10
                  : pageWidth / 2 + 10
                : (pageWidth - imgWidth) / 2;
              pdf.addImage(img, "PNG", imageX, currentY, imgWidth, imgHeight);
              resolve();
            };
            img.onerror = reject;
            img.src = url;
          });
        };

        if (tubUrl) await drawTexture(tubUrl);
        if (lidUrl) await drawTexture(lidUrl);
        currentY += maxHeightPerImage + spaceBetween;
      }

      // Footer for summary page
      const summaryPageNumber = totalPages;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `${summaryPageNumber}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 25,
        { align: "center" },
      );

      // Save PDF
      console.log("Saving PDF...");
      pdf.save(
        `Selected_Theme_Mockup_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      console.log("PDF saved successfully!");
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("PDF Export failed. Check console for details.");
    } finally {
      loadingOverlay.style.display = "none";
    }
  });

  renderedImages.addEventListener(
    "wheel",
    function (e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        renderedImages.scrollBy({
          left: e.deltaY,
          behavior: "smooth",
        });
      }
    },
    { passive: false },
  );

  // --- Individual Model View Capture (Export as PNG/JPG) ---
  const downloadModelBtn = document.getElementById("downloadModelBtn");
  const exportFormat = document.getElementById("exportFormat");

  downloadModelBtn.addEventListener("click", async () => {
    const format = exportFormat.value;
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const extension = format === "png" ? "png" : "jpg";

    try {
      // Show high-end full-page loader
      const loadingOverlay = document.getElementById("pdfLoadingOverlay");
      const loadingText = loadingOverlay.querySelector("span");
      loadingText.textContent = `Rendering UHD ${format.toUpperCase()}...`;
      loadingOverlay.style.display = "flex";

      // Disable button
      const originalContent = downloadModelBtn.innerHTML;
      downloadModelBtn.disabled = true;

      // Use the high-res capture logic
      const uhdSize = 3840; // 4K Resolution
      const currentModelSrc = mainModelViewer.getAttribute("src");
      const orbit = mainModelViewer.getCameraOrbit();
      // Use 'auto' for distance to ensure the full model fits in the high-res frame
      const currentOrbit = `${((orbit.theta * 180) / Math.PI).toFixed(2)}deg ${((orbit.phi * 180) / Math.PI).toFixed(2)}deg auto`;
      const currentFOV = `${mainModelViewer.getFieldOfView().toFixed(2)}deg`;

      const target = mainModelViewer.getCameraTarget();
      const currentTarget = `${target.x}m ${target.y}m ${target.z}m`;

      // For PNG we force transparency, for JPG we use the background color
      const captureBG = format === "png" ? "transparent" : bgColor.value;

      // Create a temporary high-res model viewer
      const captureViewer = await createPDFModelViewer(
        currentModelSrc,
        currentTubTextureDataURL,
        topColor.value,
        uhdSize,
        currentLidTextureDataURL,
        currentOrbit,
        currentFOV,
        tubColor.value,
        tubTransparent.checked,
        lidTransparent.checked,
        captureBG,
        currentTarget,
      );

      // Wait for high-res shaders and lighting to settle
      await new Promise((r) => setTimeout(r, 1500));

      // Capture the image with 100% quality and requested transparency/background
      let dataUrl = await capturePDFModelImage(
        captureViewer,
        mimeType,
        1.0,
        captureBG,
      );

      if (dataUrl) {
        // High-end refinement: Trim transparency to make the model center-fit in the final file
        try {
          dataUrl = await trimTransparency(dataUrl);
        } catch (e) {
          console.warn(
            "Trimming failed during direct export, using raw capture",
            e,
          );
        }

        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `TerraTech_UHD_Capture_${new Date().getTime()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("Failed to generate capture");
      }

      // Cleanup
      if (captureViewer.parentNode) {
        captureViewer.parentNode.removeChild(captureViewer);
      }

      // Hide loader and restore button
      loadingOverlay.style.display = "none";
      downloadModelBtn.disabled = false;
      downloadModelBtn.innerHTML = originalContent;
    } catch (error) {
      console.error("UHD capture failed:", error);

      // Hide loader for fallback
      const loadingOverlay = document.getElementById("pdfLoadingOverlay");
      if (loadingOverlay) loadingOverlay.style.display = "none";

      alert("Failed to capture UHD image. Using standard quality as fallback.");

      // Fallback to standard quality
      try {
        const dataUrl = mainModelViewer.toDataURL(mimeType);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `TerraTech_Standard_Capture_${new Date().getTime()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (fallbackError) {
        console.error("Fallback capture also failed:", fallbackError);
      }

      downloadModelBtn.disabled = false;
      downloadModelBtn.innerHTML =
        '<i class="fa-solid fa-cloud-arrow-down"></i> Export Capture';
    }
  });

  // Rendered Images Scroll Buttons

  function updateScrollButtons() {
    if (!renderedImages || !scrollLeftBtn || !scrollRightBtn) return;

    // A slightly longer timeout to ensure cards are fully in the DOM and layout is stable
    setTimeout(() => {
      const scrollLeft = Math.round(renderedImages.scrollLeft);
      const scrollWidth = renderedImages.scrollWidth;
      const clientWidth = renderedImages.clientWidth;

      // Check for overflow (with a small 2px tolerance)
      const hasOverflow = scrollWidth > clientWidth + 2;

      if (!hasOverflow) {
        scrollLeftBtn.style.display = "none";
        scrollRightBtn.style.display = "none";
        return;
      }

      // Show/Hide left button: visible if we have scrolled away from the start
      scrollLeftBtn.style.display = scrollLeft > 5 ? "flex" : "none";

      // Show/Hide right button: visible if there's more to scroll to the right
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 5;
      scrollRightBtn.style.display = atEnd ? "none" : "flex";
    }, 250);
  }

  // Monitor for any changes in the rendered images container (new cards, removed cards, etc)
  const renderObserver = new MutationObserver(() => {
    updateScrollButtons();
  });

  if (renderedImages) {
    renderObserver.observe(renderedImages, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  // Initialize
  checkFormValidity();
  updateSelectionInfo();
  updateScrollButtons();

  // Make renderedModels globally accessible
  window.renderedModels = renderedModels;

  console.log("🔄 Model Rotation Controls:");
  console.log("• Mouse wheel / trackpad scroll to rotate");
  console.log("• Touch and drag on mobile");
  console.log("• Arrow keys (Left/Right) for precise control");
  console.log("• Press 'R' to reset rotation");

  // --- Custom Modal Helper ---
  function showCustomModal({
    title,
    message,
    type = "alert",
    onConfirm = null,
  }) {
    const modal = document.getElementById("customModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("confirmModalBtn");
    const cancelBtn = document.getElementById("cancelModalBtn");
    const closeModal = document.getElementById("closeModal");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = "block";

    if (type === "confirm") {
      cancelBtn.style.display = "block";
    } else {
      cancelBtn.style.display = "none";
    }

    const close = () => {
      modal.style.display = "none";
      // Cleanup event listeners to prevent memory leaks/duplicate calls
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      closeModal.onclick = null;
    };

    confirmBtn.onclick = () => {
      close();
      if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = close;
    closeModal.onclick = close;

    // Close on outside click
    window.onclick = (event) => {
      if (event.target == modal) close();
    };
  }
});
