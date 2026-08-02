// ======================================
// POKER NIGHT MANAGER
// APP V4.0 LUXURY EDITION
// ======================================

let selectedPlayer = null;
let sessionClosed = false;
let editingPlayerIndex = null;

// Drag & Drop state
let draggedIndex = null;
let dragOverIndex = null;

// ======================================
// HAPTIC FEEDBACK (VIBRATION)
// ======================================
function haptic(duration = 30) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDatabase();

    // Aplica o tema salvo
    setTheme(settings.theme || "emerald", false);

    // Data da sessão no topo
    const dateEl = document.getElementById("sessionDate");
    if (dateEl) dateEl.innerText = sessionDate();

    // Input de Buy-in padrão nas Configs
    const buyInInput = document.getElementById("defaultBuyInInput");
    if (buyInInput) buyInInput.value = settings.defaultBuyIn || 50;

    // Fechar modais ao clicar no fundo escuro (backdrop)
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal();
                closeEditPlayer();
                closeFinal();
            }
        });
    });

    // Registro do Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.log('SW error:', err));
    }

    // Renderização inicial
    render();
});

// ======================================
// TOAST NOTIFICATIONS
// ======================================
function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ======================================
// NAVEGAÇÃO ENTRE ABAS
// ======================================
function openTab(tabId) {
    haptic(15);

    // Esconde todas as telas
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    
    // Remove classe ativa de todos os botões da nav
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

    // Mostra a tela selecionada
    const targetScreen = document.getElementById(tabId);
    if (targetScreen) targetScreen.classList.remove("hidden");

    // Ativa o botão da nav correspondente
    const targetBtn = document.getElementById(`tab-${tabId}`);
    if (targetBtn) targetBtn.classList.add("active");

    // Atualiza renderização de acordo com a aba
    if (tabId === "mesa") render();
    if (tabId === "historico") renderHistory();
    if (tabId === "ranking") renderRanking();
    if (tabId === "fechamento") renderFinish();
}

// ======================================
// GERENCIAMENTO DE JOGADORES (MESA)
// ======================================
function toggleAddPlayerBox() {
    const box = document.getElementById("addPlayerBox");
    if (box) {
        box.classList.toggle("hidden");
        if (!box.classList.contains("hidden")) {
            const nameInput = document.getElementById("playerName");
            if (nameInput) nameInput.focus();
        }
    }
}

function confirmAddPlayer() {
    const nameInput = document.getElementById("playerName");
    const buyInInput = document.getElementById("playerBuyIn");

    const name = nameInput.value.trim();
    const buyInVal = Number(buyInInput.value) || settings.defaultBuyIn || 50;

    if (!name) {
        showToast("⚠️ Digite o nome do jogador");
        return;
    }

    players.push({
        id: generateId(),
        name: name,
        buyIn: buyInVal,
        rebuyValue: 0,
        rebuyCount: 0,
        bought: buyInVal,
        finalAmount: null,
        result: 0,
        status: "Jogando"
    });

    nameInput.value = "";
    if (buyInInput) buyInInput.value = "";

    saveDatabase();
    render();
    toggleAddPlayerBox();
    haptic(50);
    showToast(`♠ ${name} entrou na mesa com ${formatMoney(buyInVal)}!`);
}

