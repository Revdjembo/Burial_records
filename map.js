let allRecords = [];
let currentHighlighted = null;
let currentArrow = null;
let panelDragging = false;
let panelStartX = 0;
let panelStartY = 0;

async function loadBurialData() {
    try {
        const response = await fetch('Newbrough burials from Parish d base.xlsx');
        if (!response.ok) throw new Error('Could not load burial records');

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        allRecords = XLSX.utils.sheet_to_json(worksheet);

        console.log('Loaded burial records:', allRecords.length);
    } catch (error) {
        console.error('Error loading burial data:', error);
    }
}

async function loadMap() {
    try {
        const response = await fetch('Newbrough Churchyard Survey.svg');
        if (!response.ok) throw new Error('SVG file not found');

        const svgContent = await response.text();

        document.getElementById('map-display').innerHTML = `
            <div class="map-wrapper">
                <div class="zoom-controls">
                    <button class="zoom-btn" onclick="simpleZoomIn()" title="Zoom In">+</button>
                    <button class="zoom-btn" onclick="simpleZoomOut()" title="Zoom Out">−</button>
                    <button class="zoom-btn" onclick="resetView()" title="Reset View">⌂</button>
                </div>
                <div style="overflow: auto; max-height: 70vh; border: 2px solid #ecf0f1; border-radius: 10px; background: #fafafa;">
                    ${svgContent}
                </div>
            </div>
        `;

        makeGravesClickable();
        initializePanelDragging();
        initializeMapDragging();
        checkUrlParameters();

    } catch (error) {
        console.error('Error loading SVG:', error);
        document.getElementById('map-display').innerHTML = `
            <div class="no-svg">
                <h3>⚠️ Map Not Available</h3>
                <p>Could not load the churchyard map SVG file.</p>
                <p>Looking for: "Newbrough Churchyard Survey.svg"</p>
                <br>
                <p><em>You can still search burial records using the link above.</em></p>
            </div>
        `;
    }
}

function simpleZoomIn() {
    const svg = document.querySelector('#map-display svg');
    if (!svg) return;

    const currentWidth = svg.style.width || '100%';
    const currentScale = parseFloat(currentWidth.replace('%', '')) / 100 || 1;
    const newScale = Math.min(currentScale * 1.3, 5);

    svg.style.width = (newScale * 100) + '%';
    svg.style.height = 'auto';
}

function simpleZoomOut() {
    const svg = document.querySelector('#map-display svg');
    if (!svg) return;

    const currentWidth = svg.style.width || '100%';
    const currentScale = parseFloat(currentWidth.replace('%', '')) / 100 || 1;
    const newScale = Math.max(currentScale * 0.7, 0.5);

    svg.style.width = (newScale * 100) + '%';
    svg.style.height = 'auto';
}

function resetView() {
    const svg = document.querySelector('#map-display svg');
    if (!svg) return;

    svg.style.width = '100%';
    svg.style.height = 'auto';

    const container = svg.closest('div[style*="overflow"]');
    if (container) {
        container.scrollTop = 0;
        container.scrollLeft = 0;
    }
}

function makeGravesClickable() {
    const svg = document.querySelector('#map-display svg');
    if (!svg) return;

    const textElements = svg.querySelectorAll('text');
    let clickableCount = 0;

    textElements.forEach(textElement => {
        const textContent = textElement.textContent.trim();

        if (/^\d+$/.test(textContent)) {
            const graveNumber = parseInt(textContent);

            if (graveNumber > 0 && graveNumber <= 500) {
                textElement.classList.add('clickable-grave');
                textElement.style.cursor = 'pointer';
                textElement.setAttribute('data-grave', graveNumber);

                textElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showGraveInfo(graveNumber);
                });

                clickableCount++;
            }
        }
    });

    console.log(`Made ${clickableCount} graves clickable`);
}

function initializePanelDragging() {
    const panel = document.getElementById('info-panel');
    const header = panel.querySelector('.info-panel-header');

    header.addEventListener('mousedown', function (e) {
        panelDragging = true;
        const rect = panel.getBoundingClientRect();
        panelStartX = e.clientX - rect.left;
        panelStartY = e.clientY - rect.top;

        document.addEventListener('mousemove', dragPanel);
        document.addEventListener('mouseup', stopDragPanel);
    });
}

// Map Panning variables
let isDraggingMap = false;
let startMapX, startMapY, startScrollLeft, startScrollTop;

function initializeMapDragging() {
    const container = document.querySelector('div[style*="overflow"]');
    if (!container) return;

    container.style.cursor = 'grab';

    container.addEventListener('mousedown', (e) => {
        isDraggingMap = true;
        container.style.cursor = 'grabbing';
        startMapX = e.pageX - container.offsetLeft;
        startMapY = e.pageY - container.offsetTop;
        startScrollLeft = container.scrollLeft;
        startScrollTop = container.scrollTop;
    });

    container.addEventListener('mouseleave', () => {
        isDraggingMap = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mouseup', () => {
        isDraggingMap = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDraggingMap) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = (x - startMapX);
        const walkY = (y - startMapY);
        container.scrollLeft = startScrollLeft - walkX;
        container.scrollTop = startScrollTop - walkY;
    });
}

