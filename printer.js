    // Menu Toggle Functionality
    document.addEventListener('DOMContentLoaded', () => {
        const menuIcon = document.getElementById('menu-icon');
        const navLinks = document.getElementById('nav-links');
        
        menuIcon.addEventListener('click', () => {
          navLinks.classList.toggle('active');
        });
        
        // Loading screen animation
        const loadingOverlay = document.querySelector('.loading-overlay');
        setTimeout(() => {
          loadingOverlay.classList.add('hidden');
        }, 2000);
        
        // Print resume function
        const printButton = document.getElementById('print-button');
        const statusElement = document.getElementById('status');
        const printerSound = document.getElementById('printer-sound');
        
        printButton.addEventListener('click', () => {
          // Prevent multiple clicks while printing
          if (document.querySelector('.printed-paper').classList.contains('printing')) {
            return;
          }
          
          // Update status
          statusElement.textContent = "Initializing printer...";
          
          setTimeout(() => {
            statusElement.textContent = "Printing resume...";
            
            // Play printer sound
            printerSound.currentTime = 0;
            printerSound.play();
            
            // Show paper printing
            document.querySelector('.printed-paper').classList.add('printing');
            
            // Add printing jitter effect
            const printingJitter = setInterval(() => {
              // Add small random movements to paper while printing
              const paper = document.querySelector('.printed-paper');
              const randomX = (Math.random() * 2 - 1) * 0.5;
              const randomRotate = (Math.random() * 2 - 1) * 0.3;
              paper.style.transform = `translateX(calc(-50% + ${randomX}px)) translateY(var(--current-y, 0)) rotate(${randomRotate}deg)`;
            }, 100);
            
            // Timer for completion - longer for the expanded resume
            setTimeout(() => {
              statusElement.textContent = "Printing complete!";
              printerSound.pause();
              clearInterval(printingJitter);
            }, 5000);
          }, 1000);
        });
        
        // Reset function (hidden feature - press R key)
        document.addEventListener('keydown', (event) => {
          if (event.key === 'r' || event.key === 'R') {
            const printedPaper = document.querySelector('.printed-paper');
            printedPaper.classList.remove('printing');
            printedPaper.style.transform = '';
            statusElement.textContent = "";
          }
        });
      });