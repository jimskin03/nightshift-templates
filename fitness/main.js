// AutoTempl shared script — generated on 2026-08-25 11:18:38
document.addEventListener('DOMContentLoaded', function () {
    // Mobile menu toggle (shared header component)
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function () {
            nav.classList.toggle('active');
        });
    }

    // Smooth scroll for in-page anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            const id = this.getAttribute('href');
            if (id && id.length > 1) {
                const target = document.querySelector(id);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                    if (nav) { nav.classList.remove('active'); }
                }
            }
        });
    });

    // Generic dismissible banner / alert close buttons
    document.querySelectorAll('[data-dismiss]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const el = btn.closest('.alert');
            if (el) { el.remove(); }
        });
    });

    console.log('AutoTempl template initialized: Iron Room');
});