// ======================================
// RENDERIZAÇÃO DA MESA PRINCIPAL
// ======================================
function render() {
    const box = document.getElementById("playersContainer");
    if (!box) return;

    box.innerHTML = "";
    let totalPot = 0;

    // Atualiza contador no header
    const countBadge = document.getElementById("playerCountBadge");
    if (countBadge) countBadge.innerText = `${players.length} jogador${players.length !== 1 ? 'es' : ''}`;

    // Atualiza banner de sessão encerrada
    const closedBanner = document.getElementById("closedSessionBanner");
    if (closedBanner) {
        if (sessionClosed) {
            closedBanner.classList.remove("hidden");
        } else {
            closedBanner.classList.add("hidden");
        }
    }

    if (players.length === 0) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🃏</div>
                <h3>Pronto para jogar?</h3>
                <p>Adicione o primeiro jogador para iniciar a partida!</p>
                <div class="empty-state-actions" style="display:flex; flex-direction:column; gap:8px;">
                    <button class="empty-state-cta" onclick="toggleAddPlayerBox()" id="emptyStateAddBtn">♠ Adicionar Primeiro Jogador</button>
                    <button class="live-outline-btn" onclick="openJoinModal()" id="emptyStateJoinBtn">👁️ Entrar em uma Sala Ao Vivo</button>
                </div>
            </div>
        `;
        if (typeof isSpectator !== 'undefined' && isSpectator) {
            document.getElementById("emptyStateAddBtn").style.display = "none";
        }
        document.getElementById("cashTotal").innerText = formatMoney(0);
        return;
    }

    players.forEach((p, index) => {
        totalPot += p.bought;
        const initialLetter = p.name.charAt(0).toUpperCase();
        const isOut = p.status === "Sem fichas";

        box.innerHTML += `
            <div class="player-card draggable-card" 
                 draggable="true" 
                 data-index="${index}"
                 id="player-card-${index}">
                <div class="drag-handle" title="Arraste para reordenar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>
                        <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
                        <circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                </div>
                <div class="player-card-content" onclick="openRebuy(${index})">
                    <div class="player-header">
                        <div class="player-avatar">${initialLetter}</div>
                        <div class="player-details">
                            <div class="player-name">${p.name}</div>
                            <span class="player-status-tag ${isOut ? 'out' : 'playing'}">
                                ${isOut ? '💀 Sem fichas' : '🟢 Jogando'}
                            </span>
                        </div>
                        <div class="player-invested">
                            <span class="invested-label">Comprado</span>
                            <span class="invested-amount">${formatMoney(p.bought)}</span>
                        </div>
                    </div>

                    <div class="player-info-grid">
                        <div class="info-item">
                            <span>Entrada Buy-in</span>
                            <strong>${formatMoney(p.buyIn)}</strong>
                        </div>
                        <div class="info-item">
                            <span>Rebuys</span>
                            <strong>${p.rebuyCount}x <span class="rebuy-badge">${formatMoney(p.rebuyValue)}</span></strong>
                        </div>
                    </div>
                </div>

                ${(typeof isSpectator !== 'undefined' && isSpectator) ? '' : `
                <div class="player-actions">
                    <button class="rebuy-btn" onclick="openRebuy(${index})">
                        <span>+ Fichas / Rebuy</span>
                    </button>
                    <button class="lose-btn" onclick="losePlayer(${index})">
                        💀 Perdeu Tudo
                    </button>
                </div>
                `}
            </div>
        `;
    });

    // Bind drag events after rendering
    initDragAndDrop();

    const cashTotalEl = document.getElementById("cashTotal");
    if (cashTotalEl) cashTotalEl.innerText = formatMoney(totalPot);

    // ======================================
    // SPECTATOR MODE UI UPDATES
    // ======================================
    const titleSubtitle = document.querySelector("#mesa .section-header small");
    if (typeof isSpectator !== 'undefined' && isSpectator) {
        if (titleSubtitle) titleSubtitle.innerText = "Modo Espectador - Leitura apenas";
    } else {
        if (titleSubtitle) titleSubtitle.innerText = "Gerencie entradas, rebuys e saídas";
    }

    const liveActionsContainer = document.querySelector(".live-actions-container");
    if (liveActionsContainer) {
        if (typeof isLiveHost !== 'undefined' && isLiveHost) {
            liveActionsContainer.innerHTML = `
                <button class="live-outline-btn active" onclick="showRoomCreatedModal(currentRoomCode)">
                    📡 Transmitindo: Sala ${currentRoomCode}
                </button>
            `;
        } else if (typeof isSpectator !== 'undefined' && isSpectator) {
            liveActionsContainer.innerHTML = `
                <button class="danger-outline-btn" onclick="exitSpectatorMode()">
                    🚪 Sair da Sala
                </button>
            `;
        } else {
            liveActionsContainer.innerHTML = `
                <button id="btnCreateRoom" class="live-outline-btn" onclick="createLiveRoom()">
                    📡 Iniciar Sala Ao Vivo
                </button>
            `;
        }
    }

    const headerActions = document.querySelector("#mesa .header-actions");
    if (headerActions) {
        if (typeof isSpectator !== 'undefined' && isSpectator) {
            headerActions.style.display = 'none';
        } else {
            headerActions.style.display = 'flex';
        }
    }
}

// ======================================
// MODAL REBUY & AÇÕES DO JOGADOR
// ======================================
function openRebuy(index) {
    selectedPlayer = index;
    const player = players[index];
    if (!player) return;

    document.getElementById("modalPlayer").innerText = player.name;
    document.getElementById("modalPlayerAvatar").innerText = player.name.charAt(0).toUpperCase();

    const modal = document.getElementById("rebuyModal");
    if (modal) modal.classList.remove("hidden");
}

function addRebuy(value) {
    if (selectedPlayer === null || !players[selectedPlayer]) return;
    haptic(40);

    let player = players[selectedPlayer];
    player.rebuyCount++;
    player.rebuyValue += value;
    player.bought += value;
    player.status = "Jogando";

    addHistory({
        type: "rebuy",
        player: player.name,
        value: value
    });

    closeModal();
    saveDatabase();
    render();
    showToast(`💰 ${player.name} fez rebuy de ${formatMoney(value)}!`);
}

function addCustomRebuy() {
    const input = document.getElementById("customRebuy");
    const val = Number(input.value);
    if (val > 0) {
        addRebuy(val);
        input.value = "";
    } else {
        showToast("⚠️ Digite um valor válido");
    }
}

function losePlayer(index) {
    if (index === null || !players[index]) return;
    haptic(60);
    players[index].status = "Sem fichas";

    addHistory({
        type: "lost",
        player: players[index].name
    });

    saveDatabase();
    closeModal();
    render();
    showToast(`💀 ${players[index].name} ficou sem fichas.`);
}

function removePlayerWithRefund(index) {
    if (index === null || !players[index]) return;
    const player = players[index];
    const refundAmount = player.bought;

    if (confirm(`Remover ${player.name} da mesa?\n\nO valor de ${formatMoney(refundAmount)} (buy-in + rebuys) será devolvido e subtraído do caixa.`)) {
        haptic(80);

        addHistory({
            type: "removed",
            player: player.name,
            refund: refundAmount
        });

        players.splice(index, 1);
        saveDatabase();
        closeModal();
        render();
        showToast(`🗑 ${player.name} saiu da mesa. Reembolso de ${formatMoney(refundAmount)}.`);
    }
}

function closeModal() {
    const modal = document.getElementById("rebuyModal");
    if (modal) modal.classList.add("hidden");
    selectedPlayer = null;
}

// ======================================
// EDITAR JOGADOR & VALORES (Nome, Buy-in, Rebuys)
// ======================================
function openEditPlayer(index) {
    if (index === null || !players[index]) return;
    editingPlayerIndex = index;

    closeModal(); // Fecha modal de rebuy primeiro

    const player = players[index];
    document.getElementById("editPlayerAvatar").innerText = player.name.charAt(0).toUpperCase();
    document.getElementById("editPlayerName").value = player.name;
    document.getElementById("editPlayerBuyIn").value = player.buyIn;
    document.getElementById("editPlayerRebuys").value = player.rebuyValue;

    const buyInEl = document.getElementById("editPlayerBuyIn");
    const rebuysEl = document.getElementById("editPlayerRebuys");
    
    if (buyInEl) buyInEl.oninput = updateEditTotalPreview;
    if (rebuysEl) rebuysEl.oninput = updateEditTotalPreview;
    
    updateEditTotalPreview();

    const modal = document.getElementById("editPlayerModal");
    if (modal) modal.classList.remove("hidden");

    setTimeout(() => document.getElementById("editPlayerName").focus(), 100);
}

function updateEditTotalPreview() {
    const buyInVal = Number(document.getElementById("editPlayerBuyIn").value) || 0;
    const rebuyVal = Number(document.getElementById("editPlayerRebuys").value) || 0;
    const totalPreview = buyInVal + rebuyVal;
    const previewEl = document.getElementById("editTotalPreview");
    if (previewEl) previewEl.innerText = formatMoney(totalPreview);
}

function confirmEditPlayer() {
    if (editingPlayerIndex === null || !players[editingPlayerIndex]) return;

    const nameInput = document.getElementById("editPlayerName");
    const buyInInput = document.getElementById("editPlayerBuyIn");
    const rebuysInput = document.getElementById("editPlayerRebuys");

    const newName = nameInput.value.trim();
    const newBuyIn = Number(buyInInput.value);
    const newRebuys = Number(rebuysInput.value);

    if (!newName) {
        showToast("⚠️ O nome não pode ficar vazio");
        return;
    }

    if (isNaN(newBuyIn) || newBuyIn < 0) {
        showToast("⚠️ Digite um valor válido para o Buy-in");
        return;
    }

    if (isNaN(newRebuys) || newRebuys < 0) {
        showToast("⚠️ Digite um valor válido para Rebuys");
        return;
    }

    const player = players[editingPlayerIndex];
    const oldName = player.name;

    player.name = newName;
    player.buyIn = newBuyIn;
    player.rebuyValue = newRebuys;
    player.bought = newBuyIn + newRebuys;

    // Recalcula resultado se valor final já preenchido
    if (player.finalAmount !== null && player.finalAmount !== undefined) {
        player.result = player.finalAmount - player.bought;
    }

    addHistory({
        type: "edit",
        player: oldName,
        details: `Editado: ${newName}, Buy-in: ${formatMoney(newBuyIn)}, Rebuys: ${formatMoney(newRebuys)}`
    });

    haptic(30);
    saveDatabase();
    closeEditPlayer();
    render();
    
    const finishScreen = document.getElementById("fechamento");
    if (finishScreen && !finishScreen.classList.contains("hidden")) {
        renderFinish();
    }
    
    showToast(`✏️ Dados de ${newName} atualizados! (Total: ${formatMoney(player.bought)})`);
}

function closeEditPlayer() {
    const modal = document.getElementById("editPlayerModal");
    if (modal) modal.classList.add("hidden");
    editingPlayerIndex = null;
}

// ======================================
// FECHAMENTO DE SESSÃO & "QUEM DEVE PRA QUEM"
// ======================================
function renderFinish() {
    const box = document.getElementById("finishContainer");
    if (!box) return;

    // Atualiza o botão principal da tela de fechamento
    const mainBtn = document.getElementById("finishSessionMainBtn");
    if (mainBtn) {
        if (sessionClosed) {
            mainBtn.innerHTML = "♠ Iniciar Nova Sessão de Poker";
            mainBtn.onclick = confirmNewSession;
            mainBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        } else {
            mainBtn.innerHTML = "🔒 Encerra & Salvar Sessão";
            mainBtn.onclick = finishSession;
        }
    }

    box.innerHTML = "";

    if (players.length === 0) {
        box.innerHTML = `<p class="empty-state">Nenhum jogador na mesa para finalizar.</p>`;
        updateSummary();
        renderSettlement();
        return;
    }

    players.forEach((p, index) => {
        let resultTag = getResultTagHtml(p);

        box.innerHTML += `
            <div class="finish-card">
                <div class="finish-player-name">${p.name}</div>
                <div class="finish-bought">${formatMoney(p.bought)}</div>
                <div class="finish-input-wrapper">
                    <input type="number" 
                           value="${p.finalAmount === null || p.finalAmount === undefined ? '' : p.finalAmount}" 
                           placeholder="R$ Fichas" 
                           oninput="setFinalAmount(${index}, this.value)">
                </div>
                <div id="finish-result-tag-${index}">${resultTag}</div>
            </div>
        `;
    });

    updateSummary();
    renderSettlement();
}

function getResultTagHtml(p) {
    if (p.finalAmount !== null && p.finalAmount !== undefined) {
        const res = p.finalAmount - p.bought;
        if (res > 0) {
            return `<span class="profit-tag">+${formatMoney(res)}</span>`;
        } else if (res < 0) {
            return `<span class="loss-tag">${formatMoney(res)}</span>`;
        } else {
            return `<span class="neutral-tag">Zero a Zero</span>`;
        }
    } else {
        return `<span class="neutral-tag">Pendente</span>`;
    }
}

function setFinalAmount(index, value) {
    if (!players[index]) return;
    
    if (value === "" || value === null) {
        players[index].finalAmount = null;
        players[index].result = 0;
    } else {
        players[index].finalAmount = Number(value);
        players[index].result = players[index].finalAmount - players[index].bought;
    }

    const tagEl = document.getElementById(`finish-result-tag-${index}`);
    if (tagEl) {
        tagEl.innerHTML = getResultTagHtml(players[index]);
    }

    updateSummary();
    renderSettlement();
}

function updateSummary() {
    const buy = players.reduce((t, p) => t + p.buyIn, 0);
    const rebuy = players.reduce((t, p) => t + p.rebuyValue, 0);
    const totalCash = players.reduce((t, p) => t + p.bought, 0);

    const sumBuyEl = document.getElementById("summaryBuy");
    const sumRebuyEl = document.getElementById("summaryRebuy");
    const sumCashEl = document.getElementById("summaryCash");

    if (sumBuyEl) sumBuyEl.innerText = formatMoney(buy);
    if (sumRebuyEl) sumRebuyEl.innerText = formatMoney(rebuy);
    if (sumCashEl) sumCashEl.innerText = formatMoney(totalCash);
}

function renderSettlement() {
    const container = document.getElementById("settlementList");
    if (!container) return;

    // Checa se todos preencheram
    const allFilled = players.length > 0 && players.every(p => p.finalAmount !== null && p.finalAmount !== undefined);
    if (!allFilled) {
        container.innerHTML = `<p class="empty-settlement">Preencha os valores finais de todos os jogadores para calcular o acerto PIX.</p>`;
        return;
    }

    const settlement = calculateSettlement(players);
    if (settlement.length === 0) {
        container.innerHTML = `<p class="empty-settlement">🎉 Todos saíram empatados! Nenhum pagamento pendente.</p>`;
        return;
    }

    container.innerHTML = "";
    settlement.forEach(t => {
        container.innerHTML += `
            <div class="settlement-item">
                <div>
                    <span class="payer">${t.from}</span> ➔ <span class="receiver">${t.to}</span>
                </div>
                <div class="amount">${formatMoney(t.amount)}</div>
            </div>
        `;
    });
}

// Finaliza Sessão
function finishSession() {
    if (sessionClosed) return;

    const missing = players.some(p => p.finalAmount === null || p.finalAmount === undefined);
    if (missing) {
        showFinalModal(`
            <div class="warning-box">
                <h3>⚠ Faltam Valores Finais</h3>
                <p>Preencha quanto cada jogador terminou em fichas para poder fechar o caixa.</p>
                <button class="primary-full-btn" onclick="closeFinal()" style="margin-top: 16px;">
                    ✏️ Preencher Valores Finais
                </button>
            </div>
        `);
        return;
    }

    const comprado = players.reduce((t, p) => t + p.bought, 0);
    const finalTotal = players.reduce((t, p) => t + Number(p.finalAmount), 0);
    const diferenca = finalTotal - comprado;

    if (Math.abs(diferenca) > 0.01) {
        showFinalModal(`
            <div class="warning-box">
                <h3>⚠ Caixa não fecha!</h3>
                <p>Total Comprado na Mesa: <strong>${formatMoney(comprado)}</strong></p>
                <p>Total das Fichas Informadas: <strong>${formatMoney(finalTotal)}</strong></p>
                <p style="color: var(--loss-red); margin-top: 8px;">Diferença de Fichas: <strong>${formatMoney(diferenca)}</strong></p>
                <small style="display:block; margin-top: 8px; color: var(--text-muted)">Confira a contagem de fichas com a mesa ou os rebuys dos jogadores.</small>
                <button class="primary-full-btn" onclick="closeFinal()" style="margin-top: 16px;">
                    🔍 Revisar e Corrigir Contagem
                </button>
            </div>
        `);
        return;
    }

    saveFinishedSession();
    sessionClosed = true;

    showFinalModal(`
        <div class="success-box">
            <h2>🏆 Sessão Encerrada com Sucesso!</h2>
            <p>O caixa bateu perfeitamente em <strong>${formatMoney(finalTotal)}</strong>.</p>
            <p style="margin-top: 10px; font-size: 13px; color: var(--text-muted)">O ranking acumulado e histórico foram atualizados.</p>
            <div class="final-modal-actions" style="margin-top: 16px; display: flex; flex-direction: column; gap: 10px;">
                <button class="primary-full-btn" onclick="newSession()">
                    ♠ Iniciar Nova Sessão Agora
                </button>
                <button class="cancel-btn" onclick="closeFinal()" style="width: 100%;">
                    Ver Resumo da Mesa / Fechar
                </button>
            </div>
        </div>
    `);
}

function showFinalModal(html) {
    const box = document.getElementById("finalResult");
    if (box) box.innerHTML = html;
    const modal = document.getElementById("finalModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.scrollTop = 0;
        const boxContainer = modal.querySelector(".modal-box");
        if (boxContainer) boxContainer.scrollTop = 0;
    }
}

function closeFinal() {
    const modal = document.getElementById("finalModal");
    if (modal) modal.classList.add("hidden");
}

function confirmNewSession() {
    haptic(30);
    if (sessionClosed || players.length === 0) {
        newSession();
        return;
    }

    if (confirm("Deseja reiniciar a mesa e iniciar uma nova sessão de poker?\n\nOs dados da mesa atual serão limpos.")) {
        newSession();
    }
}

function newSession() {
    players = [];
    currentHistory = [];
    sessionClosed = false;
    saveDatabase();
    closeFinal();
    openTab("mesa");
    render();
    showToast("♠ Nova sessão de poker iniciada!");
}

// ======================================
// ENVIAR RESULTADO E PIX NO WHATSAPP
// ======================================
function shareResult() {
    if (players.length === 0) {
        showToast("Nenhum resultado para compartilhar.");
        return;
    }

    let text = `♠ *POKER NIGHT - RESUMO DA SESSÃO* ♠\n📅 ${sessionDate()}\n\n`;

    const totalPot = players.reduce((t, p) => t + p.bought, 0);
    text += `💰 *Caixa Total:* ${formatMoney(totalPot)}\n\n`;

    text += `📊 *RESULTADOS INDIVIDUAIS:*\n`;
    players.forEach(p => {
        const res = (p.finalAmount ?? 0) - p.bought;
        const symbol = res > 0 ? "🟢 +" : res < 0 ? "🔴 " : "⚪ ";
        text += `${symbol}${p.name}: ${formatMoney(res)} (Comprado: ${formatMoney(p.bought)})\n`;
    });

    const settlement = calculateSettlement(players);
    if (settlement.length > 0) {
        text += `\n🤝 *ACERTO DE CONTAS (QUEM DEVE PRA QUEM):*\n`;
        settlement.forEach(t => {
            text += `👉 *${t.from}* paga *${formatMoney(t.amount)}* para *${t.to}*\n`;
        });
    }

    text += `\n_Gerado por Poker Night Manager_ 🃏`;

    window.open("https://wa.me/?text=" + encodeURIComponent(text));
}

// ======================================
// HISTÓRICO DE SESSÕES ANTERIORES
// ======================================
function renderHistory() {
    const box = document.getElementById("historyContainer");
    if (!box) return;

    box.innerHTML = "";

    if (sessions.length === 0) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <h3>Sem histórico registrado</h3>
                <p>Ao finalizar a primeira sessão, os dados aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    sessions.slice().reverse().forEach(s => {
        let playersSummary = s.players.map(p => {
            const res = p.result;
            const style = res > 0 ? "color: var(--profit-green)" : res < 0 ? "color: var(--loss-red)" : "color: var(--text-muted)";
            return `<span>${p.name}: <b style="${style}">${res > 0 ? '+' : ''}${formatMoney(res)}</b></span>`;
        }).join(" • ");

        box.innerHTML += `
            <div class="player-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-family: var(--font-heading); font-size: 16px;">🗓 ${s.date}</h3>
                    <span style="font-family: var(--font-heading); color: var(--accent-emerald); font-weight: 700;">${formatMoney(s.total)}</span>
                </div>
                <div style="font-size: 12px; margin-top: 10px; color: var(--text-muted); line-height: 1.5;">
                    ${playersSummary}
                </div>
            </div>
        `;
    });
}

// ======================================
// RANKING LEADERBOARD & PÓDIO
// ======================================
function renderRanking() {
    const podiumBox = document.getElementById("podiumContainer");
    const rankingBox = document.getElementById("rankingContainer");

    if (!podiumBox || !rankingBox) return;

    podiumBox.innerHTML = "";
    rankingBox.innerHTML = "";

    const sorted = Object.entries(ranking).sort((a, b) => b[1].profit - a[1].profit);

    if (sorted.length === 0) {
        rankingBox.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏆</div>
                <h3>Ranking Vazio</h3>
                <p>Finalize sessões para acumular a pontuação do ranking!</p>
            </div>
        `;
        return;
    }

    // Render Pódio (Top 3)
    const top3 = sorted.slice(0, 3);
    let podiumHtml = "";

    // Posição 2 (Esquerda)
    if (top3[1]) {
        podiumHtml += `
            <div class="podium-card second">
                <div class="podium-crown">🥈</div>
                <div class="podium-name">${top3[1][0]}</div>
                <div class="podium-profit">${formatMoney(top3[1][1].profit)}</div>
                <div class="podium-sessions">${top3[1][1].sessions} jogos</div>
            </div>
        `;
    } else {
        podiumHtml += `<div class="podium-card placeholder"></div>`;
    }

    // Posição 1 (Centro - Destaque)
    if (top3[0]) {
        podiumHtml += `
            <div class="podium-card first">
                <div class="podium-crown">👑 🥇</div>
                <div class="podium-name">${top3[0][0]}</div>
                <div class="podium-profit">${formatMoney(top3[0][1].profit)}</div>
                <div class="podium-sessions">${top3[0][1].sessions} jogos</div>
            </div>
        `;
    }

    // Posição 3 (Direita)
    if (top3[2]) {
        podiumHtml += `
            <div class="podium-card third">
                <div class="podium-crown">🥉</div>
                <div class="podium-name">${top3[2][0]}</div>
                <div class="podium-profit">${formatMoney(top3[2][1].profit)}</div>
                <div class="podium-sessions">${top3[2][1].sessions} jogos</div>
            </div>
        `;
    } else {
        podiumHtml += `<div class="podium-card placeholder"></div>`;
    }

    podiumBox.innerHTML = podiumHtml;

    // Render Lista Completa
    sorted.forEach((item, index) => {
        const name = item[0];
        const stats = item[1];
        const isProfit = stats.profit >= 0;

        rankingBox.innerHTML += `
            <div class="ranking-row">
                <div class="ranking-rank">#${index + 1}</div>
                <div class="ranking-user-info">
                    <div class="ranking-user-name">${name}</div>
                    <div class="ranking-user-meta">
                        ${stats.sessions} jogos • ${stats.wins}V - ${stats.losses}D • ${stats.totalRebuys} rebuys
                    </div>
                </div>
                <div class="ranking-user-profit ${isProfit ? 'profit-tag' : 'loss-tag'}">
                    ${isProfit ? '+' : ''}${formatMoney(stats.profit)}
                </div>
            </div>
        `;
    });
}

