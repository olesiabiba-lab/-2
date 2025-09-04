// AI Костёр - Client-side JavaScript

// Global variables
let socket = null;
let currentUser = null;
let users = [];
let isFirstUser = false;

// DOM elements
const joinForm = document.getElementById('joinForm');
const campfireArea = document.getElementById('campfireArea');
const messageDisplay = document.getElementById('messageDisplay');
const userCircle = document.getElementById('userCircle');
const connectionStatus = document.getElementById('connectionStatus');
const leaveBtn = document.getElementById('leaveBtn');
const intervalSettings = document.getElementById('intervalSettings');

// Initialize stars background
function createStars() {
    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        starsContainer.appendChild(star);
    }
}

// Generate ambient smoke particles
function createAmbientSmoke() {
    const campfire = document.querySelector('.campfire');
    
    const smokeInterval = setInterval(() => {
        // Check if campfire still exists
        if (!document.querySelector('.campfire')) {
            clearInterval(smokeInterval);
            return;
        }
        
        const smoke = document.createElement('div');
        smoke.className = 'smoke';
        smoke.style.left = (campfire.offsetWidth / 2 - 2) + 'px';
        smoke.style.top = '0px';
        smoke.style.left = (campfire.offsetWidth / 2 - 2 + (Math.random() - 0.5) * 40) + 'px';
        smoke.style.animationDelay = Math.random() * 0.5 + 's';
        
        campfire.appendChild(smoke);
        
        // Remove smoke element after animation
        setTimeout(() => {
            if (smoke.parentNode) {
                smoke.parentNode.removeChild(smoke);
            }
        }, 3000);
    }, 200);
    
    // Store interval ID for cleanup
    campfire.smokeInterval = smokeInterval;
}

// Create directed smoke animation toward selected user
function createDirectedSmoke(targetPosition) {
    const campfireRect = document.querySelector('.campfire').getBoundingClientRect();
    const campfireAreaRect = document.querySelector('.campfire-area').getBoundingClientRect();
    
    // Calculate relative positions
    const startX = campfireRect.left - campfireAreaRect.left + campfireRect.width / 2;
    const startY = campfireRect.top - campfireAreaRect.top + campfireRect.height / 2;
    
    const endX = targetPosition.x + 300; // 300 is half of campfire-area width
    const endY = targetPosition.y + 300; // 300 is half of campfire-area height
    
    // Create multiple smoke particles
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const smoke = document.createElement('div');
            smoke.className = 'directed-smoke';
            smoke.style.left = startX + 'px';
            smoke.style.top = startY + 'px';
            
            // Calculate movement
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // Apply the movement with CSS transforms
            smoke.style.setProperty('--deltaX', deltaX + 'px');
            smoke.style.setProperty('--deltaY', deltaY + 'px');
            
            // Add custom animation
            smoke.style.animation = `directedSmokeMove 2s ease-out forwards`;
            smoke.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            
            campfireArea.appendChild(smoke);
            
            // Remove after animation
            setTimeout(() => {
                if (smoke.parentNode) {
                    smoke.parentNode.removeChild(smoke);
                }
            }, 2000);
        }, i * 100);
    }
}

// Initialize socket connection
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        connectionStatus.textContent = 'Подключено';
        connectionStatus.className = 'connection-status connected';
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        connectionStatus.textContent = 'Отключено';
        connectionStatus.className = 'connection-status disconnected';
    });
    
    socket.on('currentState', (state) => {
        users = state.users || [];
        
        // Check if there are users to determine if interval settings should be shown
        if (users.length === 0) {
            intervalSettings.style.display = 'block';
            isFirstUser = true;
        } else {
            intervalSettings.style.display = 'none';
            isFirstUser = false;
        }
        
        if (state.currentSelection) {
            updateMessageDisplay(state.currentSelection.name);
            if (state.currentSelection.position) {
                highlightUser(state.currentSelection.name);
            }
        }
        updateUserDisplay();
    });
    
    socket.on('usersUpdated', (updatedUsers) => {
        users = updatedUsers || [];
        updateUserDisplay();
    });
    
    socket.on('userSelected', (selection) => {
        updateMessageDisplay(selection.name);
        highlightUser(selection.name);
        
        // Create directed smoke if user has position
        if (selection.position && !selection.isDefault) {
            createDirectedSmoke(selection.position);
        }
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        connectionStatus.textContent = 'Ошибка подключения';
        connectionStatus.className = 'connection-status disconnected';
    });
}

