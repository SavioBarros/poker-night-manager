// ======================================
// POKER NIGHT MANAGER
// FIREBASE SYNC & SPECTATOR MODE
// ======================================

const firebaseConfig = {
    // Apenas a URL do DB é estritamente necessária para acesso público sem Auth no RTDB (em alguns setups v8)
    // Se falhar, precisaremos do apiKey e projectId
    databaseURL: "https://poker-night-manager-efb24-default-rtdb.firebaseio.com/"
};

let db = null;
let currentRoomCode = null;
let isSpectator = false;
let isLiveHost = false;
let roomRef = null;

function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
        console.log("Firebase inicializado com sucesso.");
    } catch (err) {
        console.error("Erro ao inicializar Firebase:", err);
        if (typeof showToast === 'function') showToast("Erro ao inicializar conexão ao vivo.");
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ======================================
// HOST MODE (Anfitrião)
// ======================================
function createLiveRoom() {
    if (!db) initFirebase();
    
    currentRoomCode = generateRoomCode();
    isLiveHost = true;
    isSpectator = false;
    
    roomRef = db.ref('rooms/' + currentRoomCode);
    
    // Atualiza a UI para mostrar que está ao vivo
    showLiveBadge(currentRoomCode);
    
    // Força o primeiro sync
    syncToFirebase();
    
    // Mostra modal com o código
    showRoomCreatedModal(currentRoomCode);
}

function syncToFirebase() {
    if (!isLiveHost || !roomRef) return;
    
    // Não envia history inteiro se for muito grande, mas para poker caseiro é ok
    const state = {
        players: players,
        currentHistory: currentHistory,
        sessionClosed: (typeof sessionClosed !== 'undefined') ? sessionClosed : false,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    roomRef.set(state).catch(err => {
        console.error("Erro ao sincronizar com Firebase:", err);
        showToast("Erro ao sincronizar dados ao vivo.", "error");
    });
}

function closeLiveRoom() {
    if (isLiveHost && roomRef) {
        roomRef.remove(); // Deleta a sala ao fechar
    }
    disconnectFromLiveRoom();
}

function disconnectFromLiveRoom() {
    isLiveHost = false;
    currentRoomCode = null;
    roomRef = null;
    hideLiveBadge();
}

// ======================================
// SPECTATOR MODE (Espectador)
// ======================================
function joinLiveRoom(code) {
    console.log("Iniciando joinLiveRoom com código:", code);
    if (!db) initFirebase();
    
    if (!db) {
        console.error("DB não inicializado, abortando join.");
        return;
    }
    
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode) return;
    
    showToast("Conectando à sala...");
    
    const targetRef = db.ref('rooms/' + cleanCode);
    
    targetRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            // Entrou com sucesso
            isSpectator = true;
            isLiveHost = false;
            currentRoomCode = cleanCode;
            roomRef = targetRef;
            
            // Ativar modo espectador (esconder botões)
            enableSpectatorUI();
            showLiveBadge(currentRoomCode, true);
            closeJoinModal();
            showToast("Conectado à Mesa Ao Vivo!", "success");
            
            // Passa a escutar as mudanças
            roomRef.on('value', (snap) => {
                const data = snap.val();
                if (data) {
                    // Atualiza estado local e re-renderiza
                    players = data.players || [];
                    currentHistory = data.currentHistory || [];
                    if (typeof sessionClosed !== 'undefined') {
                        sessionClosed = data.sessionClosed || false;
                    }
                    if (typeof render === 'function') render();
                    if (typeof renderHistory === 'function') renderHistory();
                    
                    // Se o app tiver fechamento aberto, atualiza também
                    if (!document.getElementById("fechamento").classList.contains("hidden")) {
                        if (typeof renderFinish === 'function') renderFinish();
                    }
                } else {
                    // Sala fechada pelo host
                    showToast("O anfitrião encerrou a mesa.", "error");
                    exitSpectatorMode();
                }
            });
            
        } else {
            showToast("Sala não encontrada ou encerrada.", "error");
        }
    }).catch(err => {
        console.error(err);
        showToast("Erro Firebase: " + (err.message || "Verifique internet"), "error");
    });
}

function exitSpectatorMode() {
    if (roomRef) {
        roomRef.off();
    }
    isSpectator = false;
    currentRoomCode = null;
    roomRef = null;
    
    disableSpectatorUI();
    hideLiveBadge();
    
    // Recarrega banco de dados local para voltar ao estado original do celular
    if (typeof loadDatabase === 'function') loadDatabase();
    if (typeof render === 'function') render();
    if (typeof renderHistory === 'function') renderHistory();
    
    showToast("Você saiu do modo espectador.", "info");
}

// ======================================
// UI UPDATES (Manipulados no app.js, declarados aqui como stubs/helpers)
// ======================================
function shareRoom(code) {
    const url = window.location.href.split('?')[0] + '?sala=' + code;
    const text = `🎰 Acompanhe nossa Mesa de Poker AO VIVO!\n\nAcesse o link ou use o código *${code}*:\n${url}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Poker Night - Mesa Ao Vivo',
            text: text,
            url: url
        }).catch(console.error);
    } else {
        // Fallback WhatsApp
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
    }
}