// ======================================
// CONFIGURAÇÕES DE TEMA & DADOS
// ======================================
function setTheme(themeName, showNotification = true) {
    document.documentElement.setAttribute("data-theme", themeName);
    settings.theme = themeName;
    saveDatabase();

    // Atualiza botões ativos no menu config
    document.querySelectorAll(".theme-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.classList.contains(`theme-${themeName}`)) {
            btn.classList.add("active");
        }
    });

    if (showNotification) {
        const themeLabels = { emerald: "Emerald Felt", royal: "Royal Velvet", gold: "High Roller" };
        showToast(`🎨 Tema alterado para ${themeLabels[themeName] || themeName}`);
    }
}

function saveDefaultBuyIn() {
    const input = document.getElementById("defaultBuyInInput");
    const val = Number(input.value);
    if (val > 0) {
        settings.defaultBuyIn = val;
        saveDatabase();
        showToast(`💰 Buy-in padrão alterado para ${formatMoney(val)}`);
    } else {
        showToast("⚠️ Digite um valor válido");
    }
}

function clearHistory() {
    if (confirm("Deseja realmente apagar todo o histórico de sessões encerradas?")) {
        sessions = [];
        saveDatabase();
        renderHistory();
        showToast("🗑 Histórico de sessões foi apagado!");
    }
}

