document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const fastaInput = document.getElementById('fasta-input');
    const fwdPrimerInput = document.getElementById('fwd-primer');
    const revPrimerInput = document.getElementById('rev-primer');
    
    const resultPlaceholder = document.getElementById('result-placeholder');
    const resultContent = document.getElementById('result-content');
    const errorMessage = document.getElementById('error-message');
    
    const ampliconLengthEl = document.getElementById('amplicon-length');
    const fwdPosEl = document.getElementById('fwd-pos');
    const revPosEl = document.getElementById('rev-pos');
    const gcContentEl = document.getElementById('gc-content');
    const sequenceDisplay = document.getElementById('sequence-display');

    // 3D & 2D Elements
    const dna3dWrapper = document.getElementById('dna-3d-wrapper');
    const dna3dContainer = document.getElementById('dna-3d-container');
    const ampliconHighlight = document.getElementById('amplicon-highlight');
    const fwdArrow = document.getElementById('fwd-arrow');
    const revArrow = document.getElementById('rev-arrow');

    // Utility: Get reverse complement of a DNA sequence
    function getReverseComplement(seq) {
        const complement = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N' };
        return seq.split('').reverse().map(base => complement[base.toUpperCase()] || base).join('');
    }

    // Utility: Clean sequence (remove fasta header, whitespace, numbers)
    function cleanSequence(seq, isFasta = false) {
        let cleaned = seq;
        if (isFasta) {
            // Remove first line if it's a FASTA header
            cleaned = cleaned.replace(/^>.*(\r\n|\n|\r)/, '');
        }
        return cleaned.replace(/[\s\d]/g, '').toUpperCase();
    }

    // Utility: Calculate GC Content
    function calculateGC(seq) {
        if (seq.length === 0) return 0;
        const gcMatches = seq.match(/[GC]/g);
        const gcCount = gcMatches ? gcMatches.length : 0;
        return ((gcCount / seq.length) * 100).toFixed(1);
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
        resultContent.classList.add('hidden');
        resultPlaceholder.classList.add('hidden');
    }

    function showResults() {
        errorMessage.classList.add('hidden');
        resultPlaceholder.classList.add('hidden');
        resultContent.classList.remove('hidden');
        
        // Add a subtle animation when showing results
        resultContent.style.animation = 'none';
        resultContent.offsetHeight; /* trigger reflow */
        resultContent.style.animation = 'fadeInUp 0.5s ease-out';
    }

    // ==========================================
    // 3D DNA Visualization Logic (Three.js)
    // ==========================================
    let scene, camera, renderer, dnaGroup;
    let animationId;
    let isDragging = false;

    function init3D() {
        if (renderer) return; 
        
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, dna3dContainer.clientWidth / dna3dContainer.clientHeight, 0.1, 1000);
        camera.position.z = 25;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(dna3dContainer.clientWidth, dna3dContainer.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        dna3dContainer.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        dnaGroup = new THREE.Group();
        scene.add(dnaGroup);

        // Handle resize
        window.addEventListener('resize', () => {
            if(dna3dContainer.clientWidth === 0) return;
            camera.aspect = dna3dContainer.clientWidth / dna3dContainer.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(dna3dContainer.clientWidth, dna3dContainer.clientHeight);
        });

        // Mouse interaction for rotation
        let previousMousePosition = { x: 0, y: 0 };
        
        dna3dContainer.addEventListener('mousedown', () => isDragging = true);
        document.addEventListener('mouseup', () => isDragging = false);
        dna3dContainer.addEventListener('mouseleave', () => isDragging = false);
        document.addEventListener('mousemove', (e) => {
            if (isDragging && dnaGroup) {
                const deltaMove = {
                    x: e.offsetX - previousMousePosition.x,
                    y: e.offsetY - previousMousePosition.y
                };
                dnaGroup.rotation.y += deltaMove.x * 0.01;
                dnaGroup.rotation.x += deltaMove.y * 0.01;
            }
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        });
    }

    function render3DDNA(sequence) {
        if (typeof THREE === 'undefined') {
            console.warn("Three.js not loaded yet.");
            return;
        }
        
        if (!renderer) init3D();
        
        // Clear old DNA
        while(dnaGroup.children.length > 0){ 
            dnaGroup.remove(dnaGroup.children[0]); 
        }
        
        // Limit sequence length for rendering performance (max 120 bp)
        const displaySeq = sequence.substring(0, 120);
        
        const colors = {
            'A': 0xef4444, // Red
            'T': 0x3b82f6, // Blue
            'G': 0x10b981, // Green
            'C': 0xeab308  // Yellow
        };
        const complementColors = {
            'A': colors['T'], 'T': colors['A'], 'G': colors['C'], 'C': colors['G']
        };

        const geometrySphere = new THREE.SphereGeometry(0.5, 16, 16);
        const geometryCylinder = new THREE.CylinderGeometry(0.15, 0.15, 4.5, 8);
        const backboneGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        
        const backboneMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8 });

        const verticalSpacing = 0.8;
        const radius = 3;
        const twistAngle = 0.4;

        for (let i = 0; i < displaySeq.length; i++) {
            const base = displaySeq[i];
            const y = (i - displaySeq.length / 2) * verticalSpacing;
            const angle = i * twistAngle;

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Base 1
            const color1 = colors[base] || 0xffffff;
            const mat1 = new THREE.MeshPhongMaterial({ color: color1 });
            const sphere1 = new THREE.Mesh(geometrySphere, mat1);
            sphere1.position.set(x, y, z);
            dnaGroup.add(sphere1);

            // Backbone 1
            const bb1 = new THREE.Mesh(backboneGeometry, backboneMat);
            bb1.position.set(x * 1.2, y, z * 1.2);
            dnaGroup.add(bb1);

            // Base 2
            const color2 = complementColors[base] || 0xffffff;
            const mat2 = new THREE.MeshPhongMaterial({ color: color2 });
            const sphere2 = new THREE.Mesh(geometrySphere, mat2);
            sphere2.position.set(-x, y, -z);
            dnaGroup.add(sphere2);

            // Backbone 2
            const bb2 = new THREE.Mesh(backboneGeometry, backboneMat);
            bb2.position.set(-x * 1.2, y, -z * 1.2);
            dnaGroup.add(bb2);

            // Rung connecting them
            const rung = new THREE.Mesh(geometryCylinder, new THREE.MeshPhongMaterial({color: 0xe2e8f0})); 
            rung.position.set(0, y, 0);
            rung.rotation.z = Math.PI / 2;
            rung.rotation.y = -angle;
            dnaGroup.add(rung);
        }

        dnaGroup.rotation.x = 0;
        dnaGroup.rotation.y = 0;

        dna3dWrapper.classList.remove('hidden');
        
        if (!animationId) {
            const animate = function () {
                animationId = requestAnimationFrame(animate);
                if (dnaGroup && !isDragging) {
                    dnaGroup.rotation.y += 0.005;
                }
                renderer.render(scene, camera);
            };
            animate();
        }
    }

    // ==========================================
    // 2D PCR Map Visualization Logic
    // ==========================================
    function drawPCRMap(fwdIndex, revIndex, fwdLen, revLen, totalLength) {
        // Prevent division by zero
        if (totalLength === 0) totalLength = 1;

        const fwdStartPercent = (fwdIndex / totalLength) * 100;
        const ampliconEndPercent = ((revIndex + revLen) / totalLength) * 100;
        const ampliconWidth = ampliconEndPercent - fwdStartPercent;

        // Render Amplicon highlight
        ampliconHighlight.style.left = `${fwdStartPercent}%`;
        ampliconHighlight.style.width = `${ampliconWidth}%`;

        // Render Forward Arrow (starts at fwdIndex, points right)
        fwdArrow.style.left = `${fwdStartPercent}%`;
        
        // Render Reverse Arrow (starts at end of amplicon, points left)
        revArrow.style.left = `${ampliconEndPercent}%`;
        revArrow.style.transform = `translateX(-100%)`; // Align right edge of arrow to the position
    }

    // ==========================================
    // Main Events
    // ==========================================
    
    // Live update 3D DNA on input
    fastaInput.addEventListener('input', () => {
        const rawFasta = fastaInput.value.trim();
        const template = cleanSequence(rawFasta, true);
        if (template.length > 0 && /^[ATCGN]+$/.test(template)) {
            render3DDNA(template);
        } else {
            dna3dWrapper.classList.add('hidden');
        }
    });

    runBtn.addEventListener('click', () => {
        const rawFasta = fastaInput.value.trim();
        const rawFwd = fwdPrimerInput.value.trim();
        const rawRev = revPrimerInput.value.trim();

        if (!rawFasta || !rawFwd || !rawRev) {
            showError('모든 필드(Target DNA, Forward Primer, Reverse Primer)를 입력해주세요.');
            return;
        }

        const template = cleanSequence(rawFasta, true);
        const fwdPrimer = cleanSequence(rawFwd);
        const revPrimer = cleanSequence(rawRev);

        if (!/^[ATCGN]+$/.test(template)) {
            showError('Target DNA 시퀀스에 유효하지 않은 문자가 포함되어 있습니다.');
            return;
        }
        if (!/^[ATCGN]+$/.test(fwdPrimer) || !/^[ATCGN]+$/.test(revPrimer)) {
            showError('프라이머 시퀀스에 유효하지 않은 문자가 포함되어 있습니다.');
            return;
        }

        const fwdIndex = template.indexOf(fwdPrimer);
        const revPrimerTarget = getReverseComplement(revPrimer);
        const revIndex = template.lastIndexOf(revPrimerTarget);

        if (fwdIndex === -1) {
            showError('Forward Primer가 Target DNA에서 발견되지 않았습니다.');
            return;
        }

        if (revIndex === -1) {
            showError('Reverse Primer가 Target DNA에서 발견되지 않았습니다.');
            return;
        }

        const endIndex = revIndex + revPrimerTarget.length;
        if (fwdIndex >= endIndex) {
            showError('프라이머 결합 위치가 유효하지 않습니다. (Forward가 Reverse보다 뒤에 위치함)');
            return;
        }

        // Calculations
        const ampliconSeq = template.substring(fwdIndex, endIndex);
        const ampliconLength = endIndex - fwdIndex;
        const gcContent = calculateGC(ampliconSeq);

        // Update Text UI
        ampliconLengthEl.textContent = `${ampliconLength} bp`;
        fwdPosEl.textContent = fwdIndex + 1; 
        revPosEl.textContent = endIndex; 
        gcContentEl.textContent = `${gcContent}%`;

        // Update Highlighted sequence
        const highlightedHTML = `
            ${template.substring(Math.max(0, fwdIndex - 50), fwdIndex)}<span class="fwd-highlight" title="Forward Primer">${template.substring(fwdIndex, fwdIndex + fwdPrimer.length)}</span>${template.substring(fwdIndex + fwdPrimer.length, revIndex)}<span class="rev-highlight" title="Reverse Primer Target">${template.substring(revIndex, endIndex)}</span>${template.substring(endIndex, Math.min(template.length, endIndex + 50))}
        `;
        
        let prefixText = fwdIndex > 50 ? '... ' : '';
        let suffixText = template.length > endIndex + 50 ? ' ...' : '';
        sequenceDisplay.innerHTML = prefixText + highlightedHTML + suffixText;

        // Draw Visuals
        drawPCRMap(fwdIndex, revIndex, fwdPrimer.length, revPrimerTarget.length, template.length);
        
        // Ensure 3D is visible and updated if not already
        render3DDNA(template);

        showResults();
    });
    
    // Auto-fill example on double click of title
    document.querySelector('header h1').addEventListener('dblclick', () => {
        fastaInput.value = ">Musa acuminata polyphenol oxidase (PPO)\nATGGCAAGCTTGTGCAATAGTATGCACACACCTGGAAAACTACTTGATCCTTTCAACAAA\nGCTTGCCTTAAACCAAAATCAAGCTCTGCTGATGAATCACAAAAAGCATTTGTGAGCCTT\nAACATGGCAGTGTCAGATGCTAATGGAAACAAACCAGGTTCAATGGACCCAGCTAAAGGA\nATTTTTGAGCAATTTATGAGTGTGAGCAATATATCTGCACAAGTATTGGGAGAAGTTGAT\nATACAAGGAATGAGCAAGGAGCAAAAATGGTATGAATTTGCAGCTTCTCAAATTGAAAAG";
        fwdPrimerInput.value = "ATGGCAAGCTTGTGCAATAG";
        revPrimerInput.value = "CTTTTCAATTTGAGAAGCTG";
        
        // Trigger input event to render 3D immediately
        fastaInput.dispatchEvent(new Event('input'));
    });
});
