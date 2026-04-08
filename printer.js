// Menu toggle, resume printer animation (contact page)

function startPrinterAnimation() {
  const statusElement = document.getElementById('status');
  const printerSound = document.getElementById('printer-sound');
  const printedPaper = document.querySelector('.printed-paper');
  if (!printedPaper || !statusElement) return;

  if (printedPaper.classList.contains('printing')) {
    return;
  }

  statusElement.textContent = 'Initializing printer...';

  setTimeout(() => {
    statusElement.textContent = 'Printing resume...';

    if (printerSound) {
      printerSound.currentTime = 0;
      printerSound.play().catch(() => {});
    }

    printedPaper.classList.add('printing');

    const printingJitter = setInterval(() => {
      const paper = document.querySelector('.printed-paper');
      if (!paper) return;
      const randomX = (Math.random() * 2 - 1) * 0.5;
      const randomRotate = (Math.random() * 2 - 1) * 0.3;
      paper.style.transform = `translateX(calc(-50% + ${randomX}px)) translateY(var(--current-y, 0)) rotate(${randomRotate}deg)`;
    }, 100);

    setTimeout(() => {
      statusElement.textContent = 'Printing complete!';
      if (printerSound) printerSound.pause();
      clearInterval(printingJitter);
    }, 5000);
  }, 1000);
}

window.startPrinterAnimation = startPrinterAnimation;

document.addEventListener('DOMContentLoaded', () => {
  const menuIcon = document.getElementById('menu-icon');
  const navLinks = document.getElementById('nav-links');

  if (menuIcon && navLinks) {
    menuIcon.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    setTimeout(() => {
      loadingOverlay.classList.add('hidden');
    }, 2000);
  }

  const statusElement = document.getElementById('status');
  document.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
      const printedPaper = document.querySelector('.printed-paper');
      if (printedPaper) {
        printedPaper.classList.remove('printing');
        printedPaper.style.transform = '';
      }
      if (statusElement) statusElement.textContent = '';
    }
  });
});
