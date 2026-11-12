// 1. Animated Galaxy Starfield & Shooting Stars
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

let stars = [];
let shootingStars = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Create twinkling background stars
class Star {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.alpha = Math.random();
        this.alphaChange = (Math.random() * 0.02) + 0.005;
        this.speedY = Math.random() * 0.15 + 0.02;
        const colors = ['#ffffff', '#e0f2fe', '#f3e8ff', '#bae6fd'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
        this.y -= this.speedY;
        if (this.y < 0) {
            this.y = canvas.height;
            this.x = Math.random() * canvas.width;
        }
        this.alpha += this.alphaChange;
        if (this.alpha <= 0.1 || this.alpha >= 1) {
            this.alphaChange = -this.alphaChange;
        }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Create occasional shooting stars
class ShootingStar {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * (canvas.height / 2);
        this.len = Math.random() * 80 + 40;
        this.speed = Math.random() * 10 + 8;
        this.active = false;
    }
    update() {
        if (!this.active) {
            if (Math.random() < 0.004) this.active = true;
            return;
        }
        this.x += this.speed;
        this.y += this.speed * 0.5;
        if (this.x > canvas.width || this.y > canvas.height) {
            this.reset();
        }
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x - this.len, this.y - this.len * 0.5);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.len, this.y - this.len * 0.5);
        ctx.stroke();
        ctx.restore();
    }
}

for (let i = 0; i < 180; i++) stars.push(new Star());
for (let i = 0; i < 2; i++) shootingStars.push(new ShootingStar());

function animateSpace() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(star => {
        star.update();
        star.draw();
    });
    shootingStars.forEach(sStar => {
        sStar.update();
        sStar.draw();
    });
    requestAnimationFrame(animateSpace);
}
animateSpace();

// 2. Typing Text Animation
const phrases = [
    "modern web applications.",
    "interactive user interfaces.",
    "responsive websites.",
    "digital experiences."
];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typedTextEl = document.getElementById('typed-text');

function typeEffect() {
    const currentPhrase = phrases[phraseIndex];
    
    if (isDeleting) {
        typedTextEl.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        typedTextEl.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
    }

    let typeSpeed = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex === currentPhrase.length) {
        typeSpeed = 1800;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 400;
    }

    setTimeout(typeEffect, typeSpeed);
}
document.addEventListener('DOMContentLoaded', typeEffect);

// 3. Mobile Hamburger Menu
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// 4. Contact Form Submission Feedback
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    formStatus.textContent = `Transmission received, ${name}! Thanks for reaching out.`;
    contactForm.reset();
    setTimeout(() => {
        formStatus.textContent = '';
    }, 5000);
});