function dragPanel(e) {
    if (!panelDragging) return;

    const panel = document.getElementById('info-panel');
    const newX = e.clientX - panelStartX;
    const newY = e.clientY - panelStartY;

    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;

    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));

    panel.style.left = constrainedX + 'px';
    panel.style.top = constrainedY + 'px';
    panel.style.transform = 'none';
}

function stopDragPanel() {
    panelDragging = false;
    document.removeEventListener('mousemove', dragPanel);
    document.removeEventListener('mouseup', stopDragPanel);
}

function showGraveInfo(graveNumber) {
    const graveRecords = allRecords.filter(record =>
        record['Grave plan Number'] === graveNumber
    );

    const panel = document.getElementById('info-panel');
    const title = document.getElementById('panel-title');
    const content = document.getElementById('panel-content');

    title.textContent = `Grave ${graveNumber}`;

    if (graveRecords.length === 0) {
        content.innerHTML = `
            <div class="burial-record">
                <h4>No Records Found</h4>
                <p>No burial records found for grave ${graveNumber}.</p>
                <p><em>This may indicate an empty grave or records not yet digitized.</em></p>
            </div>
        `;
    } else {
        content.innerHTML = graveRecords.map(record => `
            <div class="burial-record">
                <h4>${record.Forename} ${record.Surname}</h4>
                <div class="burial-detail"><strong>Date:</strong> ${record.Date || 'Not recorded'}</div>
                <div class="burial-detail"><strong>Age:</strong> ${record.Age || 'Not recorded'}</div>
                <div class="burial-detail"><strong>Location:</strong> ${record.Of || 'Not recorded'}</div>
            </div>
        `).join('');
    }

    panel.classList.add('active');
    highlightGrave(graveNumber);
}

function highlightGrave(graveNumber) {
    clearHighlight();

    const svg = document.querySelector('#map-display svg');
    if (!svg) return;

    const textElements = svg.querySelectorAll('text');
    let found = false;
    let graveElement = null;

    textElements.forEach(textElement => {
        const textContent = textElement.textContent.trim();
        if (textContent == graveNumber && /^\d+$/.test(textContent)) {
            textElement.classList.add('highlighted-grave');
            currentHighlighted = textElement;
            graveElement = textElement;
            found = true;
        }
    });

    if (found && graveElement) {
        addArrowToGrave(graveElement);
        centerGraveInView(graveElement);
    } else {
        console.warn(`Grave ${graveNumber} not found on map`);
        const existingContent = document.getElementById('panel-content').innerHTML;
        document.getElementById('panel-content').innerHTML =
            '<div style="background: #f39c12; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px;">' +
            '<strong>⚠️ Grave location not visible on map</strong><br>' +
            'This grave number may not be marked on the current map view.' +
            '</div>' + existingContent;
    }
}

function addArrowToGrave(graveElement) {
    const svg = document.querySelector('#map-display svg');
    if (!svg || !graveElement) return;

    try {
        const bbox = graveElement.getBBox();
        const arrowX = bbox.x + bbox.width / 2;
        const arrowY = bbox.y - 1;

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', `${arrowX},${arrowY} ${arrowX - 1.5},${arrowY - 4} ${arrowX + 1.5},${arrowY - 4}`);
        arrow.setAttribute('class', 'grave-arrow');
        arrow.setAttribute('id', 'grave-arrow');

        svg.appendChild(arrow);
        currentArrow = arrow;
    } catch (error) {
        console.warn('Could not add arrow:', error);
    }
}

function centerGraveInView(graveElement) {
    if (!graveElement) return;

    try {
        const container = document.querySelector('div[style*="overflow"]');

        if (container) {
            const svg = document.querySelector('#map-display svg');
            if (svg) {
                // Set a moderate zoom level so the map is visible
                svg.style.width = '150%';
                svg.style.height = 'auto';
            }

            setTimeout(() => {
                const graveRect = graveElement.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                const scrollDiffX = graveRect.left + (graveRect.width / 2) - (containerRect.left + containerRect.width / 2);
                const scrollDiffY = graveRect.top + (graveRect.height / 2) - (containerRect.top + containerRect.height / 2);

                container.scrollBy({
                    left: scrollDiffX,
                    top: scrollDiffY,
                    behavior: 'smooth'
                });
            }, 100);
        }
    } catch (error) {
        console.warn('Could not center grave:', error);
    }
}

function clearHighlight() {
    if (currentHighlighted) {
        currentHighlighted.classList.remove('highlighted-grave');
        currentHighlighted = null;
    }

    if (currentArrow) {
        currentArrow.remove();
        currentArrow = null;
    }
}

function findGrave() {
    const graveNumber = document.getElementById('grave-search').value.trim();
    if (graveNumber && !isNaN(graveNumber)) {
        showGraveInfo(parseInt(graveNumber));
    }
}

function showFullMap() {
    closeInfoPanel();
    clearHighlight();
}

function closeInfoPanel() {
    document.getElementById('info-panel').classList.remove('active');
}

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const graveParam = urlParams.get('grave');
    const nameParam = urlParams.get('name');

    if (graveParam) {
        setTimeout(() => {
            showGraveInfo(parseInt(graveParam));
            if (nameParam) {
                document.getElementById('panel-title').textContent =
                    `Grave ${graveParam} - ${decodeURIComponent(nameParam)}`;
            }
        }, 500);
    }
}

document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && e.target.id === 'grave-search') {
        findGrave();
    }
});

window.addEventListener('load', async function () {
    await loadBurialData();
    await loadMap();
});

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
