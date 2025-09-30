const headers = document.querySelectorAll(".accordion-header");

headers.forEach((header) => {
  const content = header.nextElementSibling;

  // Watch content height changes in real time
  const resizeObserver = new ResizeObserver(() => {
    if (header.classList.contains("active")) {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
  resizeObserver.observe(content);

  header.addEventListener("click", () => {
    const isOpen = header.classList.contains("active");

    // Close all others
    headers.forEach((h) => {
      if (h !== header) {
        h.classList.remove("active");
        h.nextElementSibling.style.maxHeight = null;
        h.querySelector(".drop").className = "fa-solid fa-angle-down drop";
      }
    });

    // Toggle current
    if (isOpen) {
      header.classList.remove("active");
      content.style.maxHeight = null;
      header.querySelector(".drop").className = "fa-solid fa-angle-down drop";
    } else {
      header.classList.add("active");
      content.style.maxHeight = content.scrollHeight + "px";
      header.querySelector(".drop").className = "fa-solid fa-angle-up drop";
    }
  });
});




