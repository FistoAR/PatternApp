const mainContent = document.getElementById("main-content");
const sidebarLinks = {
  "category-link": "category.html",
  "pattern-link": "pattern.html",
};

// Attach event listeners to each link
Object.entries(sidebarLinks).forEach(([id, page]) => {
  const link = document.getElementById(id);
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      loadPage(page);
      localStorage.setItem("activePage", page);
    });
  }
});

// Load saved page on refresh (default category.html)
const savedPage = localStorage.getItem("activePage") || "category.html";
loadPage(savedPage);

// Reusable function to load HTML into main content
function loadPage(page) {
  if (!mainContent) {
    console.error("#main-content not found in DOM");
    return;
  }

  fetch(page)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${page}`);
      return res.text();
    })
    .then((html) => {
      mainContent.innerHTML = html;

      // Trigger initialization based on loaded page
      if (page === "category.html" && typeof initCategoryPage === "function") {
        initCategoryPage();
      }
      if (page === "pattern.html" && typeof initPatternPage === "function") {
        initPatternPage();
      }
    })
    .catch((err) => {
      mainContent.innerHTML = `<p style="color:red;">${err.message}</p>`;
      console.error(err);
    });

  // Update active link styling
  Object.keys(sidebarLinks).forEach((id) => {
    const link = document.getElementById(id);
    if (link) link.classList.remove("active");
  });

  const activeLink = Object.entries(sidebarLinks).find(
    ([, path]) => path === page
  );
  if (activeLink) {
    const link = document.getElementById(activeLink[0]);
    if (link) link.classList.add("active");
  }
}
