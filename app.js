const { ipcRenderer } = require('electron');

class SimpleNotesApp {
    constructor() {
        this.analysisData = null;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        document.getElementById('analyze-btn').disabled = true;
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('analyze-btn').disabled = false;
    }

    async runAnalysis() {
        this.showLoading();
        
        try {
            const result = await ipcRenderer.invoke('run-full-analysis');
            
            if (result.success) {
                this.analysisData = result.data;
                this.displayResults(result.data);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError(error.message);
        }
        
        this.hideLoading();
    }

    displayResults(data) {
        // Show results section
        document.getElementById('results').classList.remove('hidden');
        
        // Display summary stats
        this.displayStats(data.summary);
        
        // Display duplicates
        this.displayDuplicates(data.duplicates);
        
        // Display junk notes
        this.displayJunkNotes(data.junkNotes);
        
        // Display organization suggestions
        this.displayOrganization(data.organizationSuggestions);
    }

    displayStats(summary) {
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-box">
                <span class="stat-number">${summary.totalNotes}</span>
                <div class="stat-label">Total Notes</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${summary.duplicateGroups}</span>
                <div class="stat-label">Duplicates</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${summary.junkNotesFound}</span>
                <div class="stat-label">Junk Notes</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${Math.round(summary.averageUtilityScore)}</span>
                <div class="stat-label">Avg Score</div>
            </div>
        `;
    }

    displayDuplicates(duplicates) {
        const card = document.getElementById('duplicates-card');
        const list = document.getElementById('duplicates-list');
        
        if (duplicates.length === 0) {
            card.style.display = 'none';
            return;
        }
        
        card.style.display = 'block';
        list.innerHTML = duplicates.map(group => 
            `<li>Found <span class="highlight">${group.notes.length} similar notes</span>: ${group.notes.map(n => `<span class="note-title" onclick="openNote('${n.id}')">"${n.title}"</span>`).join(', ')}</li>`
        ).join('');
    }

    displayJunkNotes(junkNotes) {
        const card = document.getElementById('junk-card');
        const list = document.getElementById('junk-list');
        
        if (junkNotes.length === 0) {
            card.style.display = 'none';
            return;
        }
        
        card.style.display = 'block';
        list.innerHTML = junkNotes.slice(0, 5).map(note => 
            `<li><span class="highlight note-title" onclick="openNote('${note.id}')">"${note.title}"</span> - ${note.junkReasons.join(', ')}</li>`
        ).join('');
        
        if (junkNotes.length > 5) {
            list.innerHTML += `<li>...and ${junkNotes.length - 5} more notes</li>`;
        }
    }

    displayOrganization(suggestions) {
        const card = document.getElementById('organization-card');
        const list = document.getElementById('organization-list');
        
        if (suggestions.length === 0) {
            card.style.display = 'none';
            return;
        }
        
        card.style.display = 'block';
        list.innerHTML = suggestions.slice(0, 5).map(suggestion => 
            `<li>${suggestion.type}: <span class="highlight">"${suggestion.current}"</span> → <span class="highlight">"${suggestion.suggested}"</span></li>`
        ).join('');
        
        if (suggestions.length > 5) {
            list.innerHTML += `<li>...and ${suggestions.length - 5} more suggestions</li>`;
        }
    }

    showError(error) {
        this.hideLoading();
        document.getElementById('results').innerHTML = `
            <div class="result-card">
                <h3><span class="icon">❌</span>Error</h3>
                <p>${error}</p>
            </div>
        `;
        document.getElementById('results').classList.remove('hidden');
    }

    async openNoteInAppleNotes(noteId) {
        console.log(`Attempting to open note with ID: ${noteId} in Apple Notes`);
        try {
            const result = await ipcRenderer.invoke('open-apple-note', noteId);
            if (!result.success) {
                this.showError(`Failed to open note in Apple Notes: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Error opening note in Apple Notes: ${error.message}`);
        }
    }
}

// Global functions for HTML onclick handlers
function startAnalysis() {
    app.runAnalysis();
}

function openNote(noteId) {
    app.openNoteInAppleNotes(noteId);
}

// Initialize the app
const app = new SimpleNotesApp();