// Join campfire function
function joinCampfire() {
    const nameInput = document.getElementById('userName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Пожалуйста, введите ваше имя!');
        nameInput.focus();
        return;
    }
    
    if (name.length > 20) {
        alert('Имя не должно превышать 20 символов!');
        nameInput.focus();
        return;
    }
    
    // Check for inappropriate characters
    if (!/^[a-zA-Zа-яА-Я0-9\s\-_]+$/.test(name)) {
        alert('Имя может содержать только буквы, цифры, пробелы, дефисы и подчёркивания!');
        nameInput.focus();
        return;
    }
    
    currentUser = name;
    
    // Get interval settings if this might be the first user
    let intervalData = {};
    if (isFirstUser) {
        const intervalMin = parseInt(document.getElementById('intervalMin').value) || 5;
        const intervalMax = parseInt(document.getElementById('intervalMax').value) || 10;
        
        // Validate intervals
        if (intervalMin > intervalMax) {
            alert('Минимальный интервал не может быть больше максимального!');
            return;
        }
        
        if (intervalMin < 3 || intervalMax > 30) {
            alert('Интервал должен быть от 3 до 30 секунд!');
            return;
        }
        
        intervalData = {
            intervalMin: intervalMin,
            intervalMax: intervalMax
        };
    }
    
    // Send join request
    socket.emit('joinCampfire', {
        name: name,
        ...intervalData
    });
    
    // Hide form and show campfire
    joinForm.style.display = 'none';
    campfireArea.style.display = 'block';
    leaveBtn.style.display = 'block';
    
    // Start ambient smoke
    createAmbientSmoke();
    
    console.log(`${name} joined the campfire`);
}

// Leave campfire function
function leaveCampfire() {
    if (confirm('Вы уверены, что хотите покинуть костёр?')) {
        socket.emit('leaveCampfire');
        resetToJoinForm();
    }
}

// Reset to join form
function resetToJoinForm() {
    // Clear ambient smoke interval
    const campfire = document.querySelector('.campfire');
    if (campfire && campfire.smokeInterval) {
        clearInterval(campfire.smokeInterval);
        campfire.smokeInterval = null;
    }
    
    currentUser = null;
    users = [];
    isFirstUser = false;
    
    joinForm.style.display = 'block';
    campfireArea.style.display = 'none';
    leaveBtn.style.display = 'none';
    intervalSettings.style.display = 'block';
    
    messageDisplay.textContent = 'Добро пожаловать к костру!';
    userCircle.innerHTML = '';
    
    // Clear form
    document.getElementById('userName').value = '';
    document.getElementById('intervalMin').value = '5';
    document.getElementById('intervalMax').value = '10';
    
    console.log('Returned to join form');
}

// Update user display around campfire
function updateUserDisplay() {
    userCircle.innerHTML = '';
    
    if (users.length === 0) return;
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-name';
        userElement.textContent = user.name;
        userElement.id = `user-${user.name.replace(/\s+/g, '_')}`;
        
        // Position around campfire
        const centerX = 300; // Half of campfire-area width
        const centerY = 300; // Half of campfire-area height
        
        const x = centerX + user.position.x - 50; // -50 to center the element
        const y = centerY + user.position.y - 15; // -15 to center the element
        
        userElement.style.left = x + 'px';
        userElement.style.top = y + 'px';
        
        // Add glow effect if this is current user
        if (user.name === currentUser) {
            userElement.style.border = '2px solid #00ff00';
            userElement.style.boxShadow = '0 0 10px #00ff00';
        }
        
        userCircle.appendChild(userElement);
    });
    
    console.log(`Updated display for ${users.length} users`);
}

// Update message display
function updateMessageDisplay(selectedName) {
    messageDisplay.textContent = `Самая красивая девушка на костре — ${selectedName}`;
    messageDisplay.style.transform = 'translateX(-50%) scale(1.1)';
    
    // Add color animation
    messageDisplay.style.color = '#ff6b35';
    
    setTimeout(() => {
        messageDisplay.style.transform = 'translateX(-50%) scale(1)';
        messageDisplay.style.color = '#ffaa00';
    }, 500);
    
    console.log(`Message updated for: ${selectedName}`);
}

// Highlight selected user
function highlightUser(selectedName) {
    // Remove previous selection
    document.querySelectorAll('.user-name').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Highlight new selection
    const selectedElement = document.getElementById(`user-${selectedName.replace(/\s+/g, '_')}`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            if (selectedElement) {
                selectedElement.classList.remove('selected');
            }
        }, 3000);
        
        console.log(`Highlighted user: ${selectedName}`);
    }
}

// Validate interval inputs in real-time
function validateIntervals() {
    const minInput = document.getElementById('intervalMin');
    const maxInput = document.getElementById('intervalMax');
    
    let min = parseInt(minInput.value) || 5;
    let max = parseInt(maxInput.value) || 10;
    
    // Clamp values
    min = Math.max(3, Math.min(30, min));
    max = Math.max(3, Math.min(30, max));
    
    // Ensure min <= max
    if (min > max) {
        max = min;
    }
    
    minInput.value = min;
    maxInput.value = max;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    initSocket();
    
    // Handle Enter key in name input
    const nameInput = document.getElementById('userName');
    nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinCampfire();
        }
    });
    
    // Focus on name input when page loads
    nameInput.focus();
    
    // Validate interval inputs
    document.getElementById('intervalMin').addEventListener('input', validateIntervals);
    document.getElementById('intervalMax').addEventListener('input', validateIntervals);
    
    console.log('AI Костёр client initialized');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentUser && socket) {
        socket.emit('leaveCampfire');
    }
});

// Handle page visibility change (when user switches tabs)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden');
    } else {
        console.log('Page visible');
        // Reconnect if needed
        if (socket && !socket.connected) {
            socket.connect();
        }
    }
});

// Global function to make it accessible from HTML onclick
window.joinCampfire = joinCampfire;
window.leaveCampfire = leaveCampfire;