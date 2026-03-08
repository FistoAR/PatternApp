document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const switchToSignupBtn = document.getElementById("switch-to-signup");
  const switchToSigninBtn = document.getElementById("switch-to-signin");

  const signInForm = document.getElementById("sign-in-form");
  const signUpForm = document.getElementById("sign-up-form");

  // Function to show Sign In form
  function showSignIn() {
    authContainer.classList.remove("active"); // moves panel
    signInForm.classList.add("active"); // shows sign-in
    signUpForm.classList.remove("active"); // hides sign-up
    clearFormErrors(signInForm);
    clearFormErrors(signUpForm);
    localStorage.setItem("authActiveTab", "signin");
  }

  // Function to show Sign Up form
  function showSignUp() {
    authContainer.classList.add("active"); // moves panel
    signUpForm.classList.add("active"); // shows sign-up
    signInForm.classList.remove("active"); // hides sign-in
    clearFormErrors(signInForm);
    clearFormErrors(signUpForm);
    localStorage.setItem("authActiveTab", "signup");
  }

  // Event Listeners for switching between forms
  if (switchToSignupBtn) {
    switchToSignupBtn.addEventListener("click", showSignUp);
  }
  if (switchToSigninBtn) {
    switchToSigninBtn.addEventListener("click", showSignIn);
  }

  // Initialize based on saved state
  const savedTab = localStorage.getItem("authActiveTab");
  if (savedTab === "signup") {
    showSignUp();
  } else {
    showSignIn();
  }

  // --- Custom Alert Logic ---
  const alertModal = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const closeAlertBtn = document.getElementById("close-alert");

  function showCustomAlert(message, title = "Attention") {
    document.getElementById("alert-title").textContent = title;
    alertMessage.textContent = message;
    alertModal.classList.add("show");
  }

  function hideCustomAlert() {
    alertModal.classList.remove("show");
  }

  closeAlertBtn.addEventListener("click", hideCustomAlert);

  // Close alert on click outside
  alertModal.addEventListener("click", (e) => {
    if (e.target === alertModal) hideCustomAlert();
  });

  // --- Validation & Form Logic (unchanged, but included for completeness) ---

  function clearFormErrors(form) {
    const errorMessages = form.querySelectorAll(".error-message");
    errorMessages.forEach((em) => {
      em.textContent = "";
      em.style.display = "none";
    });
    form
      .querySelectorAll(".custom-check")
      .forEach((cc) => cc.classList.remove("error"));
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.toLowerCase());
  }

  function validatePassword(password) {
    return password.length >= 8;
  }

  function attachRealtimeValidation(form) {
    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        validateField(input, form);
      });
    });
  }

  function getErrorMessageElement(input) {
    const parent = input.closest(".input-group") || input.closest(".options");
    return parent ? parent.querySelector(".error-message") : null;
  }

  function validateField(input, form) {
    const errorEl = getErrorMessageElement(input);
    const val = input.value.trim();

    if (input.type === "email" && !validateEmail(val)) {
      errorEl.textContent = "Please enter a valid email address.";
      errorEl.style.display = "block";
      return false;
    }

    if (input.type === "password" && !validatePassword(val)) {
      errorEl.textContent = "Password must be at least 8 characters.";
      errorEl.style.display = "block";
      return false;
    }

    if (input.id === "signup-confirm-password") {
      const pwd = form.querySelector("#signup-password").value;
      if (val !== pwd) {
        errorEl.textContent = "Passwords do not match.";
        errorEl.style.display = "block";
        return false;
      }
    }

    if (input.hasAttribute("required") && val === "") {
      errorEl.textContent = "This field is required.";
      errorEl.style.display = "block";
      return false;
    }

    errorEl.textContent = "";
    errorEl.style.display = "none";
    return true;
  }
  function showError(input, message) {
    const errorEl = getErrorMessageElement(input);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }
  }

  // --- Password Toggle Logic ---
  document.querySelectorAll(".toggle-password").forEach((eye) => {
    eye.addEventListener("click", function (e) {
      e.preventDefault();
      const input = this.parentElement.querySelector("input");
      if (input.type === "password") {
        input.type = "text";
        this.classList.remove("fa-eye");
        this.classList.add("fa-eye-slash");
      } else {
        input.type = "password";
        this.classList.remove("fa-eye-slash");
        this.classList.add("fa-eye");
      }
    });
  });

  // Sign In Submit
  signInForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFormErrors(signInForm);

    let valid = true;
    const usernameInput = signInForm.querySelector("#signin-name");
    const passInput = signInForm.querySelector("#signin-password");

    if (!validatePassword(passInput.value.trim())) {
      showCustomAlert(
        "Password must be at least 8 characters.",
        "Security Rule",
      );
      showError(passInput, "Password must be at least 8 characters.");
      valid = false;
    } else if (usernameInput.value.trim() === "") {
      showError(usernameInput, "Please enter your username.");
      valid = false;
    }

    if (valid) {
      const data = {
        username: usernameInput.value.trim(),
        password: passInput.value.trim(),
      };

      fetch("https://terratechpacks.com/App_3D/signin_user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            localStorage.setItem("isLoggedIn", "true");
            showCustomAlert("Sign In Successful!", "Success");
            signInForm.reset();
            window.location.href = "admin.html";
          } else {
            showCustomAlert("Login failed: " + result.message, "Error");
          }
        })
        .catch((err) => {
          console.error("Fetch error:", err);
          showCustomAlert(
            "An error occurred during login. Please try again.",
            "Error",
          );
        });
    }
  });

  // Sign Up Submit
  signUpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFormErrors(signUpForm);

    let valid = true;
    const nameInput = signUpForm.querySelector("#signup-name");
    const passInput = signUpForm.querySelector("#signup-password");
    const confirmPassInput = signUpForm.querySelector(
      "#signup-confirm-password",
    );
    const termsCheckbox = signUpForm.querySelector("#signup-check");

    if (!validatePassword(passInput.value.trim())) {
      showCustomAlert(
        "Password must be at least 8 characters.",
        "Security Rule",
      );
      showError(passInput, "Too short");
      valid = false;
    } else if (confirmPassInput.value.trim() !== passInput.value.trim()) {
      showCustomAlert(
        "Confirmation password does not match with password.",
        "Mismatch",
      );
      showError(confirmPassInput, "Mismatch");
      valid = false;
    } else if (!termsCheckbox.checked) {
      showCustomAlert(
        "You must agree to the Terms & Conditions to create an account.",
        "Validation Alert",
      );
      showError(termsCheckbox, "Please agree to terms");
      termsCheckbox.closest(".custom-check").classList.add("error");
      valid = false;
    } else if (nameInput.value.trim() === "") {
      showCustomAlert(
        "Please enter a username for your new account.",
        "Required",
      );
      showError(nameInput, "Required");
      valid = false;
    }

    if (valid) {
      const data = {
        username: nameInput.value.trim(),
        password: passInput.value.trim(),
        agreedToTerms: termsCheckbox.checked,
      };

      fetch("https://terratechpacks.com/App_3D/insert_user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((result) => {
          if (result.success) {
            showCustomAlert(
              "Sign Up Successful! You can now sign in.",
              "Success",
            );
            signUpForm.reset();
          } else {
            showCustomAlert("Sign Up Failed: " + result.message, "Error");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          showCustomAlert(
            "An error occurred during sign up. Please try again.",
            "Error",
          );
        });
    }
  });

  // Attach real-time validation
  attachRealtimeValidation(signInForm);
  attachRealtimeValidation(signUpForm);
});
