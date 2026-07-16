document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const fastaInput = document.getElementById('fasta-input');
    const pdbInput = document.getElementById('pdb-input');
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

    // 3Dmol viewer
    let viewer = null;

    // Utility: Get reverse complement of a DNA sequence
    function getReverseComplement(seq) {
        const complement = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N' };
        return seq.split('').reverse().map(base => complement[base.toUpperCase()] || base).join('');
    }

    // Utility: Clean sequence (remove fasta header, whitespace, numbers)
    function cleanSequence(seq, isFasta = false) {
        let cleaned = seq;
        if (isFasta) {
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
        
        resultContent.style.animation = 'none';
        resultContent.offsetHeight; /* trigger reflow */
        resultContent.style.animation = 'fadeInUp 0.5s ease-out';
    }

    // ==========================================
    // 3Dmol.js Visualization Logic
    // ==========================================
    function render3Dmol(pdbId, fwdStartPercent, ampliconEndPercent) {
        if (!viewer) {
            viewer = $3Dmol.createViewer("container-3Dmoljs", {backgroundColor: "rgba(0,0,0,0)"});
        }
        viewer.clear();
        
        // Use 1BNA as default if empty
        const targetPdb = (pdbId || '1BNA').trim().toLowerCase();

        $3Dmol.download("pdb:" + targetPdb, viewer, {style:{cartoon:{color:'spectrum'}}}, function() {
            const m = viewer.getModel();
            if(!m) return;
            
            // Get all atoms to determine max residue number
            const atoms = m.selectedAtoms({});
            if (atoms.length === 0) return;
            
            // Find max resi
            let minResi = Infinity;
            let maxResi = -Infinity;
            atoms.forEach(a => {
                if (a.resi < minResi) minResi = a.resi;
                if (a.resi > maxResi) maxResi = a.resi;
            });
            
            const totalResidues = maxResi - minResi + 1;
            
            // Calculate which residues to highlight based on percentage
            const startResi = Math.floor(minResi + (fwdStartPercent / 100) * totalResidues);
            const endResi = Math.ceil(minResi + (ampliconEndPercent / 100) * totalResidues);
            
            // Default style for whole molecule
            viewer.setStyle({}, { cartoon: { color: 'white', opacity: 0.4 } });
            
            // Highlight style for amplicon
            // Create a selection string for the range. Handle cases where start == end.
            const hlRange = (startResi === endResi) ? String(startResi) : startResi + '-' + endResi;
            
            // Apply vibrant red sphere style to the amplicon
            viewer.setStyle({resi: hlRange}, { sphere: { color: 'red' }, cartoon: { color: 'red', opacity: 1 } });
            
            // Zoom to the highlighted area
            viewer.zoomTo({resi: hlRange}, 1500);
            viewer.animate({spin:true});
            viewer.render();
        });
    }

    // ==========================================
    // Main Events
    // ==========================================
    runBtn.addEventListener('click', () => {
        const rawFasta = fastaInput.value.trim();
        const rawFwd = fwdPrimerInput.value.trim();
        const rawRev = revPrimerInput.value.trim();
        const pdbId = pdbInput.value.trim();

        if (!rawFasta || !rawFwd || !rawRev) {
            showError('모든 필수 필드(Target DNA, Forward Primer, Reverse Primer)를 입력해주세요.');
            return;
        }

        const template = cleanSequence(rawFasta, true);
        const fwdPrimer = cleanSequence(rawFwd);
        const revPrimer = cleanSequence(rawRev);

        if (!/^[ATCGN]+$/.test(template) || !/^[ATCGN]+$/.test(fwdPrimer) || !/^[ATCGN]+$/.test(revPrimer)) {
            showError('시퀀스에 유효하지 않은 문자가 포함되어 있습니다.');
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

        // Update Highlighted sequence text
        const highlightedHTML = `
            ${template.substring(Math.max(0, fwdIndex - 50), fwdIndex)}<span class="fwd-highlight" title="Forward Primer">${template.substring(fwdIndex, fwdIndex + fwdPrimer.length)}</span>${template.substring(fwdIndex + fwdPrimer.length, revIndex)}<span class="rev-highlight" title="Reverse Primer Target">${template.substring(revIndex, endIndex)}</span>${template.substring(endIndex, Math.min(template.length, endIndex + 50))}
        `;
        
        let prefixText = fwdIndex > 50 ? '... ' : '';
        let suffixText = template.length > endIndex + 50 ? ' ...' : '';
        sequenceDisplay.innerHTML = prefixText + highlightedHTML + suffixText;

        // Calculate Percentages
        const totalLength = template.length || 1;
        const fwdStartPercent = (fwdIndex / totalLength) * 100;
        const ampliconEndPercent = (endIndex / totalLength) * 100;

        showResults();
        
        // Render 3Dmol visualization
        render3Dmol(pdbId, fwdStartPercent, ampliconEndPercent);
    });
    
    // Auto-fill example on double click of title
    document.querySelector('header h1').addEventListener('dblclick', () => {
        fastaInput.value = ">Musa acuminata polyphenol oxidase (PPO)\nATGGCAAGCTTGTGCAATAGTATGCACACACCTGGAAAACTACTTGATCCTTTCAACAAA\nGCTTGCCTTAAACCAAAATCAAGCTCTGCTGATGAATCACAAAAAGCATTTGTGAGCCTT\nAACATGGCAGTGTCAGATGCTAATGGAAACAAACCAGGTTCAATGGACCCAGCTAAAGGA\nATTTTTGAGCAATTTATGAGTGTGAGCAATATATCTGCACAAGTATTGGGAGAAGTTGAT\nATACAAGGAATGAGCAAGGAGCAAAAATGGTATGAATTTGCAGCTTCTCAAATTGAAAAG";
        pdbInput.value = "1BNA";
        fwdPrimerInput.value = "ATGGCAAGCTTGTGCAATAG";
        revPrimerInput.value = "CTTTTCAATTTGAGAAGCTG";
    });

    window.addEventListener('resize', () => {
        if(viewer) viewer.resize();
    });
});
