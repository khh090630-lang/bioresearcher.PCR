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

        // Validation
        if (!/^[ATCGN]+$/.test(template)) {
            showError('Target DNA 시퀀스에 유효하지 않은 문자가 포함되어 있습니다.');
            return;
        }
        if (!/^[ATCGN]+$/.test(fwdPrimer) || !/^[ATCGN]+$/.test(revPrimer)) {
            showError('프라이머 시퀀스에 유효하지 않은 문자가 포함되어 있습니다.');
            return;
        }

        // 1. Search for Forward Primer on the Sense strand
        const fwdIndex = template.indexOf(fwdPrimer);
        
        // 2. Search for Reverse Primer (requires reverse complement) on the Sense strand
        const revPrimerTarget = getReverseComplement(revPrimer);
        // We use lastIndexOf to find the furthest matching site, 
        // mimicking PCR where the outer-most primers dictate the full amplicon
        const revIndex = template.lastIndexOf(revPrimerTarget);

        if (fwdIndex === -1) {
            showError('Forward Primer가 Target DNA에서 발견되지 않았습니다.');
            return;
        }

        if (revIndex === -1) {
            showError('Reverse Primer가 Target DNA에서 발견되지 않았습니다.');
            return;
        }

        // Check if forward primer is before reverse primer
        const endIndex = revIndex + revPrimerTarget.length;
        if (fwdIndex >= endIndex) {
            showError('프라이머 결합 위치가 유효하지 않습니다. (Forward가 Reverse보다 뒤에 위치함)');
            return;
        }

        // Successful amplification
        const ampliconSeq = template.substring(fwdIndex, endIndex);
        const ampliconLength = endIndex - fwdIndex;
        const gcContent = calculateGC(ampliconSeq);

        // Update UI
        ampliconLengthEl.textContent = `${ampliconLength} bp`;
        fwdPosEl.textContent = fwdIndex + 1; // 1-based index for biology
        revPosEl.textContent = endIndex; // 1-based index
        gcContentEl.textContent = `${gcContent}%`;

        // Create highlighted sequence
        const highlightedHTML = `
            ${template.substring(Math.max(0, fwdIndex - 50), fwdIndex)}<span class="fwd-highlight" title="Forward Primer">${template.substring(fwdIndex, fwdIndex + fwdPrimer.length)}</span>${template.substring(fwdIndex + fwdPrimer.length, revIndex)}<span class="rev-highlight" title="Reverse Primer Target">${template.substring(revIndex, endIndex)}</span>${template.substring(endIndex, Math.min(template.length, endIndex + 50))}
        `;
        
        let prefixText = fwdIndex > 50 ? '... ' : '';
        let suffixText = template.length > endIndex + 50 ? ' ...' : '';
        
        sequenceDisplay.innerHTML = prefixText + highlightedHTML + suffixText;

        showResults();
    });
    
    // Auto-fill example on double click of title (for easy testing)
    document.querySelector('header h1').addEventListener('dblclick', () => {
        fastaInput.value = ">Musa acuminata polyphenol oxidase (PPO)\nATGGCAAGCTTGTGCAATAGTATGCACACACCTGGAAAACTACTTGATCCTTTCAACAAA\nGCTTGCCTTAAACCAAAATCAAGCTCTGCTGATGAATCACAAAAAGCATTTGTGAGCCTT\nAACATGGCAGTGTCAGATGCTAATGGAAACAAACCAGGTTCAATGGACCCAGCTAAAGGA\nATTTTTGAGCAATTTATGAGTGTGAGCAATATATCTGCACAAGTATTGGGAGAAGTTGAT\nATACAAGGAATGAGCAAGGAGCAAAAATGGTATGAATTTGCAGCTTCTCAAATTGAAAAG";
        fwdPrimerInput.value = "ATGGCAAGCTTGTGCAATAG";
        revPrimerInput.value = "CTTTTCAATTTGAGAAGCTG"; // Reverse complement of CTCA...
    });
});
