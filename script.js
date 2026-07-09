const MIN_BET = 10;
const START_BALANCE = 1000;

const multipliers = {
  black: 1.9,
  red: 1.9,
  ace: 13,
  joker: 26
};

const HOLD_START_DELAY = 360;
const HOLD_MIN_DELAY = 55;
const HOLD_ACCELERATION = 0.76;

let balance = START_BALANCE;
let betAmount = MIN_BET;
let selectedBetType = null;
let roundLocked = false;
let isDrawing = false;
let holdTimer = null;
let holdDelay = HOLD_START_DELAY;
let cardEffectTimer = null;
let drawnHistory = [];

const elements = {
  table: document.querySelector("#table"),
  historyList: document.querySelector("#historyList"),
  cardStage: document.querySelector("#cardStage"),
  cardStack: document.querySelector("#cardStack"),
  cardFace: document.querySelector("#cardFace"),
  cardRank: document.querySelector("#cardRank"),
  cardSuit: document.querySelector("#cardSuit"),
  cardName: document.querySelector("#cardName"),
  resultPanel: document.querySelector("#resultPanel"),
  message: document.querySelector("#message"),
  payoutText: document.querySelector("#payoutText"),
  balance: document.querySelector("#balance"),
  betAmount: document.querySelector("#betAmount"),
  decreaseBet: document.querySelector("#decreaseBet"),
  increaseBet: document.querySelector("#increaseBet"),
  halfBet: document.querySelector("#halfBet"),
  doubleBet: document.querySelector("#doubleBet"),
  resetButton: document.querySelector("#resetButton"),
  choiceButtons: document.querySelectorAll(".choice")
};

// Создаёт колоду из 52 обычных карт и 2 джокеров.
function createDeck() {
  const suits = [
    { name: "spades", symbol: "♠", color: "black" },
    { name: "clubs", symbol: "♣", color: "black" },
    { name: "hearts", symbol: "♥", color: "red" },
    { name: "diamonds", symbol: "♦", color: "red" }
  ];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({
        rank,
        suit: suit.name,
        symbol: suit.symbol,
        color: suit.color,
        isAce: rank === "A",
        isJoker: false,
        label: `${rank}${suit.symbol}`
      });
    });
  });

  deck.push(
    { rank: "Joker", suit: "joker", symbol: "★", color: "joker", isAce: false, isJoker: true, label: "Joker ★" },
    { rank: "Joker", suit: "joker", symbol: "★", color: "joker", isAce: false, isJoker: true, label: "Joker ★" }
  );

  return deck;
}

// Выбирает случайную карту из свежей колоды.
function drawRandomCard() {
  const deck = createDeck();
  const randomIndex = Math.floor(Math.random() * deck.length);
  return deck[randomIndex];
}

// Запоминает выбранный тип ставки.
function selectBetType(type) {
  if (roundLocked) {
    return;
  }

  selectedBetType = type;
  updateInterface();
  drawCard();
}

// Меняет размер ставки с учётом минимума и текущего баланса.
function changeBetAmount(delta) {
  if (roundLocked || balance < MIN_BET) {
    return;
  }

  const nextBet = betAmount + delta;
  betAmount = Math.min(Math.max(nextBet, MIN_BET), balance);
  updateInterface();
}

function doubleBetAmount() {
  if (roundLocked || balance < MIN_BET) {
    return;
  }

  stopBetHold();
  betAmount = Math.min(betAmount * 2, balance);
  updateInterface();
}

function halfBetAmount() {
  if (roundLocked || balance < MIN_BET) {
    return;
  }

  stopBetHold();
  betAmount = Math.max(MIN_BET, Math.floor(betAmount / 2));
  updateInterface();
}

function stopBetHold() {
  if (holdTimer) {
    window.clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function startBetHold(delta) {
  if (roundLocked || balance < MIN_BET) {
    return;
  }

  stopBetHold();
  changeBetAmount(delta);
  holdDelay = HOLD_START_DELAY;

  const repeat = () => {
    const previousBet = betAmount;

    changeBetAmount(delta);

    if (previousBet === betAmount || roundLocked || balance < MIN_BET) {
      stopBetHold();
      return;
    }

    holdDelay = Math.max(HOLD_MIN_DELAY, holdDelay * HOLD_ACCELERATION);
    holdTimer = window.setTimeout(repeat, holdDelay);
  };

  holdTimer = window.setTimeout(repeat, holdDelay);
}

function setupHoldButton(button, delta) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    startBetHold(delta);
  });

  button.addEventListener("pointerup", stopBetHold);
  button.addEventListener("pointercancel", stopBetHold);
  button.addEventListener("pointerleave", stopBetHold);
  button.addEventListener("lostpointercapture", stopBetHold);

  button.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      changeBetAmount(delta);
    }
  });
}

// Проверяет, совпадает ли вытянутая карта с выбранным прогнозом.
function checkResult(card, betType) {
  if (betType === "black") {
    return card.color === "black";
  }

  if (betType === "red") {
    return card.color === "red";
  }

  if (betType === "ace") {
    return card.isAce;
  }

  if (betType === "joker") {
    return card.isJoker;
  }

  return false;
}

// Считает выплату по множителю.
function calculatePayout(amount, betType) {
  return Math.round(amount * multipliers[betType]);
}

function getBetLabel(type) {
  const labels = {
    black: "Black",
    red: "Red",
    ace: "Ace",
    joker: "Joker"
  };

  return labels[type] || "";
}

function showCard(card) {
  elements.cardFace.classList.toggle("red-card", card.color === "red");
  elements.cardRank.textContent = card.isJoker ? "J" : card.rank;
  elements.cardSuit.textContent = card.symbol;
  elements.cardName.textContent = card.label;
}

