document.addEventListener('DOMContentLoaded', () => {
      const authContainer = document.getElementById('auth-container');
      const switchToSignupBtn = document.getElementById('switch-to-signup');
      const switchToSigninBtn = document.getElementById('switch-to-signin');

      const signInForm = document.getElementById('sign-in-form');
      const signUpForm = document.getElementById('sign-up-form');

      
  // Function to toggle forms and save state
  function showSignIn() {
    authContainer.classList.remove('active');
    clearFormErrors(signInForm);
    clearFormErrors(signUpForm);
    localStorage.setItem('authActiveTab', 'signin');  // Save state
  }

  function showSignUp() {
    authContainer.classList.add('active');
    clearFormErrors(signInForm);
    clearFormErrors(signUpForm);
    localStorage.setItem('authActiveTab', 'signup');  // Save state
  }

  // Event Listeners to switch tabs
  switchToSignupBtn.addEventListener('click', showSignUp);
  switchToSigninBtn.addEventListener('click', showSignIn);

  // On page load, check saved state and set form
  const savedTab = localStorage.getItem('authActiveTab');
  if (savedTab === 'signup') {
    showSignUp();
  } else {
    showSignIn();
  }

      switchToSignupBtn.addEventListener('click', () => {
        authContainer.classList.add('active');
        clearFormErrors(signInForm);
        clearFormErrors(signUpForm);
      });

      switchToSigninBtn.addEventListener('click', () => {
        authContainer.classList.remove('active');
        clearFormErrors(signInForm);
        clearFormErrors(signUpForm);
      });

      function clearFormErrors(form) {
        const errorMessages = form.querySelectorAll('.error-message');
        errorMessages.forEach(em => {
          em.textContent = '';
          em.style.display = 'none';
        });
      }

      function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email.toLowerCase());
      }

      function validatePassword(password) {
        return password.length >= 8;
      }

      function attachRealtimeValidation(form) {
        form.querySelectorAll('input').forEach(input => {
          input.addEventListener('input', () => {
            validateField(input, form);
          });
        });
      }

      function validateField(input, form) {
        const errorEl = input.nextElementSibling;
        const val = input.value.trim();

        if (input.type === 'email' && !validateEmail(val)) {
          errorEl.textContent = 'Please enter a valid email address.';
          errorEl.style.display = 'block';
          return false;
        }

        if (input.type === 'password' && !validatePassword(val)) {
          errorEl.textContent = 'Password must be at least 8 characters.';
          errorEl.style.display = 'block';
          return false;
        }

        if (input.id === 'signup-confirm-password') {
          const pwd = form.querySelector('#signup-password').value;
          if (val !== pwd) {
            errorEl.textContent = 'Passwords do not match.';
            errorEl.style.display = 'block';
            return false;
          }
        }

        if (input.hasAttribute('required') && val === '') {
          errorEl.textContent = 'This field is required.';
          errorEl.style.display = 'block';
          return false;
        }

        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return true;
      }

      signInForm.addEventListener('submit', e => {
  e.preventDefault();
  clearFormErrors(signInForm);

  let valid = true;

  // Correctly select inputs from the signInForm
  const usernameInput = signInForm.querySelector('#signin-name');
  const passInput = signInForm.querySelector('#signin-password');
  const rememberCheckbox = signInForm.querySelector('#signin-check');

  if (usernameInput.value.trim() === '') {
    showError(usernameInput, 'Please enter your username.');
    valid = false;
  }

  if (!validatePassword(passInput.value.trim())) {
    showError(passInput, 'Password must be at least 8 characters.');
    valid = false;
  }

  if (!rememberCheckbox.checked) {
    alert('You must check the remember box.');
    valid = false;
  }

  if (valid) {
  const data = {
    username: usernameInput.value.trim(),
    password: passInput.value.trim(),
    remember: rememberCheckbox.checked
  };

  fetch('https://terratechpacks.com/App_3D/signin_user.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert('Sign In Successful!');
      console.log('Sign In Response:', result);
      signInForm.reset();
      window.location.href = 'admin.html';
    } else {
      alert('Login failed: ' + result.message);
    }
  })
  .catch(err => {
    console.error('Fetch error:', err);
    alert('An error occurred during login.');
  });
}


});

      signUpForm.addEventListener('submit', e => {
  e.preventDefault();
  clearFormErrors(signUpForm);

  let valid = true;

 

  const nameInput = signUpForm.querySelector('#signup-name');
  const passInput = signUpForm.querySelector('#signup-password');
  const confirmPassInput = signUpForm.querySelector('#signup-confirm-password');
  const termsCheckbox = signUpForm.querySelector('#signup-check');

  if (nameInput.value.trim() === '') {
    showError(nameInput, 'Please enter your username.');
    valid = false;
  }

  if (!validatePassword(passInput.value.trim())) {
    showError(passInput, 'Password must be at least 8 characters.');
    valid = false;
  }

  if (confirmPassInput.value.trim() !== passInput.value.trim()) {
    showError(confirmPassInput, 'Passwords do not match.');
    valid = false;
  }

  if (!termsCheckbox.checked) {
    alert('You must agree to the Terms & Conditions.');
    valid = false;
  }

  if (valid) {
    const data = {
      username: nameInput.value.trim(),
      password: passInput.value.trim(),
      agreedToTerms: termsCheckbox.checked
    };

    console.log(data);

    fetch('https://terratechpacks.com/App_3D/insert_user.php', {  // Replace with your actual sign-up API URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        alert('Sign Up Successful!');
        signUpForm.reset();
        
      } else {
        alert('Sign Up Failed: ' + result.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('An error occurred during sign up.');
    });
  }
});


      function showError(input, message) {
        const errorEl = input.nextElementSibling;
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }

      attachRealtimeValidation(signInForm);
      attachRealtimeValidation(signUpForm);
    });