function clearRanking() {
    if (confirm("Deseja realmente zerar o ranking acumulado dos jogadores?")) {
        ranking = {};
        saveDatabase();
        renderRanking();
        showToast("🏆 Ranking geral foi zerado!");
    }
}

// ======================================
// DRAG & DROP PARA REORDENAR JOGADORES
// ======================================
function initDragAndDrop() {
    const container = document.getElementById("playersContainer");
    if (!container) return;

    const cards = container.querySelectorAll(".draggable-card");

    cards.forEach(card => {
        // ---- MOUSE / DESKTOP DRAG ----
        card.addEventListener("dragstart", handleDragStart);
        card.addEventListener("dragover", handleDragOver);
        card.addEventListener("dragenter", handleDragEnter);
        card.addEventListener("dragleave", handleDragLeave);
        card.addEventListener("drop", handleDrop);
        card.addEventListener("dragend", handleDragEnd);

        // ---- TOUCH / MOBILE DRAG ----
        const handle = card.querySelector(".drag-handle");
        if (handle) {
            handle.addEventListener("touchstart", handleTouchStart, { passive: false });
            handle.addEventListener("touchmove", handleTouchMove, { passive: false });
            handle.addEventListener("touchend", handleTouchEnd);
        }
    });
}

// Desktop drag handlers
function handleDragStart(e) {
    draggedIndex = Number(this.dataset.index);
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    haptic(25);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add("drag-over");
    dragOverIndex = Number(this.dataset.index);
}

