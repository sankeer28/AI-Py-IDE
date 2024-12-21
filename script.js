let pyodide = null;
let editor = null;

const CODEMIRROR_THEMES = [
    "3024-day", "3024-night", "abbott", "abcdef", "ambiance", "ayu-dark", "ayu-mirage",
    "base16-dark", "base16-light", "bespin", "blackboard", "cobalt", "colorforth",
    "dracula", "duotone-dark", "duotone-light", "eclipse", "elegant", "erlang-dark",
    "gruvbox-dark", "hopscotch", "icecoder", "isotope", "juejin", "lesser-dark",
    "liquibyte", "material", "material-darker", "material-palenight", "material-ocean",
    "mbo", "mdn-like", "midnight", "monokai", "moxer", "neat", "neo", "night",
    "nord", "oceanic-next", "panda-syntax", "paraiso-dark", "paraiso-light",
    "pastel-on-dark", "railscasts", "rubyblue", "seti", "shadowfox", "solarized",
    "ssms", "the-matrix", "tomorrow-night-bright", "tomorrow-night-eighties",
    "ttcn", "twilight", "vibrant-ink", "xq-dark", "xq-light", "yeti", "yonce", "zenburn"
];

document.addEventListener('DOMContentLoaded', function() {
    const themeSelect = document.getElementById('theme-select');
    themeSelect.innerHTML = '';
    
    CODEMIRROR_THEMES.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme;
        if (theme === '3024-night') {
            option.selected = true;
        }
        themeSelect.appendChild(option);
    });

    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
        mode: 'python',
        theme: '3024-night',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        styleActiveLine: true
    });

    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey) {
        document.getElementById('api-key').value = savedApiKey;
    } else {
        document.getElementById('api-key-banner').classList.add('show');
    }
});

async function main() {
    pyodide = await loadPyodide();
    await pyodide.runPythonAsync(`
        import sys
        import io
        sys.stdout = io.StringIO()
    `);
}

function saveSettings() {
    const apiKey = document.getElementById('api-key').value;
    if (apiKey) {
        localStorage.setItem('geminiApiKey', apiKey);
        document.getElementById('api-key-banner').classList.remove('show');
    } else {
        document.getElementById('api-key-banner').classList.add('show');
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('settings-modal'));
    modal.hide();
}

async function generateCode() {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert('Please set your Gemini API key in Settings first');
        return;
    }

    const prompt = document.getElementById('ai-prompt').value;
    const generateBtn = document.getElementById('generate-btn');
    const modalBody = document.querySelector('.modal-body');

    if (!prompt) {
        alert('Please provide a prompt');
        return;
    }

    generateBtn.disabled = true;
    modalBody.classList.add('loading');

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Generate only Python code without any explanations or comments for the following request: ${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let code = data.candidates[0].content.parts[0].text;
            code = code.replace(/```python/g, '').replace(/```/g, '').trim();
            if (code.includes('input(')) {
                const warningMessage = '# ⚠️ WARNING: This code contains input() functions which may not work correctly in all scenarios (ex: guessing games) in the browser.\n# Consider modifying the code to use hardcoded values for testing.\n\n';
                code = warningMessage + code;
            }
            
            editor.setValue(code);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('ai-modal'));
            modal.hide();
        } else {
            throw new Error('Invalid response from Gemini API');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error generating code: ' + error.message);
    } finally {
        generateBtn.disabled = false;
        modalBody.classList.remove('loading');
    }
}

window.updateOutput = (text) => {
    const output = document.getElementById('output');
    const formattedText = text.replace(/\n/g, '<br>');
    output.innerHTML += formattedText;
};

async function runPython() {
    const output = document.getElementById('output');
    output.hidden = false;
    output.innerHTML = '';
    
    try {
        await pyodide.runPythonAsync(`
            import sys
            import io
            
            class RealTimeStringIO(io.StringIO):
                def write(self, text):
                    from js import updateOutput
                    updateOutput(text)
                    return len(text)
            
            sys.stdout = RealTimeStringIO()
        `);
    
        pyodide.globals.set('input', function(prompt) {
            output.innerHTML += prompt;
            const userInput = window.prompt(prompt || '');
            output.innerHTML += userInput + '<br>';
            return userInput;
        });
        
        await pyodide.runPythonAsync(editor.getValue());
        
    } catch (error) {
        output.innerHTML += `Error: ${error.message}`;
    }
}

function openAIModal() {
    if (!localStorage.getItem('geminiApiKey')) {
        alert('Please set your Gemini API key in Settings first');
        return;
    }
    const modal = new bootstrap.Modal(document.getElementById('ai-modal'));
    modal.show();
}

function newFile() {
    editor.setValue('');
}

function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => editor.setValue(reader.result);
        reader.readAsText(file);
    };
    input.click();
}

function saveFile() {
    const blob = new Blob([editor.getValue()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'code.py';
    a.click();
}

function toggleConsole() {
    const output = document.getElementById('output');
    output.hidden = !output.hidden;
}

function changeTheme(theme) {
    editor.setOption('theme', theme);
}

function changeFontSize(size) {
    document.querySelector('.CodeMirror').style.fontSize = `${size}px`;
}

document.addEventListener('contextmenu', function(e) {
    if (editor.somethingSelected()) {
        e.preventDefault();
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
    }
});

document.addEventListener('click', function(e) {
    const contextMenu = document.getElementById('context-menu');
    if (e.target.closest('#context-menu') === null) {
        contextMenu.style.display = 'none';
    }
});

async function explainSelectedCode() {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert('Please set your Gemini API key in Settings first');
        return;
    }

    const selectedCode = editor.getSelection();
    if (!selectedCode) {
        alert('No code selected');
        return;
    }

    document.getElementById('context-menu').style.display = 'none';
    document.getElementById('selected-code-display').textContent = selectedCode;
    document.getElementById('explanation-text').innerHTML = 'Generating explanation...';
    
    const explanationModal = new bootstrap.Modal(document.getElementById('explanation-modal'));
    explanationModal.show();

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Explain this Python code in detail:\n\n${selectedCode}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const explanation = data.candidates[0].content.parts[0].text;
            document.getElementById('explanation-text').innerHTML = explanation.replace(/\n/g, '<br>');
        } else {
            throw new Error('Invalid response from Gemini API');
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('explanation-text').innerHTML = 'Error generating explanation: ' + error.message;
    }
}

main();

