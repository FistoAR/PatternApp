window.addEventListener("DOMContentLoaded", () => {
  const renderedImages = document.getElementById("renderedImages");
  const modelViewer = document.getElementById("modelViewer");
  const textureTitle = document.getElementById("textureTitle");
  const textureFile = document.getElementById("textureFile");
  const topColor = document.getElementById("topColor");
  const bgColor = document.getElementById("bgColor");
  const modelbg = document.getElementById("modelview");
  const renderBtn = document.getElementById("renderBtn");
  const exportBtn = document.getElementById("export_btn");
  const customLogoInput = document.getElementById("customLogoInput");
  const customLogoPreview = document.getElementById("customLogoPreview");

  const modelSrc = "./assets/model.glb";
  const materialName = "Bottom.006";
  const TopmaterialName = "Top.006";
  const viewerTextureCache = new WeakMap();
  let renderedModels = [];
  let cardCounter = 1;

  // Scroll rotation variables
  // let baseRotationY = -540.9;
  // let currentScrollRotation = 0;
  let isScrolling = false;
  let scrollTimeout;


  // Zoom levels - only 2 steps
  const zoomLevels = [0.7649, 0.55]; // [normal, slightly zoomed in]
  let currentZoomIndex = 0;
  let currentZoom = 0.7649; // Initialize with default zoom
  let originalBottomTexture = null;

  modelViewer.addEventListener("load", () => {
    const bottomMat = modelViewer.model?.materials?.find(m => m.name === materialName);
    if (bottomMat) {
      originalBottomTexture = bottomMat.pbrMetallicRoughness.baseColorTexture?.texture || null;
    }
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
    const minDistance = 0.55; // max zoom in
    const maxDistance = 0.7649; // max zoom out (base)

    // Update zoom distance
    currentZoom += zoomDelta;
    currentZoom = Math.max(minDistance, Math.min(maxDistance, currentZoom));

    // Get current rotation angles from the viewer
    const currentOrbit = modelViewer.getAttribute("camera-orbit").split(' ');

    // Update camera with new zoom, keeping current rotation
    modelViewer.setAttribute("camera-orbit", `${currentOrbit[0]} ${currentOrbit[1]} ${currentZoom}m`);

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
  renderedImages.addEventListener("wheel", handleScroll, { passive: false });

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
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : null;
  }

  function hexToRgbArray(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? [rgb.r, rgb.g, rgb.b] : [245, 210, 218];
  }

  // --- Enhanced texture and color application ---
  async function tryApplyMaterialTexture(viewer, materialNames, textureUrl, topMaterialColor = null) {
    if (!viewer || !textureUrl) return;
    if (!viewer.model) {
      await new Promise((res) =>
        viewer.addEventListener("load", res, { once: true })
      );
    }

    const names = Array.isArray(materialNames) ? materialNames : [materialNames];
    const mat = names
      .map((n) => viewer.model?.materials?.find((m) => m.name === n))
      .find(Boolean);

    if (mat) {
      try {
        let vcache = viewerTextureCache.get(viewer) || new Map();
        viewerTextureCache.set(viewer, vcache);

        const cacheKey = mat.name + "::" + stripQuery(textureUrl);
        let tex =
          vcache.get(cacheKey) ||
          (await viewer.createTexture(encodeURI(textureUrl)));
        vcache.set(cacheKey, tex);

        mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
        mat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
        mat.setAlphaMode("OPAQUE");
      } catch (err) {
        console.error("Failed to apply texture:", err);
      }
    }

    if (topMaterialColor) {
      const topMat = viewer.model?.materials?.find((m) => m.name === TopmaterialName);
      if (topMat) {
        try {
          const colorArray = hexToRgbArray(topMaterialColor);
          topMat.pbrMetallicRoughness.setBaseColorFactor([...colorArray, 1]);
        } catch (err) {
          console.error("Failed to apply top material color:", err);
        }
      }
    }
  }

  bgColor.addEventListener("input", () => {
    modelbg.style.backgroundColor = bgColor.value;
  });

  topColor.addEventListener("input", () => {
    const topMat = modelViewer.model?.materials?.find(m => m.name === TopmaterialName);
    if (topMat) {
      const colorArray = hexToRgbArray(topColor.value);
      topMat.pbrMetallicRoughness.setBaseColorFactor([...colorArray, 1]);
    }
  });

  function checkFormValidity() {
    renderBtn.disabled = false;
  }

  // Update main model viewer
  async function updateMainModelViewer() {
    const file = textureFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const textureDataURL = event.target.result;
      const topMaterialColor = topColor.value;

      await tryApplyMaterialTexture(
        modelViewer,
        materialName,
        textureDataURL,
        topMaterialColor
      );
    };
    reader.readAsDataURL(file);
  }

  function createRenderedCard(textureDataURL, title, topMaterialColor, modelSrcForCard, snapshotDataURL = null, backgroundColor = "#ffffff") {
    const card = document.createElement("div");
    card.className = "rendered-card";
    card.dataset.id = cardCounter++;
    card.dataset.textureDataUrl = textureDataURL;
    card.dataset.title = title;
    card.dataset.topMaterialColor = topMaterialColor;
    card.dataset.modelSrc = modelSrcForCard;
    card.dataset.backgroundColor = backgroundColor;
    card.dataset.selectedLogo = ""; // Store selected logo for this card
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
    <p style="font-size: 0.7vw; margin: 5px 0; font-weight: bold;">Select Logo:</p>
    <div class="card-logo-options">
      <img src="./assets/Logo/terratechpacks.png" data-logo="./assets/Logo/terratechpacks.png" 
           class="card-selectable-logo" style="width:3vw; cursor: pointer; border: 2px solid #ccc; padding: 2px;" />
      <img src="./assets/Logo/terratechpacks_white.png" data-logo="./assets/Logo/terratechpacks_white.png" 
           class="card-selectable-logo" style="width: 3vw; cursor: pointer; border: 2px solid #ccc; padding: 2px;" />
      <img src="./assets/Logo/white.png" data-logo="./assets/Logo/white.png" 
           class="card-selectable-logo" style="width: 3vw; cursor: pointer; border: 2px solid #ccc; padding: 2px;" />
    </div>
  `;

    // Use snapshot image if available
    if (snapshotDataURL) {
      const snapshotImg = document.createElement("img");
      snapshotImg.src = snapshotDataURL;
      snapshotImg.style.width = "100%";
      snapshotImg.style.height = "100%";
      snapshotImg.style.objectFit = "contain";
      snapshotImg.style.pointerEvents = "none";

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
      cardModelViewer.setAttribute("rotate", "null");
      cardModelViewer.setAttribute("exposure", "1");
      cardModelViewer.setAttribute("shadow-intensity", "0.5");
      cardModelViewer.setAttribute("disable-tap", "");
      cardModelViewer.setAttribute("disable-pan", "");
      cardModelViewer.setAttribute("ar", "");
      cardModelViewer.setAttribute("interaction-prompt", "none");
      // const currentRotationY = baseRotationY + currentScrollRotation;
      // cardModelViewer.setAttribute("camera-orbit", `${currentRotationY}deg 84.49deg 0.4649m`);
      cardModelViewer.setAttribute("field-of-view", "33deg");
      cardModelViewer.style.width = "150px";
      cardModelViewer.style.height = "150px";
      cardModelViewer.style.pointerEvents = "none";

      cardModelViewer.addEventListener("load", async () => {
        await tryApplyMaterialTexture(
          cardModelViewer,
          materialName,
          textureDataURL,
          topMaterialColor
        );
      });

      card.appendChild(deleteBtn);
      card.appendChild(checkbox);
      card.appendChild(optionTheme);
      card.appendChild(cardModelViewer);
      card.appendChild(logoSelectionDiv);
    }

    // Add event listener for logo selection within this card
    logoSelectionDiv.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card selection
      if (e.target.classList.contains('card-selectable-logo')) {
        // Remove selection from all logos in this card
        logoSelectionDiv.querySelectorAll('.card-selectable-logo').forEach(logo => {
          logo.style.border = '2px solid #ccc';
        });
        // Highlight selected logo
        e.target.style.border = '2px solid green';
        // Store selected logo in card dataset
        card.dataset.selectedLogo = e.target.dataset.logo;
      }
    });

    card.onclick = (e) => {
      if (e.target === checkbox || e.target === deleteBtn ||
        e.target.classList.contains('card-selectable-logo')) return;
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
  }

  // Event listeners
  textureTitle.addEventListener("input", checkFormValidity);
  textureFile.addEventListener("change", () => {
    const fileName = document.getElementById("fileName");
    const fileWarning = document.getElementById("fileWarning");

    if (textureFile.files.length > 0) {
      fileName.textContent = textureFile.files[0].name;
      fileWarning.style.display = "none";
    } else {
      fileName.textContent = "No file chosen";
    }

    checkFormValidity();
    updateMainModelViewer();
  });
  topColor.addEventListener("change", updateMainModelViewer);

  renderBtn.addEventListener("click", async () => {
    const file = textureFile.files[0];
    const title = textureTitle.value.trim();
    const topMaterialColor = topColor.value;
    const backgroundColor = bgColor.value;
    const fileName = document.getElementById("fileName");

    // Get warning elements
    const titleWarning = document.getElementById("titleWarning");
    const fileWarning = document.getElementById("fileWarning");

    // Reset warnings
    titleWarning.style.display = "none";
    fileWarning.style.display = "none";

    // Validate
    let isValid = true;

    if (!title) {
      titleWarning.style.display = "block";
      // Auto-hide after 5 seconds
      setTimeout(() => {
        titleWarning.style.display = "none";
      }, 2000);
      isValid = false;
    }

    if (!file) {
      fileWarning.style.display = "block";
      // Auto-hide after 5 seconds
      setTimeout(() => {
        fileWarning.style.display = "none";
      }, 2000);
      isValid = false;
    }


    // Stop if validation fails
    if (!isValid) {
      return;
    }


    const reader = new FileReader();
    reader.onload = async (event) => {
      const textureDataURL = event.target.result;
      const currentModelSrc = modelViewer.getAttribute("src");


      let snapshotDataURL = null;
      try {
        // Create a temporary canvas to composite model with background
        const blob = await modelViewer.toBlob({ idealAspect: false });
        const modelImg = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = reader.result;
          };
          reader.readAsDataURL(blob);
        });

        // Create canvas with background color
        const canvas = document.createElement('canvas');
        canvas.width = modelImg.width;
        canvas.height = modelImg.height;
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw model on top
        ctx.drawImage(modelImg, 0, 0);

        // Convert to data URL
        snapshotDataURL = canvas.toDataURL('image/png');
        console.log("Snapshot with background captured successfully");
      } catch (err) {
        console.error("Failed to capture model snapshot:", err);
      }

      const card = createRenderedCard(textureDataURL, title, topMaterialColor, currentModelSrc, snapshotDataURL, backgroundColor);
      renderedImages.appendChild(card);
      renderedModels.push(card);
      card.classList.add("selected");
      updateSelectionInfo();

      // Clear form
      textureTitle.value = "";
      textureFile.value = "";
      fileName.textContent = "No file chosen";

      topColor.value = "#ffffff";
      bgColor.value = "#ffffff";

      modelbg.style.backgroundColor = "white";
      checkFormValidity();

      // Reset model materials
      if (!modelViewer.model) {
        await new Promise(res => modelViewer.addEventListener("load", res, { once: true }));
      }

      const bottomMat = modelViewer.model.materials.find(m => m.name === materialName);
      if (bottomMat) {
        if (originalBottomTexture) {
          bottomMat.pbrMetallicRoughness.baseColorTexture.setTexture(originalBottomTexture);
        } else {
          bottomMat.pbrMetallicRoughness.baseColorTexture.setTexture(null);
        }

        bottomMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
        bottomMat.setAlphaMode("OPAQUE");
      }

      const topMat = modelViewer.model.materials.find(m => m.name === TopmaterialName);
      if (topMat) {
        topMat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
      }
    };
    reader.readAsDataURL(file);
  });

  // Lid color picker via image
  document.getElementById("topColorImg").addEventListener("click", function () {
    document.getElementById("topColor").click();
  });
  document.getElementById("topColor").addEventListener("input", function (e) {
    const pickedColor = e.target.value;
    const topMat = modelViewer.model?.materials?.find(m => m.name === TopmaterialName);
    if (topMat) {
      const rgb = hexToRgbArray(pickedColor);
      topMat.pbrMetallicRoughness.setBaseColorFactor([...rgb, 1]);
    }
  });

  // BG color picker via image
  document.getElementById("bgColorImg").addEventListener("click", function () {
    document.getElementById("bgColor").click();
  });
  document.getElementById("bgColor").addEventListener("input", function (e) {
    modelbg.style.backgroundColor = e.target.value;
  });

  const selectAllToggle = document.getElementById("selectAllToggle");

  selectAllToggle.addEventListener("change", () => {
    const allCards = document.querySelectorAll(".rendered-card");
    renderedModels = [];

    if (selectAllToggle.checked) {
      allCards.forEach(card => {
        card.classList.add("selected");
        const checkbox = card.querySelector(".selection-checkbox");
        if (checkbox) checkbox.checked = true;
        renderedModels.push(card);
      });
    } else {
      allCards.forEach(card => {
        card.classList.remove("selected");
        const checkbox = card.querySelector(".selection-checkbox");
        if (checkbox) checkbox.checked = false;
      });
    }

    updateSelectionInfo();
  });

  renderedImages.addEventListener("change", (event) => {
    if (event.target.classList.contains("selection-checkbox")) {
      const allCheckboxes = renderedImages.querySelectorAll(".selection-checkbox");
      const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);

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
          renderedModels = renderedModels.filter(c => c !== card);
        }
      }

      updateSelectionInfo();
    }
  });

  // Custom logo upload preview
  customLogoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        customLogoPreview.src = event.target.result;
        customLogoPreview.style.display = 'block';
        customLogoPreview.dataset.preview = event.target.result;
      };
      reader.readAsDataURL(file);
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

  const clearAllBtn = document.getElementById('clearAllBtn');

  function toggleClearButtonState() {
    if (window.renderedModels && window.renderedModels.length === 0) {
      clearAllBtn.disabled = true;
      clearAllBtn.style.cursor = "none";
    } else {
      clearAllBtn.disabled = false;
    }
  }

  clearAllBtn.addEventListener('click', () => {
    const confirmClear = confirm('Are you sure you want to clear all rendered models?');

    if (confirmClear) {
      if (window.renderedModels) {
        window.renderedModels.length = 0;
      }

      renderedImages.innerHTML = '';
      console.log('Cleared all rendered models');
      alert('All rendered models have been cleared!');
      toggleClearButtonState();
    } else {
      console.log('Clearing action was canceled');
    }
  });

  toggleClearButtonState();

  const models = [
    {
      name: '500ml Model',
      frontSrc: './assets/Model_Export/500ml Round A-1 .glb',
      angles: [
        { name: 'Front', src: './assets/Model_Export/500ml Round A-1 .glb', cameraOrbit: '0deg 75deg 0.3644m', minCameraOrbit: '-Infinity auto 0.55m' },
        { name: 'Side', src: './assets/Model_Export/500ml Round A-2 .glb', cameraOrbit: '20deg 87deg 0.7649m', minCameraOrbit: '-Infinity auto 0.55m' },
        { name: 'Back', src: './assets/Model_Export/500ml Round A-3 .glb', cameraOrbit: '-340.4999816894526deg 84.49deg 0.7649m', minCameraOrbit: '-Infinity auto 0.65m' }
      ]
    },
    {
      name: '250ml Model',
      frontSrc: './assets/Model_Export/250  SB A-1.glb',
      angles: [
        { name: 'Front', src: './assets/Model_Export/250  SB A-1.glb', cameraOrbit: '0deg 90deg 0.5m', minCameraOrbit: '-Infinity auto 1.15m' },
        { name: 'Side', src: './assets/Model_Export/250  SB A-2.glb', cameraOrbit: '337deg 68deg 0.5m', minCameraOrbit: '-Infinity auto 1.15m' },
        { name: 'Back', src: './assets/Model_Export/250  SB A-3.glb', cameraOrbit: '320deg 70deg 0.65m', minCameraOrbit: '-Infinity auto 1.49m' }
      ]
    }
  ];

  const angleIcons = {
    '500ml': {
      Front: './assets/Angles/500ml/500ml_angle1.webp',
      Side: './assets/Angles/500ml/500ml_angle2.webp',
      Back: './assets/Angles/500ml/500ml_angle3.webp',
    },
    '250ml': {
      Front: './assets/Angles/250ml/250ml_1.webp',
      Side: './assets/Angles/250ml/250ml_2.webp',
      Back: './assets/Angles/250ml/250ml_3.webp',
    }
  };

  const modelContainer = document.getElementById('modelcardContainer');
  const angleContainer = document.getElementById('angleCardContainer');
  const mainModelViewer = document.getElementById('modelViewer');

  let selectedModelIndex = null;
  let selectedAngleIndex = null;

  function renderModels() {
    modelContainer.innerHTML = '';
    models.forEach((model, i) => {
      const modelCard = document.createElement('div');
      modelCard.style.cursor = 'pointer';
      modelCard.style.padding = '10px';
      modelCard.style.marginBottom = '5px';
      modelCard.style.border = '1px solid #ccc';
      modelCard.style.borderRadius = '5px';
      modelCard.style.textAlign = 'center';
      modelCard.style.width = "13vw";
      modelCard.style.height = "8vw";
      modelCard.style.boxSizing = "border-box";
      modelCard.style.display = "flex";
      modelCard.style.flexDirection = "column"
      modelCard.style.alignItems = "center";
      modelCard.style.justifyContent = "center";

      const mv = document.createElement('model-viewer');
      mv.src = model.frontSrc;
      mv.style.width = "100%";
      mv.style.height = "100%";
      mv.style.objectFit = "contain";
      mv.setAttribute("disable-tap", "");
      mv.setAttribute("disable-pan", "");
      mv.setAttribute("interaction-prompt", "none");
      mv.setAttribute("camera-orbit", model.angles[0].cameraOrbit);
      mv.setAttribute("field-of-view", "25deg");
      mv.setAttribute("shadow-intensity", "0.5");
      mv.setAttribute("exposure", "1");

      const label = document.createElement('div');
      label.textContent = model.name;
      label.style.fontSize = "0.85vw";
      label.style.fontWeight = "600";
      label.style.marginTop = "0.5vw";

      modelCard.appendChild(mv);
      modelCard.appendChild(label);

      modelCard.addEventListener('click', () => {
        selectedModelIndex = i;
        selectedAngleIndex = 0;

        highlightSelected(modelContainer, selectedModelIndex);
        renderAngles();
        highlightSelected(angleContainer, 0);
        updateMainViewer();
      });

      modelContainer.appendChild(modelCard);
    });

    if (models.length > 0) {
      selectedModelIndex = 0;
      selectedAngleIndex = 0;

      highlightSelected(modelContainer, 0);
      renderAngles();
      setTimeout(() => {
        highlightSelected(angleContainer, 0);
      }, 100);
      updateMainViewer();
    }
  }

  function renderAngles() {
    angleContainer.innerHTML = '';

    if (selectedModelIndex === null) return;

    const selectedModel = models[selectedModelIndex];
    const modelName = selectedModel.name.includes('500ml') ? '500ml' : '250ml';
    const iconSet = angleIcons[modelName];

    selectedModel.angles.forEach((angle, i) => {
      const angleCard = document.createElement('div');
      angleCard.style.cursor = 'pointer';
      angleCard.style.border = '1px solid #ccc';
      angleCard.style.borderRadius = '5px';
      angleCard.style.padding = '8px';
      angleCard.style.display = 'inline-block';
      angleCard.style.margin = '0 20px ';
      angleCard.style.minWidth = '6.5vw';
      angleCard.style.textAlign = 'center';

      const img = document.createElement('img');
      img.src = iconSet[angle.name];
      img.alt = angle.name;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";
      img.style.margin = "0";


      const label = document.createElement('div');
      label.textContent = angle.name;
      label.style.fontSize = "12px";
      label.style.textAlign = "center";

      angleCard.appendChild(img);
      // angleCard.appendChild(label);

      angleCard.addEventListener('click', () => {
        selectedAngleIndex = i;
        highlightSelected(angleContainer, selectedAngleIndex);
        updateMainViewer();
      });

      angleContainer.appendChild(angleCard);
    });
  }

  function updateMainViewer() {
    if (selectedModelIndex === null || selectedAngleIndex === null) return;

    const selectedAngle = models[selectedModelIndex].angles[selectedAngleIndex];
    mainModelViewer.setAttribute('src', selectedAngle.src);
    mainModelViewer.setAttribute('min-camera-orbit', selectedAngle.minCameraOrbit);

    // Parse the stored camera orbit to get rotation angles
    const orbitParts = selectedAngle.cameraOrbit.split(' ');
    const rotationX = orbitParts[0]; // e.g., '0deg'
    const rotationY = orbitParts[1]; // e.g., '75deg'

    // Reset zoom to default when changing models/angles
    currentZoom = zoomLevels[0];
    currentZoomIndex = 0;

    // Apply stored rotation with current zoom level
    mainModelViewer.setAttribute('camera-orbit', `${rotationX} ${rotationY} ${currentZoom}m`);
  }


  function highlightSelected(container, index) {
    Array.from(container.children).forEach((child, i) => {
      child.style.borderColor = i === index ? 'green' : '#ccc';
    });
  }

  renderModels();
  renderAngles();

  // --- PDF-specific model viewer creation ---
  async function createPDFModelViewer(modelSrcForCard, textureDataURL, topMaterialColor = null, customSize = 800) {
    console.log("Creating PDF model viewer...");

    const pdfModelViewer = document.createElement("model-viewer");
    pdfModelViewer.src = modelSrcForCard || modelSrc;
    pdfModelViewer.setAttribute("camera-orbit", "-540.9deg 84.49deg 0.4649m");
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
    pdfModelViewer.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
    pdfModelViewer.style.border = "2px solid #ccc";
    pdfModelViewer.style.borderRadius = "10px";
    pdfModelViewer.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";

    document.body.appendChild(pdfModelViewer);
    console.log("PDF model viewer added to DOM");

    let attempts = 0;
    const maxAttempts = 50;

    while (!pdfModelViewer.model && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
      console.log(`Waiting for model to load... attempt ${attempts}`);
    }

    if (!pdfModelViewer.model) {
      console.error("Model failed to load after", maxAttempts * 200, "ms");
      return null;
    }

    console.log("Model loaded successfully");
    console.log("Applying texture and color...");
    await tryApplyMaterialTexture(pdfModelViewer, materialName, textureDataURL, topMaterialColor);
    console.log("Texture and color applied");

    await new Promise((r) => setTimeout(r, 2000));
    console.log("Ready for capture");

    return { pdfModelViewer };
  }

  // --- Capture from PDF model viewer ---
  async function capturePDFModelImage(pdfModelViewer) {
    if (!pdfModelViewer) {
      console.error("No model viewer provided");
      return null;
    }

    console.log("Attempting to capture image...");

    let canvas = null;

    if (pdfModelViewer.shadowRoot) {
      canvas = pdfModelViewer.shadowRoot.querySelector("canvas");
      console.log("Canvas from shadow root:", canvas);
    }

    if (!canvas) {
      canvas = pdfModelViewer.querySelector("canvas");
      console.log("Canvas from direct query:", canvas);
    }

    if (canvas) {
      try {
        console.log("Canvas dimensions:", canvas.width, "x", canvas.height);
        const dataURL = canvas.toDataURL("image/png", 1.0);
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
      await new Promise((res) => { bgImage.onload = res; });

      pdf.addImage(bgImage, "PNG", 0, 0, pageWidth, pageHeight);

      const terraLogo1 = new Image();
      terraLogo1.src = "./assets/Logo/terratechpacks.png";

      const customLogo = new Image();
      customLogo.src =
        document.getElementById("customLogoInput")?.dataset.preview ||
        "./assets/Logo/terratechpacks.png";

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
        terraHeight
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
        customHeight
      );
      currentY1 += customHeight + 40;

      // --- Option Pages ---
      const headerHeight = 110;
      const footerHeight = 60;
      const sideMargin = 30;
      const availableWidth = pageWidth - sideMargin * 2;
      const availableHeight = pageHeight - headerHeight - footerHeight;
      const contentCenterX = pageWidth / 2;
      const contentCenterY = pageHeight / 2;
      const pdfModelSize = 800;

      const terraLogo = new Image();
      terraLogo.src = window.selectedLogoSrc || "./assets/Logo/terratechpacks.png";

      await Promise.race([
        new Promise((res) => (terraLogo.onload = res)),
        new Promise((res) => setTimeout(res, 1000)),
      ]);

      for (let i = 0; i < sortedModels.length; i++) {
        pdf.addPage();

        const card = sortedModels[i];
        const modelTitle = card.dataset.title || "Untitled";
        const textureDataURL = card.dataset.textureDataUrl;
        const topMaterialColor = card.dataset.topMaterialColor || "#ffffff";
        const backgroundColor = card.dataset.backgroundColor || "#f5d2da";
        const modelSrcForCard = card.dataset.modelSrc;
        const snapshotDataURL = card.dataset.snapshot;
        const cardLogoSrc = card.dataset.selectedLogo || window.selectedLogoSrc || "./assets/Logo/terratechpacks.png"; // Use card-specific logo

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
        pdf.text(`Option - ${card.dataset.id}`, pageWidth / 2, 70, { align: "center" });

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
          const logoWidth = (cardLogo.naturalWidth * logoHeight) / cardLogo.naturalHeight;
          const topMargin = 60;
          pdf.addImage(
            cardLogo,
            "PNG",
            pageWidth - logoWidth - 25,
            topMargin,
            logoWidth,
            logoHeight
          );
        }

        // Use snapshot if available, otherwise capture new image
        let modelImageData = snapshotDataURL;

        if (!modelImageData && textureDataURL) {
          try {
            const result = await createPDFModelViewer(
              modelSrcForCard,
              textureDataURL,
              topMaterialColor,
              pdfModelSize
            );
            if (result) {
              const pdfModelViewer = result.pdfModelViewer;
              modelImageData = await capturePDFModelImage(pdfModelViewer);
              if (pdfModelViewer && document.body.contains(pdfModelViewer)) {
                document.body.removeChild(pdfModelViewer);
              }
            }
          } catch (error) {
            console.error("Model capture failed:", error);
          }
        }

        if (modelImageData) {
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
            finalWidth = availableWidth * 0.95;
            finalHeight = finalWidth / imageAspectRatio;
          } else {
            finalHeight = availableHeight * 0.95;
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
            finalHeight
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
          { align: "center" }
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
        const textureDataUrl = sortedModels[i].dataset.textureDataUrl;
        if (!textureDataUrl) continue;

        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const aspectRatio = img.width / img.height;

            let imgWidth = maxImageWidth;
            let imgHeight = imgWidth / aspectRatio;

            if (imgHeight > maxHeightPerImage) {
              imgHeight = maxHeightPerImage;
              imgWidth = imgHeight * aspectRatio;
            }

            const imageX = (pageWidth - imgWidth) / 2;
            pdf.addImage(img, "PNG", imageX, currentY, imgWidth, imgHeight);

            currentY += imgHeight + spaceBetween;
            resolve();
          };
          img.onerror = reject;
          img.src = textureDataUrl;
        });
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
        { align: "center" }
      );

      // Save PDF
      console.log("Saving PDF...");
      pdf.save(`Selected_Theme_Mockup_${new Date().toISOString().slice(0, 10)}.pdf`);
      console.log("PDF saved successfully!");

    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("PDF Export failed. Check console for details.");
    } finally {
      loadingOverlay.style.display = "none";
    }
  });

  renderedImages.addEventListener('wheel', function (e) {
    if (e.deltaY !== 0) {
      e.preventDefault();
      renderedImages.scrollBy({
        left: e.deltaY,
        behavior: 'smooth'
      });
    }
  }, { passive: false });

  // Initialize
  checkFormValidity();
  updateSelectionInfo();

  // Make renderedModels globally accessible
  window.renderedModels = renderedModels;

  console.log("🔄 Model Rotation Controls:");
  console.log("• Mouse wheel / trackpad scroll to rotate");
  console.log("• Touch and drag on mobile");
  console.log("• Arrow keys (Left/Right) for precise control");
  console.log("• Press 'R' to reset rotation");
});