function handleDragLeave() {
    this.classList.remove("drag-over");
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove("drag-over");

    const toIndex = Number(this.dataset.index);
    if (draggedIndex !== null && draggedIndex !== toIndex) {
        reorderPlayers(draggedIndex, toIndex);
    }
}

function handleDragEnd() {
    this.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    draggedIndex = null;
    dragOverIndex = null;
}

// Touch drag handlers
let touchStartY = 0;
let touchCurrentCard = null;
let touchClone = null;

function handleTouchStart(e) {
    e.preventDefault();
    const card = this.closest(".draggable-card");
    if (!card) return;

    touchCurrentCard = card;
    draggedIndex = Number(card.dataset.index);
    touchStartY = e.touches[0].clientY;

    // Create visual clone
    touchClone = card.cloneNode(true);
    touchClone.classList.add("drag-clone");
    touchClone.style.position = "fixed";
    touchClone.style.width = card.offsetWidth + "px";
    touchClone.style.left = card.getBoundingClientRect().left + "px";
    touchClone.style.top = e.touches[0].clientY - 40 + "px";
    touchClone.style.zIndex = "500";
    touchClone.style.pointerEvents = "none";
    touchClone.style.opacity = "0.85";
    touchClone.style.transform = "scale(1.03) rotate(1deg)";
    touchClone.style.boxShadow = "0 12px 30px rgba(0,0,0,0.5)";
    document.body.appendChild(touchClone);

    card.classList.add("dragging");
    haptic(25);
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!touchClone) return;

    const touchY = e.touches[0].clientY;
    touchClone.style.top = touchY - 40 + "px";

    // Find element under touch
    touchClone.style.display = "none";
    const elementBelow = document.elementFromPoint(e.touches[0].clientX, touchY);
    touchClone.style.display = "";

    // Clear previous drag-over
    document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));

    if (elementBelow) {
        const targetCard = elementBelow.closest(".draggable-card");
        if (targetCard && targetCard !== touchCurrentCard) {
            targetCard.classList.add("drag-over");
            dragOverIndex = Number(targetCard.dataset.index);
        }
    }
}