function getHistoryClass(card) {
  if (card.isJoker) {
    return "joker-card";
  }

  return card.color === "red" ? "red-card" : "black-card";
}

function renderHistory() {
  elements.historyList.innerHTML = drawnHistory.map((card, index) => {
    const rank = card.isJoker ? "J" : card.rank;
    const symbol = card.symbol;
    const latestClass = index === 0 ? " latest" : "";

    return `
      <span class="history-card ${getHistoryClass(card)}${latestClass}">
        <strong>${rank}</strong>
        <em>${symbol}</em>
      </span>
    `;
  }).join("");
}

function addCardToHistory(card) {
  drawnHistory.unshift(card);
  drawnHistory = drawnHistory.slice(0, 8);
  renderHistory();
}

function clearHistory() {
  drawnHistory = [];
  renderHistory();
}

function resetCardView() {
  clearCardEffects();
  elements.cardStack.classList.remove("flipped", "shaking");
  elements.cardFace.classList.remove("red-card");
  elements.cardRank.textContent = "?";
  elements.cardSuit.textContent = "?";
  elements.cardName.textContent = "Choose bet";
}

function clearCardEffects() {
  if (cardEffectTimer) {
    window.clearTimeout(cardEffectTimer);
    cardEffectTimer = null;
  }

  elements.cardStage.classList.remove("is-shuffling", "is-win", "is-lose");
}

function playCardEffect(type) {
  clearCardEffects();
  elements.cardStage.classList.add(`is-${type}`);
  cardEffectTimer = window.setTimeout(() => {
    elements.cardStage.classList.remove(`is-${type}`);
    cardEffectTimer = null;
  }, 1500);
}

// Основное действие раунда: списывает ставку, тянет карту и показывает итог.
function drawCard() {
  if (!selectedBetType || roundLocked) {
    return;
  }

  stopBetHold();

  if (balance < MIN_BET) {
    elements.message.textContent = "Недостаточно кредитов";
    updateInterface();
    return;
  }

  betAmount = Math.min(betAmount, balance);
  balance -= betAmount;
  roundLocked = true;
  isDrawing = true;
  clearCardEffects();
  elements.resultPanel.classList.remove("win", "lose");
  elements.message.textContent = "Колода тасуется...";
  elements.payoutText.textContent = "Выигрыш: 0";
  elements.cardStack.classList.remove("flipped");
  elements.cardStack.classList.add("shaking");
  elements.cardStage.classList.add("is-shuffling");
  updateInterface();

  window.setTimeout(() => {
    const card = drawRandomCard();
    const isWin = checkResult(card, selectedBetType);
    const payout = isWin ? calculatePayout(betAmount, selectedBetType) : 0;

    balance += payout;
    showCard(card);
    addCardToHistory(card);
    isDrawing = false;
    roundLocked = false;
    elements.cardStack.classList.remove("shaking");
    elements.cardStack.classList.add("flipped");
    playCardEffect(isWin ? "win" : "lose");
    elements.resultPanel.classList.add(isWin ? "win" : "lose");
    elements.message.textContent = isWin
      ? `Победа! Выпала ${card.label}. Прогноз: ${getBetLabel(selectedBetType)}.`
      : `Проигрыш. Выпала ${card.label}. Прогноз: ${getBetLabel(selectedBetType)}.`;
    elements.payoutText.textContent = `Получено: ${payout} кредитов`;
    updateInterface();
  }, 1000);
}

function startNewRound() {
  if (isDrawing) {
    return;
  }

  roundLocked = false;
  selectedBetType = null;
  betAmount = balance < MIN_BET ? balance : Math.min(Math.max(betAmount, MIN_BET), balance);
  resetCardView();
  elements.resultPanel.classList.remove("win", "lose");
  elements.message.textContent = balance < MIN_BET
    ? "Недостаточно кредитов"
    : "Выберите ставку и тип прогноза.";
  elements.payoutText.textContent = "Выигрыш: 0";
  updateInterface();
}

function resetBalance() {
  if (isDrawing) {
    return;
  }

  stopBetHold();
  balance = START_BALANCE;
  betAmount = MIN_BET;
  clearHistory();
  startNewRound();
}

// Обновляет все видимые значения и состояния кнопок.
function updateInterface() {
  if (balance < MIN_BET && !roundLocked) {
    elements.message.textContent = "Недостаточно кредитов";
  }

  if (!roundLocked) {
    betAmount = balance < MIN_BET ? balance : Math.min(Math.max(betAmount, MIN_BET), balance);
  }

  elements.balance.textContent = balance;
  elements.betAmount.textContent = betAmount;
  elements.decreaseBet.disabled = roundLocked || betAmount <= MIN_BET || balance < MIN_BET;
  elements.increaseBet.disabled = roundLocked || betAmount >= balance || balance < MIN_BET;
  elements.halfBet.disabled = roundLocked || betAmount <= MIN_BET || balance < MIN_BET;
  elements.doubleBet.disabled = roundLocked || betAmount >= balance || balance < MIN_BET;
  elements.resetButton.disabled = isDrawing;

  elements.choiceButtons.forEach((button) => {
    const isSelected = button.dataset.betType === selectedBetType;
    button.classList.toggle("selected", isSelected);
    button.disabled = roundLocked || balance < MIN_BET;
  });
}

elements.choiceButtons.forEach((button) => {
  button.addEventListener("click", () => selectBetType(button.dataset.betType));
});

setupHoldButton(elements.decreaseBet, -MIN_BET);
setupHoldButton(elements.increaseBet, MIN_BET);
elements.halfBet.addEventListener("click", halfBetAmount);
elements.doubleBet.addEventListener("click", doubleBetAmount);
elements.resetButton.addEventListener("click", resetBalance);

updateInterface();
