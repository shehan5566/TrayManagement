// Client-side UI Interactions for Nelna Tray Tracking System

// Search filtering functionality
function filterTable(inputId, tableId, colIndex = 1) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('keyup', function () {
        const filter = input.value.toLowerCase();
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) { // Skip header row
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length > colIndex) {
                const textValue = cells[colIndex].textContent || cells[colIndex].innerText;
                if (textValue.toLowerCase().indexOf(filter) > -1) {
                    rows[i].style.display = "";
                } else {
                    rows[i].style.display = "none";
                }
            }
        }
    });
}

// Tab switcher functionality
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active classes
            btn.classList.add('active');
            const targetContent = document.getElementById(target);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Filter options in a select dropdown based on input
function setupDropdownSearch(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    // Store original options in an array
    const originalOptions = Array.from(select.options);

    input.addEventListener('input', function () {
        const filter = input.value.toLowerCase();

        // Clear select options
        select.innerHTML = '';

        // Always include the first default select option if it is empty/placeholder
        if (originalOptions[0] && originalOptions[0].value === "") {
            select.appendChild(originalOptions[0]);
        }

        originalOptions.forEach((option, index) => {
            if (index === 0 && option.value === "") return; // Skip placeholder already added

            const txt = option.textContent || option.innerText;
            if (txt.toLowerCase().includes(filter)) {
                select.appendChild(option.cloneNode(true));
            }
        });
    });
}

// Theme Toggle Functionality
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    if (!themeToggle || !themeIcon) return;

    // Set initial icon based on active theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    if (currentTheme === 'dark') {
        themeIcon.className = 'fa-solid fa-sun';
    } else {
        themeIcon.className = 'fa-solid fa-moon';
    }

    themeToggle.addEventListener('click', () => {
        const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = activeTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Update icon class
        if (newTheme === 'dark') {
            themeIcon.className = 'fa-solid fa-sun';
        } else {
            themeIcon.className = 'fa-solid fa-moon';
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Setup theme toggle
    setupThemeToggle();

    // Setup tabs if they exist on the page
    setupTabs();

    // Setup table filters
    filterTable('customerSearch', 'customersTable', 0); // Search customer management page (name is col 0)
    filterTable('txSearch', 'transactionsTable', 1);     // Search transaction entry page (name is col 1)

    // Reports page search filters
    filterTable('reportOutSearch', 'reportOutTable', 1); // Tray Out Report
    filterTable('reportInSearch', 'reportInTable', 1);   // Tray In Report
    filterTable('balanceSearch', 'balanceTable', 0);     // Customer Balance Report

    // Dropdown search filters
    setupDropdownSearch('customerSearchInput', 'customerId');
});

// Global AJAX Helpers with SweetAlert2
window.submitAjaxForm = async function (event, form, successMessage, successCallback) {
    event.preventDefault();

    const isMultipart = form.getAttribute('enctype') === 'multipart/form-data';
    const formData = new FormData(form);

    let fetchOptions = {
        method: form.getAttribute('method') || form.method || 'POST',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    };

    if (isMultipart) {
        fetchOptions.body = formData;
    } else {
        fetchOptions.headers['Content-Type'] = 'application/json';
        const data = {};
        for (let [key, value] of formData.entries()) {
            if (data.hasOwnProperty(key)) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        fetchOptions.body = JSON.stringify(data);
    }

    try {
        const url = form.getAttribute('action') || form.action;
        const response = await fetch(url, fetchOptions);

        const result = await response.json();

        if (response.ok && result.success) {
            // Instant redirect for template/receipt view without delay
            if (result.redirect) {
                window.location.href = result.redirect;
                return;
            }

            const finalTitle = successMessage || result.message || 'Operation successful!';

            // Show toast notification first, then execute callback or reload
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: finalTitle,
                showConfirmButton: false,
                timer: 1000,
                timerProgressBar: true
            }).then(() => {
                if (typeof successCallback === 'function') {
                    successCallback(result);
                } else if (typeof successCallback === 'string') {
                    window.location.href = successCallback;
                } else {
                    window.location.reload();
                }
            });
        } else {
            Swal.fire('Error!', result.error || 'Failed to submit', 'error');
        }
    } catch (err) {
        console.error("AJAX Error:", err);
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: err.message || 'Could not connect to the server. Please try again.'
        });
    } finally {
        // Reset global form state if applicable
        form.classList.remove('is-submitting');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.dataset.originalContent) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.innerHTML = submitBtn.dataset.originalContent;
        }
    }
};

window.confirmAjaxDelete = function (event, form, itemType) {
    event.preventDefault();

    Swal.fire({
        title: 'Are you sure?',
        text: `Do you really want to delete this ${itemType || 'item'}? This action cannot be undone!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#174e3e',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const url = form.getAttribute('action') || form.action;
                const response = await fetch(url, {
                    method: 'POST', // standard HTML forms use POST for deletes in our app
                    headers: { 'Accept': 'application/json' }
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Deleted successfully!',
                        showConfirmButton: false,
                        timer: 1800,
                        timerProgressBar: true
                    });

                    // Remove row from UI without reload
                    const tr = form.closest('tr');
                    if (tr) {
                        tr.style.transition = 'opacity 0.3s';
                        tr.style.opacity = '0';
                        setTimeout(() => tr.remove(), 300);
                    } else {
                        setTimeout(() => window.location.reload(), 1500);
                    }
                } else {
                    Swal.fire('Error!', data.error || 'Failed to delete.', 'error');
                }
            } catch (err) {
                Swal.fire('Error!', 'Network error occurred.', 'error');
            }
        }
    });
};

// Global toast notification helper
function showToast(title, text, icon) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: icon || 'info',
            title: title,
            text: text,
            timer: 3500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    } else {
        alert(title + (text ? ": " + text : ""));
    }
}

// Global Form Submission Loading State (Prevent Double Clicks)
document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function (e) {
            // Prevent multiple submissions
            if (this.classList.contains('is-submitting')) {
                e.preventDefault();
                return;
            }

            this.classList.add('is-submitting');

            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                // Save original content
                if (!submitBtn.dataset.originalContent) {
                    submitBtn.dataset.originalContent = submitBtn.innerHTML;
                }

                // Set loading state
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.8';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            }
        });
    });
});

// Toggle password visibility (show/hide password)
function togglePasswordVisibility(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const icon = (btnElement && btnElement.querySelector) ? (btnElement.querySelector('i') || btnElement) : btnElement;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon && icon.classList) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon && icon.classList) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}