function handleTouchEnd() {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
        reorderPlayers(draggedIndex, dragOverIndex);
    }

    touchCurrentCard = null;
    draggedIndex = null;
    dragOverIndex = null;
}

function reorderPlayers(fromIndex, toIndex) {
    const movedPlayer = players.splice(fromIndex, 1)[0];
    players.splice(toIndex, 0, movedPlayer);
    haptic(30);
    saveDatabase();
    render();
    showToast(`↕️ ${movedPlayer.name} movido na mesa`);
}

// ======================================
// REAL-TIME MODALS & UI HELPERS
// ======================================
function showLiveBadge(code, spectator = false) {
    const badge = document.getElementById("liveBadge");
    if (badge) {
        badge.classList.remove("hidden");
        if (spectator) {
            badge.innerHTML = `<span class="live-dot spectator-dot"></span> ESPECTADOR`;
        } else {
            badge.innerHTML = `<span class="live-dot"></span> AO VIVO`;
        }
    }
    render();
}

function hideLiveBadge() {
    const badge = document.getElementById("liveBadge");
    if (badge) {
        badge.classList.add("hidden");
    }
    render();
}

function showRoomCreatedModal(code) {
    document.getElementById("roomCodeDisplay").innerText = code;
    document.getElementById("liveRoomModal").classList.remove("hidden");
}

