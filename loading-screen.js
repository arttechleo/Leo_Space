function loadSvgPaths(svgFilePath, targetSvgId, basePathId) {
    return fetch(svgFilePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then(svgText => {
        // Parse the SVG content
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        
        // Get the viewBox from the original SVG and apply it to our target
        const originalSvg = svgDoc.querySelector('svg');
        const viewBox = originalSvg ? originalSvg.getAttribute('viewBox') : null;
        
        // Get all path elements from the loaded SVG
        const paths = svgDoc.querySelectorAll('path');
        const pathLengths = [];
        
        // If paths were found, add them to your SVG container
        if (paths.length > 0) {
          const targetSvg = document.getElementById(targetSvgId);
          if (!targetSvg) return [];
          
          // Apply original viewBox if found
          if (viewBox) {
            targetSvg.setAttribute('viewBox', viewBox);
          }
          
          // Clear any existing content
          targetSvg.innerHTML = '';
          
          // Add each path with necessary animation attributes
          paths.forEach((path, index) => {
            const animatedPath = path.cloneNode(true);
            animatedPath.id = `${basePathId}-${index}`;
            animatedPath.classList.add('svg-path');
            
            // Make stroke wider for bolder appearance
            const originalWidth = animatedPath.getAttribute('stroke-width');
            // You can adjust the multiplier (1.5) to make it more or less bold
            const newWidth = originalWidth ? parseFloat(originalWidth) * 3 : 5;
            animatedPath.setAttribute('stroke-width', newWidth);
            
            // Keep original styling for other attributes if they exist, otherwise set defaults
            if (!animatedPath.getAttribute('stroke')) {
              animatedPath.style.stroke = '#fff';
            }
            if (!animatedPath.getAttribute('fill')) {
              animatedPath.style.fill = 'none';
            }
            
            // Make sure we have rounded linecaps for smooth animation
            animatedPath.setAttribute('stroke-linecap', 'round');
            animatedPath.setAttribute('stroke-linejoin', 'round');
            
            // Add shadow effect for more emphasis
            animatedPath.style.filter = 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.7))';
            
            // Get path length for animation
            const pathLength = animatedPath.getTotalLength ? animatedPath.getTotalLength() : 1000;
            animatedPath.setAttribute('stroke-dasharray', pathLength);
            animatedPath.setAttribute('stroke-dashoffset', pathLength);
            
            // Store the length for animation
            pathLengths.push(pathLength);
            
            // Add it to your SVG element
            targetSvg.appendChild(animatedPath);
          });
          
          return pathLengths;
        }
        return [];
      })
      .catch(error => {
        console.error('Error loading SVG:', error);
        return [];
      });
  }
  
  // Function to update loading progress
  function updateLoadingProgress(progress) {
    const progressElement = document.getElementById('progress');
    if (progressElement) {
      progressElement.textContent = `Loading... ${progress}%`;
    }
    
    if (progress >= 100) {
      loadingComplete = true;
      checkAndRemoveLoadingScreen();
    }
  }
  
  // Variables to track loading progress
  let loadingComplete = false;
  let svgAnimationComplete = false;
  
  // Function to check if loading is complete
  function checkAndRemoveLoadingScreen() {
    if (loadingComplete && svgAnimationComplete) {
      console.log('Both loading and animation complete, removing loading screen');
      const loadingScreen = document.getElementById('loading-screen');
      
      if (loadingScreen) {
        // Fade out loading screen
        loadingScreen.style.transition = 'opacity 1s ease';
        loadingScreen.style.opacity = '0';
        
        // Remove loading screen after transition
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 1000);
      }
    }
  }
  
  // Modified SVG Animation code for multiple paths
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // For testing - to see the animation clearly
      const useArtificialDelay = false; // Set to true to add artificial delay
  
      // Load your SVG files with multiple paths
      const pathLengthsEn = await loadSvgPaths('./hello.svg', 'hello-en', 'hello-path-en');
      
      // Define the language info
      const languages = [
        { 
          id: 'hello-en', 
          basePathId: 'hello-path-en', 
          name: 'English', 
          pathLengths: pathLengthsEn,
          pathCount: pathLengthsEn.length
        }
      ];
      
      // Function to animate SVG with multiple paths
      function animateMultiPath(langIndex) {
        // Get current language data
        const lang = languages[langIndex];
        const svg = document.getElementById(lang.id);
        
        // Check if SVG exists
        if (!svg) {
          console.error(`Could not find SVG for language: ${lang.name}`);
          svgAnimationComplete = true;
          checkAndRemoveLoadingScreen();
          return;
        }
        
        // Make this SVG active and others inactive
        document.querySelectorAll('.svg-container svg').forEach(s => {
          if (s) s.classList.remove('active');
        });
        svg.classList.add('active');
        
        // Update language indicator
        const languageIndicator = document.getElementById('language-indicator');
        if (languageIndicator) {
          languageIndicator.textContent = lang.name;
        }
        
        // Calculate total animation time based on path count
        const totalDuration = Math.max(lang.pathCount * 500, 2000); // Minimum 2 seconds
        const timePerPath = totalDuration / lang.pathCount;
        
        // Function to animate paths sequentially
        function animatePathsSequentially() {
          let currentPathIndex = 0;
          let overallProgress = 0;
          
          function animateNextPath() {
            if (currentPathIndex >= lang.pathCount) {
              // All paths animated
              svgAnimationComplete = true;
              updateLoadingProgress(100);
              checkAndRemoveLoadingScreen();
              return;
            }
            
            const pathId = `${lang.basePathId}-${currentPathIndex}`;
            const path = document.getElementById(pathId);
            const pathLength = lang.pathLengths[currentPathIndex];
            
            if (!path) {
              currentPathIndex++;
              animateNextPath();
              return;
            }
            
            let start = null;
            
            function step(timestamp) {
              if (!start) start = timestamp;
              const elapsed = timestamp - start;
              const progress = Math.min(elapsed / timePerPath, 1);
              
              // Calculate the drawing progress
              const drawLength = pathLength * progress;
              path.style.strokeDashoffset = pathLength - drawLength;
              
              // Update overall progress
              const pathProgressContribution = progress / lang.pathCount;
              const newOverallProgress = Math.floor(((currentPathIndex / lang.pathCount) + pathProgressContribution) * 100);
              
              if (newOverallProgress > overallProgress) {
                overallProgress = newOverallProgress;
                updateLoadingProgress(overallProgress);
              }
              
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                // This path is complete
                currentPathIndex++;
                
                // Small delay between paths
                setTimeout(animateNextPath, 100);
              }
            }
            
            requestAnimationFrame(step);
          }
          
          // Start with the first path
          animateNextPath();
        }
        
        // Start the animation
        if (useArtificialDelay) {
          // Simulate slower loading for testing
          let progress = 0;
          const interval = setInterval(() => {
            progress += 1;
            updateLoadingProgress(progress);
            
            if (progress >= 100) {
              clearInterval(interval);
              loadingComplete = true;
              svgAnimationComplete = true;
              checkAndRemoveLoadingScreen();
            }
          }, 50);
        } else {
          // Normal animation
          animatePathsSequentially();
        }
      }
      
      // Start the animation with the first language
      animateMultiPath(0);
      
    } catch (error) {
      console.error('Failed to load SVGs:', error);
      // In case of error, still allow page to load
      svgAnimationComplete = true;
      loadingComplete = true;
      checkAndRemoveLoadingScreen();
    }
  });
  
  // Connect to the Three.js loading
  // Add this to your existing loading initialization code at the appropriate place:
  if (window.finishLoading) {
    window.finishLoading();
  };
  