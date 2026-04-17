// main.js — shared utilities
'use strict';

// Smooth section scroll for sidebar links
document.addEventListener('DOMContentLoaded', () => {
  // Highlight active nav on scroll
  const sections = document.querySelectorAll('.form-section');
  const sideLinks = document.querySelectorAll('.sidebar-link[data-section]');
  if (sections.length && sideLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace('section-', '');
          sideLinks.forEach(l => l.classList.toggle('active', l.dataset.section === id));
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(s => observer.observe(s));
  }
});
