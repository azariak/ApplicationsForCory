let aiScores = {};

function loadAIScores() {
    const saved = localStorage.getItem('zfellows-ai-scores');
    if (saved) aiScores = JSON.parse(saved);
}

function saveAIScores() {
    localStorage.setItem('zfellows-ai-scores', JSON.stringify(aiScores));
}

function getAIScore(candidateId) {
    if (aiScores[candidateId] !== undefined) return aiScores[candidateId];
    const candidate = mockCandidates.find(c => c.id === candidateId);
    return candidate ? candidate.aiScore : 0;
}

async function scoreCandidate(candidate, apiKey, model = 'gpt-4o-mini') {
    const prompt = `Score this founder application 0-100 based on traction, technical ability, problem-solution fit, expertise, and ambition.

${candidate.firstName} ${candidate.lastName} - ${candidate.company}
Technical: ${candidate.technical} | ${candidate.location} | ${candidate.schoolOrWork}
Project: ${candidate.projectDescription}
Problem: ${candidate.problemSolving}
Expertise: ${candidate.expertise}
Competitors: ${candidate.competitors}
Past: ${candidate.pastWork}
Achievements: ${candidate.achievements}
Challenge: ${candidate.riskOrChallenge}

Return ONLY a number 0-100.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'Expert startup investor. Return only a score 0-100.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 10
        })
    });
    
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const score = parseInt(data.choices[0].message.content.trim());
    if (isNaN(score) || score < 0 || score > 100) throw new Error(`Invalid score: ${score}`);
    return score;
}

async function scoreAllPendingCandidates(apiKey, onProgress = null) {
    const pending = mockCandidates.filter(c => getStatus(c.id) === 'pending' && !aiScores[c.id]);
    if (!pending.length) return { success: true, message: 'No pending candidates', total: 0, successful: 0, failed: 0 };
    
    const results = { total: pending.length, successful: 0, failed: 0, errors: [] };
    
    for (let i = 0; i < pending.length; i++) {
        try {
            const score = await scoreCandidate(pending[i], apiKey);
            aiScores[pending[i].id] = score;
            results.successful++;
            saveAIScores();
            renderCandidateList();
            if (onProgress) onProgress({ current: i + 1, total: pending.length, candidate: pending[i], score });
            if (i < pending.length - 1) await new Promise(r => setTimeout(r, 200));
        } catch (error) {
            results.failed++;
            results.errors.push({ candidateId: pending[i].id, name: `${pending[i].firstName} ${pending[i].lastName}`, error: error.message });
        }
    }
    return results;
}

async function runAIScoring() {
    const apiKey = prompt('Enter OpenAI API key:');
    if (!apiKey) return alert('API key required');
    
    const model = confirm('Use GPT-4? (expensive)\nCancel = GPT-4o-mini (cheaper)') ? 'gpt-4' : 'gpt-4o-mini';
    console.log('Starting AI scoring:', model);
    
    try {
        const results = await scoreAllPendingCandidates(apiKey, p => 
            console.log(`${p.current}/${p.total}: ${p.candidate.firstName} ${p.candidate.lastName} = ${p.score}`)
        );
        console.log('Complete:', results);
        alert(`Complete!\nSuccess: ${results.successful}\nFailed: ${results.failed}${results.errors.length ? '\n\nErrors:\n' + results.errors.map(e => `${e.name}: ${e.error}`).join('\n') : ''}`);
    } catch (error) {
        console.error('Failed:', error);
        alert('Failed: ' + error.message);
    }
}

function resetAIScores() {
    aiScores = {};
    saveAIScores();
    renderCandidateList();
}

window.runAIScoring = runAIScoring;
window.resetAIScores = resetAIScores;
window.getAIScore = getAIScore;

