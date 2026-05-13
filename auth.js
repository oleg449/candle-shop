// Authentication JavaScript
// Use dynamic API base for Render or any host. If the static site runs on port 8000,
// the Node API still lives on port 3000.
const API_BASE_URL = (() => {
    if (typeof window === 'undefined') return '/api';
    if (window.API_BASE_URL) return window.API_BASE_URL;
    if (window.location.protocol === 'file:' || window.location.port === '8000') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();
const SESSION_FLAG_KEY = 'sessionActive';

// Switch between login and register tabs
function switchAuthTab(tab) {
    const loginTab = document.querySelector('.auth-tab:first-child');
    const registerTab = document.querySelector('.auth-tab:last-child');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }

    // Clear messages
    clearMessages();
}

// Clear all messages
function clearMessages() {
    document.getElementById('loginMessage').innerHTML = '';
    document.getElementById('registerMessage').innerHTML = '';
}

// Show error message
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="error-message">${message}</div>`;
}

// Show success message
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="success-message">${message}</div>`;
}

// Show loading state
function showLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="loading"></span>Завантаження...';
    } else {
        button.disabled = false;
        if (buttonId === 'loginBtn') {
            button.innerHTML = 'Увійти';
        } else {
            button.innerHTML = 'Зареєструватися';
        }
    }
}

function setSessionActive(isActive) {
    if (isActive) {
        localStorage.setItem(SESSION_FLAG_KEY, 'true');
    } else {
        localStorage.removeItem(SESSION_FLAG_KEY);
    }
}

// Store user data in localStorage (non-sensitive info only)
function storeUserData(user) {
    if (!user) {
        localStorage.removeItem('userData');
        return;
    }
    localStorage.setItem('userData', JSON.stringify(user));
}

// Get stored user data
function getUserData() {
    const userData = localStorage.getItem('userData');
    
    if (userData) {
        try {
            return {
                token: null,
                user: JSON.parse(userData)
            };
        } catch (_) {
            return null;
        }
    }
    return null;
}

// Clear stored user data
function clearUserData() {
    localStorage.removeItem('userData');
    setSessionActive(false);
}

// Check if user is logged in (client-side flag)
function isLoggedIn() {
    return localStorage.getItem(SESSION_FLAG_KEY) === 'true';
}

// Login function
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            storeUserData(data.user);
            setSessionActive(true);
            return { success: true, data: data };
        } else {
            return { success: false, error: data.error || 'Помилка входу' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Помилка з\'єднання з сервером' };
    }
}

// Register function
async function register(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            storeUserData(data.user);
            setSessionActive(true);
            return { success: true, data: data };
        } else {
            let errorMessage = 'Помилка реєстрації';
            if (data.errors && data.errors.length > 0) {
                errorMessage = data.errors.map(err => err.msg).join(', ');
            } else if (data.error) {
                errorMessage = data.error;
            }
            return { success: false, error: errorMessage };
        }
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, error: 'Помилка з\'єднання з сервером' };
    }
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('loginMessage', 'Будь ласка, заповніть всі поля');
        return;
    }

    showLoading('loginBtn', true);
    clearMessages();

    const result = await login(username, password);

    showLoading('loginBtn', false);

    if (result.success) {
        showSuccess('loginMessage', 'Успішний вхід! Перенаправляємо...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } else {
        showError('loginMessage', result.error);
    }
});

// Handle register form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        username: document.getElementById('registerUsername').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        password: document.getElementById('registerPassword').value,
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim()
    };

    const confirmPassword = document.getElementById('confirmPassword').value;

    // Client-side validation
    if (!formData.username || !formData.email || !formData.password || 
        !formData.firstName || !formData.lastName) {
        showError('registerMessage', 'Будь ласка, заповніть всі обов\'язкові поля');
        return;
    }

    if (formData.username.length < 3) {
        showError('registerMessage', 'Логін повинен містити принаймні 3 символи');
        return;
    }

    if (formData.password.length < 6) {
        showError('registerMessage', 'Пароль повинен містити принаймні 6 символів');
        return;
    }

    if (formData.password !== confirmPassword) {
        showError('registerMessage', 'Паролі не співпадають');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showError('registerMessage', 'Будь ласка, введіть коректний email');
        return;
    }

    showLoading('registerBtn', true);
    clearMessages();

    const result = await register(formData);

    showLoading('registerBtn', false);

    if (result.success) {
        showSuccess('registerMessage', 'Реєстрація успішна! Перенаправляємо...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } else {
        showError('registerMessage', result.error);
    }
});

// Check if user is already logged in when page loads
async function checkExistingSession() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            storeUserData(data.user);
            setSessionActive(true);
            window.location.href = 'index.html';
            return true;
        }
    } catch (error) {
        console.warn('Session check failed:', error);
    }
    clearUserData();
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    checkExistingSession();
    
    // Check for saved auth tab preference
    const savedTab = localStorage.getItem('authTab');
    if (savedTab === 'register') {
        switchAuthTab('register');
        localStorage.removeItem('authTab'); // Clear after use
    }
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'register') {
        switchAuthTab('register');
    }
});
