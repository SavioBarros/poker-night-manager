// ======================================
// POKER NIGHT MANAGER
// DATABASE V4.0 LUXURY EDITION
// ======================================

const DB = {
    PLAYERS: "poker_players",
    CURRENT_HISTORY: "poker_current_history",
    SESSIONS: "poker_sessions",
    RANKING: "poker_ranking",
    SETTINGS: "poker_settings"
};

// ================================
// VARIÁVEIS GLOBAIS
// ================================
let players = [];
let currentHistory = [];
let sessions = [];
let ranking = {};
let settings = {
    defaultBuyIn: 50,
    theme: "emerald"
};

// ================================
// CARREGAR BANCO
// ================================
function loadDatabase() {
    players = JSON.parse(localStorage.getItem(DB.PLAYERS)) || [];
    currentHistory = JSON.parse(localStorage.getItem(DB.CURRENT_HISTORY)) || [];
    sessions = JSON.parse(localStorage.getItem(DB.SESSIONS)) || [];
    ranking = JSON.parse(localStorage.getItem(DB.RANKING)) || {};
    
    const savedSettings = JSON.parse(localStorage.getItem(DB.SETTINGS));
    if (savedSettings) {
        settings = { ...settings, ...savedSettings };
    }

    players = migratePlayers(players);
    saveDatabase();
}

// ================================
// MIGRAÇÃO
// ================================
function migratePlayers(lista) {
    return lista.map(p => {
        return {
            id: p.id || generateId(),
            name: p.name || p.nome || "Jogador",
            buyIn: p.buyIn ?? settings.defaultBuyIn,
            rebuyValue: p.rebuyValue ?? 0,
            rebuyCount: p.rebuyCount ?? 0,
            bought: p.bought ?? (p.buyIn ?? settings.defaultBuyIn),
            finalAmount: p.finalAmount === undefined ? null : p.finalAmount,
            result: p.result ?? 0,
            status: p.status || "Jogando"
        };
    });
}

// ================================
// SALVAR BANCO
// ================================
function saveDatabase() {
    localStorage.setItem(DB.PLAYERS, JSON.stringify(players));
    localStorage.setItem(DB.CURRENT_HISTORY, JSON.stringify(currentHistory));
    localStorage.setItem(DB.SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(DB.RANKING, JSON.stringify(ranking));
    localStorage.setItem(DB.SETTINGS, JSON.stringify(settings));
}

// ================================
// UTILIDADES & FORMATADORES
// ================================
function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function sessionDate() {
    return new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

// ================================
// CALCULADORA DE ACERTO DE CONTAS ("QUEM DEVE PRA QUEM")
// ================================
function calculateSettlement(playerList) {
    const list = playerList || players;
    let debtors = [];  // Quem perdeu (deve pagar)
    let creditors = []; // Quem ganhou (deve receber)

    list.forEach(p => {
        const finalVal = p.finalAmount !== null && p.finalAmount !== undefined ? Number(p.finalAmount) : 0;
        const net = finalVal - p.bought;
        if (net < -0.01) {
            debtors.push({ name: p.name, amount: Math.abs(net) });
        } else if (net > 0.01) {
            creditors.push({ name: p.name, amount: net });
        }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
        let debt = debtors[i];
        let credit = creditors[j];
        let amount = Math.min(debt.amount, credit.amount);

        if (amount > 0.01) {
            transactions.push({
                from: debt.name,
                to: credit.name,
                amount: Math.round(amount * 100) / 100
            });
        }

        debt.amount -= amount;
        credit.amount -= amount;

        if (debt.amount < 0.01) i++;
        if (credit.amount < 0.01) j++;
    }

    return transactions;
}

// ================================
// HISTÓRICO DA SESSÃO ATUAL
// ================================
function addHistory(action) {
    currentHistory.push({
        id: generateId(),
        date: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        ...action
    });
    saveDatabase();
}

// ================================
// SALVAR SESSÃO FINALIZADA
// ================================
function saveFinishedSession() {
    const settlement = calculateSettlement(players);
    let session = {
        id: generateId(),
        date: sessionDate(),
        fullDate: new Date().toLocaleString("pt-BR"),
        total: players.reduce((t, p) => t + p.bought, 0),
        players: players.map(p => ({
            name: p.name,
            bought: p.bought,
            final: p.finalAmount,
            result: p.result,
            rebuyCount: p.rebuyCount
        })),
        settlement: settlement,
        history: [...currentHistory]
    };

    sessions.push(session);
    players.forEach(updateRanking);
    saveDatabase();
}

// ================================
// RANKING
// ================================
function updateRanking(player) {
    if (!ranking[player.name]) {
        ranking[player.name] = {
            sessions: 0,
            profit: 0,
            wins: 0,
            losses: 0,
            biggestWin: 0,
            biggestLoss: 0,
            totalRebuys: 0
        };
    }

    let r = ranking[player.name];
    r.sessions++;
    r.profit += player.result;
    r.totalRebuys += player.rebuyCount;

    if (player.result > 0) {
        r.wins++;
        r.biggestWin = Math.max(r.biggestWin, player.result);
    } else if (player.result < 0) {
        r.losses++;
        r.biggestLoss = Math.min(r.biggestLoss, player.result);
    }
}