function closeLiveRoomModal() {
    document.getElementById("liveRoomModal").classList.add("hidden");
}

function confirmCloseLiveRoom() {
    closeLiveRoomModal();
    if (confirm("Deseja realmente encerrar a transmissão ao vivo? Seus dados locais serão mantidos.")) {
        closeLiveRoom();
        showToast("Transmissão encerrada.", "info");
    }
}

function shareCurrentRoom() {
    if (typeof shareRoom === 'function' && currentRoomCode) {
        shareRoom(currentRoomCode);
    }
}

function openJoinModal() {
    document.getElementById("joinRoomInput").value = "";
    document.getElementById("joinRoomModal").classList.remove("hidden");
}

function closeJoinModal() {
    document.getElementById("joinRoomModal").classList.add("hidden");
}

function submitJoinRoom() {
    const inputEl = document.getElementById("joinRoomInput");
    const code = inputEl ? inputEl.value.trim().toUpperCase() : "";
    
    console.log("Tentando conectar com código:", code);
    
    if (code.length === 6) {
        if (typeof joinLiveRoom === 'function') {
            joinLiveRoom(code);
        } else {
            console.error("Função joinLiveRoom não encontrada!");
            showToast("Erro interno: Função de conexão não encontrada.");
        }
    } else {
        showToast("O código deve ter 6 caracteres.");
    }
}

function enableSpectatorUI() {
    // Quando entra como espectador, forçamos o render para atualizar a UI
    render();
}

function disableSpectatorUI() {
    render();
}

// ======================================
// AUTO-JOIN VIA URL
// ======================================
window.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const salaCode = urlParams.get('sala');
    if (salaCode && salaCode.length === 6) {
        setTimeout(() => {
            if (typeof joinLiveRoom === 'function') {
                joinLiveRoom(salaCode);
            }
        }, 1000); // Aguarda Firebase inicializar e banco carregar
        
        // Remove param from URL sem refresh
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.pushState({path:newUrl},'',newUrl);
    }
});