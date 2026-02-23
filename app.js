// Heads-up Texas Hold'em (front-end only)
// - One raise per street per player
// - Simple CPU
// - Full hand evaluation via best-of-7 (21 combos)

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14]; // 11=J,12=Q,13=K,14=A

const ui = {
  pChips: document.getElementById("pChips"),
  cChips: document.getElementById("cChips"),
  pot: document.getElementById("pot"),
  street: document.getElementById("street"),
  cpuCards: document.getElementById("cpuCards"),
  playerCards: document.getElementById("playerCards"),
  community: document.getElementById("community"),
  cpuBet: document.getElementById("cpuBet"),
  playerBet: document.getElementById("playerBet"),
  status: document.getElementById("status"),
  hint: document.getElementById("hint"),
  results: document.getElementById("results"),

  newHandBtn: document.getElementById("newHandBtn"),
  checkCallBtn: document.getElementById("checkCallBtn"),
  raiseBtn: document.getElementById("raiseBtn"),
  foldBtn: document.getElementById("foldBtn"),

  raiseBox: document.getElementById("raiseBox"),
  raiseSlider: document.getElementById("raiseSlider"),
  raiseAmt: document.getElementById("raiseAmt"),
  raiseNote: document.getElementById("raiseNote"),
  confirmRaiseBtn: document.getElementById("confirmRaiseBtn"),
  cancelRaiseBtn: document.getElementById("cancelRaiseBtn"),
};

const STREET_ORDER = ["Preflop","Flop","Turn","River","Showdown"];

let state = resetState();

function resetState(){
  return {
    deck: [],
    playerChips: 1000,
    cpuChips: 1000,
    pot: 0,
    streetIndex: 0, // 0 preflop
    community: [],
    playerHand: [],
    cpuHand: [],
    revealedCpu: false,

    streetBets: { player: 0, cpu: 0 },
    acted: { player: false, cpu: false },
    raiseUsed: { player: false, cpu: false },

    inHand: false,
    handOver: false,
  };
}

function buildDeck(){
  const deck = [];
  for (const s of SUITS){
    for (const r of RANKS){
      deck.push({ r, s });
    }
  }
  // Fisher–Yates shuffle
  for (let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankLabel(r){
  if (r <= 10) return String(r);
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  return "A";
}

function suitColor(s){
  return (s === "♥" || s === "♦") ? "red" : "black";
}

function cardEl(card, hidden=false){
  const d = document.createElement("div");
  d.className = "card" + (hidden ? " hidden" : "");
  if (hidden){
    d.innerHTML = `<div class="rank muted">?</div><div class="suit muted">?</div>`;
    return d;
  }
  const cls = suitColor(card.s);
  d.innerHTML = `<div class="rank ${cls}">${rankLabel(card.r)}</div><div class="suit ${cls}">${card.s}</div>`;
  return d;
}

function setStatus(msg){ ui.status.textContent = msg; }

function formatMoney(n){ return `$${n}`; }

function updateUI(){
  ui.pChips.textContent = formatMoney(state.playerChips);
  ui.cChips.textContent = formatMoney(state.cpuChips);
  ui.pot.textContent = formatMoney(state.pot);
  ui.street.textContent = STREET_ORDER[state.streetIndex] || "—";
  ui.cpuBet.textContent = formatMoney(state.streetBets.cpu);
  ui.playerBet.textContent = formatMoney(state.streetBets.player);

  ui.playerCards.innerHTML = "";
  state.playerHand.forEach(c => ui.playerCards.appendChild(cardEl(c)));

  ui.cpuCards.innerHTML = "";
  state.cpuHand.forEach(c => ui.cpuCards.appendChild(cardEl(c, !state.revealedCpu)));

  ui.community.innerHTML = "";
  state.community.forEach(c => ui.community.appendChild(cardEl(c)));

  // Button labels / enabled state
  const toCall = Math.max(0, state.streetBets.cpu - state.streetBets.player);
  ui.checkCallBtn.textContent = toCall > 0 ? `Call ${formatMoney(toCall)}` : "Check";
  ui.checkCallBtn.disabled = !state.inHand || state.handOver;
  ui.raiseBtn.disabled = !state.inHand || state.handOver || state.raiseUsed.player || state.playerChips <= toCall;
  ui.foldBtn.disabled = !state.inHand || state.handOver;
}

function startHand(){
  state.deck = buildDeck();
  state.community = [];
  state.playerHand = [state.deck.pop(), state.deck.pop()];
  state.cpuHand = [state.deck.pop(), state.deck.pop()];
  state.revealedCpu = false;

  state.pot = 0;
  state.streetIndex = 0;
  state.streetBets = { player: 0, cpu: 0 };
  state.acted = { player: false, cpu: false };
  state.raiseUsed = { player: false, cpu: false };

  state.inHand = true;
  state.handOver = false;

  ui.results.textContent = "";
  ui.hint.textContent = "You act first. One raise per street.";
  setStatus("New hand started.");
  hideRaiseBox();
  updateRaiseControls();
  updateUI();
}

function hideRaiseBox(){
  ui.raiseBox.classList.add("hidden");
}

function showRaiseBox(){
  ui.raiseBox.classList.remove("hidden");
}

function updateRaiseControls(){
  const toCall = Math.max(0, state.streetBets.cpu - state.streetBets.player);
  const max = Math.max(10, Math.min(500, state.playerChips - toCall));
  ui.raiseSlider.max = String(max);
  ui.raiseSlider.min = "10";
  ui.raiseSlider.step = "10";
  let v = Number(ui.raiseSlider.value || 50);
  if (v > max) v = max;
  if (v < 10) v = 10;
  ui.raiseSlider.value = String(v);
  ui.raiseAmt.textContent = String(v);
  ui.raiseNote.textContent = `You must call ${formatMoney(toCall)} first. Raise adds on top of the call.`;
}

function takeFrom(actor, amount){
  if (amount <= 0) return 0;
  if (actor === "player"){
    const pay = Math.min(state.playerChips, amount);
    state.playerChips -= pay;
    state.streetBets.player += pay;
    state.pot += pay;
    return pay;
  } else {
    const pay = Math.min(state.cpuChips, amount);
    state.cpuChips -= pay;
    state.streetBets.cpu += pay;
    state.pot += pay;
    return pay;
  }
}

function endHandShowdown(reason){
  state.handOver = true;
  state.inHand = false;
  state.revealedCpu = true;

  // If needed, deal remaining community to 5
  while (state.community.length < 5){
    state.community.push(state.deck.pop());
  }

  const playerBest = bestOfSeven(state.playerHand.concat(state.community));
  const cpuBest = bestOfSeven(state.cpuHand.concat(state.community));

  const cmp = compareScore(playerBest.score, cpuBest.score);
  let resultLine = "";

  if (reason === "fold_player"){
    // CPU already won
    resultLine = `You folded. CPU wins the pot.`;
  } else if (reason === "fold_cpu"){
    resultLine = `CPU folded. You win the pot.`;
  } else {
    if (cmp > 0){
      resultLine = `You win!`;
    } else if (cmp < 0){
      resultLine = `CPU wins.`;
    } else {
      resultLine = `Split pot.`;
    }
  }

  // Award pot
  if (reason === "fold_player"){
    state.cpuChips += state.pot;
  } else if (reason === "fold_cpu"){
    state.playerChips += state.pot;
  } else {
    if (cmp > 0) state.playerChips += state.pot;
    else if (cmp < 0) state.cpuChips += state.pot;
    else {
      const half = Math.floor(state.pot / 2);
      state.playerChips += half;
      state.cpuChips += state.pot - half;
    }
  }
  state.pot = 0;

  const detail =
    `Your best: ${playerBest.name}\nCPU best: ${cpuBest.name}\nReason: ${reason || "showdown"}`;
  ui.results.textContent = `${resultLine}\n${detail}`;
  setStatus(resultLine);
  ui.hint.textContent = "Hand over. Click New Hand.";
  hideRaiseBox();
  updateUI();
}

function streetComplete(){
  // Reset for next street
  state.streetIndex = Math.min(state.streetIndex + 1, 4);
  state.streetBets = { player: 0, cpu: 0 };
  state.acted = { player: false, cpu: false };
  state.raiseUsed = { player: false, cpu: false };
  hideRaiseBox();

  // Deal community cards for new street (except showdown)
  if (state.streetIndex === 1){ // flop
    state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
  } else if (state.streetIndex === 2){ // turn
    state.community.push(state.deck.pop());
  } else if (state.streetIndex === 3){ // river
    state.community.push(state.deck.pop());
  } else if (state.streetIndex === 4){
    endHandShowdown("showdown");
    return;
  }

  ui.hint.textContent = "Next street. You act first. One raise per street.";
  setStatus(`${STREET_ORDER[state.streetIndex]} started.`);
  updateRaiseControls();
  updateUI();
}

function checkStreetEnd(){
  // If anyone is all-in, auto-run to showdown
  const toCallP = Math.max(0, state.streetBets.cpu - state.streetBets.player);
  const toCallC = Math.max(0, state.streetBets.player - state.streetBets.cpu);
  const pAllIn = state.playerChips === 0;
  const cAllIn = state.cpuChips === 0;
  if ((pAllIn || cAllIn) && (toCallP === 0 && toCallC === 0)){
    // runout to showdown
    state.streetIndex = 4;
    endHandShowdown("all-in");
    return;
  }

  if (state.streetBets.player === state.streetBets.cpu &&
      state.acted.player && state.acted.cpu){
    streetComplete();
  }
}

// Player actions
function playerCheckCall(){
  if (!state.inHand || state.handOver) return;
  hideRaiseBox();

  const toCall = Math.max(0, state.streetBets.cpu - state.streetBets.player);
  if (toCall > 0){
    takeFrom("player", toCall);
    setStatus(`You call ${formatMoney(toCall)}.`);
  } else {
    setStatus(`You check.`);
  }
  state.acted.player = true;

  updateUI();
  cpuAct();
  updateUI();
  checkStreetEnd();
}

function playerFold(){
  if (!state.inHand || state.handOver) return;
  setStatus("You fold.");
  endHandShowdown("fold_player");
}

function playerRaise(amount){
  if (!state.inHand || state.handOver) return;

  const toCall = Math.max(0, state.streetBets.cpu - state.streetBets.player);
  if (state.raiseUsed.player) return;

  // Must call first then add raise
  const need = toCall + amount;
  if (need > state.playerChips) return;

  takeFrom("player", toCall);
  takeFrom("player", amount);

  state.raiseUsed.player = true;
  state.acted.player = true;
  state.acted.cpu = false; // opponent must respond
  setStatus(`You raise by ${formatMoney(amount)}.`);
  hideRaiseBox();
  updateRaiseControls();
  updateUI();

  cpuAct();
  updateUI();
  checkStreetEnd();
}

// CPU logic: quick strength estimate based on current best-of-seven with unknowns
function cpuAct(){
  if (!state.inHand || state.handOver) return;

  // If CPU already acted and no pending response, don't act
  // (we always call cpuAct right after player action, so CPU should respond)
  const toCall = Math.max(0, state.streetBets.player - state.streetBets.cpu);

  // Estimate strength: evaluate CPU current known cards + community (pad with random draws simulation)
  const strength = estimateStrengthCPU(120); // 0..1
  const canRaise = !state.raiseUsed.cpu && state.cpuChips > toCall;

  // Decision heuristics
  if (toCall > 0){
    // Facing bet
    const foldThresh = 0.20 + (toCall / Math.max(1, (state.cpuChips + state.pot))) * 0.50;
    if (strength < foldThresh && Math.random() < 0.80){
      setStatus("CPU folds.");
      endHandShowdown("fold_cpu");
      return;
    }
    // Call mostly
    takeFrom("cpu", toCall);
    setStatus(`CPU calls ${formatMoney(toCall)}.`);
    state.acted.cpu = true;
  } else {
    // No bet (can check or raise)
    if (canRaise && strength > 0.62 && Math.random() < 0.55){
      // Raise by a fraction of pot
      const base = Math.max(20, Math.min(200, Math.floor(state.pot * 0.5)));
      const raiseBy = Math.min(base, state.cpuChips);
      takeFrom("cpu", raiseBy);
      state.raiseUsed.cpu = true;
      state.acted.cpu = true;
      state.acted.player = false;
      setStatus(`CPU raises by ${formatMoney(raiseBy)}.`);
    } else {
      setStatus("CPU checks.");
      state.acted.cpu = true;
    }
  }
}

// Monte Carlo-ish strength estimation for CPU
function estimateStrengthCPU(iters=100){
  // If showdown, exact
  if (state.community.length === 5){
    const cpuBest = bestOfSeven(state.cpuHand.concat(state.community));
    const pBest = bestOfSeven(state.playerHand.concat(state.community));
    const cmp = compareScore(cpuBest.score, pBest.score);
    return cmp > 0 ? 1 : (cmp < 0 ? 0 : 0.5);
  }

  // Build remaining deck from known cards
  const known = new Set([...state.cpuHand, ...state.playerHand, ...state.community].map(cardKey));
  const remain = [];
  for (const s of SUITS){
    for (const r of RANKS){
      const key = `${r}${s}`;
      if (!known.has(key)) remain.push({r,s});
    }
  }

  let wins = 0, ties = 0;
  for (let i=0;i<iters;i++){
    // copy remain and draw
    const pool = remain.slice();
    shuffle(pool);

    const oppHand = [pool.pop(), pool.pop()];
    const comm = state.community.slice();
    while (comm.length < 5) comm.push(pool.pop());

    const cpuBest = bestOfSeven(state.cpuHand.concat(comm));
    const oppBest = bestOfSeven(oppHand.concat(comm));

    const cmp = compareScore(cpuBest.score, oppBest.score);
    if (cmp > 0) wins++;
    else if (cmp === 0) ties++;
  }
  return (wins + ties * 0.5) / iters;
}

function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function cardKey(c){ return `${c.r}${c.s}`; }

// ---------- Hand evaluation ----------
// score is array where higher lexicographically is better.
// categories: 8 SF, 7 quads, 6 full, 5 flush, 4 straight, 3 trips, 2 two-pair, 1 pair, 0 high

function bestOfSeven(cards7){
  // choose best of 21 five-card combos
  const combos = choose5(cards7);
  let best = null;
  for (const hand of combos){
    const ev = eval5(hand);
    if (!best || compareScore(ev.score, best.score) > 0){
      best = ev;
    }
  }
  return best;
}

function compareScore(a,b){
  for (let i=0;i<Math.max(a.length,b.length);i++){
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function choose5(cards){
  const out = [];
  const n = cards.length;
  for (let a=0;a<n-4;a++){
    for (let b=a+1;b<n-3;b++){
      for (let c=b+1;c<n-2;c++){
        for (let d=c+1;d<n-1;d++){
          for (let e=d+1;e<n;e++){
            out.push([cards[a],cards[b],cards[c],cards[d],cards[e]]);
          }
        }
      }
    }
  }
  return out;
}

function eval5(cards){
  const ranks = cards.map(c=>c.r).sort((x,y)=>y-x);
  const suits = cards.map(c=>c.s);

  const isFlush = suits.every(s => s === suits[0]);

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r)||0) + 1);

  const groups = [...counts.entries()]
    .map(([r,c])=>({r, c}))
    .sort((a,b)=> (b.c - a.c) || (b.r - a.r));

  const straightHigh = straightHighCard(ranks);

  const isStraight = straightHigh !== null;

  // Straight Flush
  if (isFlush && isStraight){
    return { score: [8, straightHigh], name: `Straight Flush (${straightName(straightHigh)})` };
  }

  // Four of a kind
  if (groups[0].c === 4){
    const quad = groups[0].r;
    const kicker = groups.find(g=>g.c===1).r;
    return { score: [7, quad, kicker], name: `Four of a Kind (${rankLabel(quad)}s)` };
  }

  // Full house
  if (groups[0].c === 3 && groups[1].c === 2){
    const trips = groups[0].r;
    const pair = groups[1].r;
    return { score: [6, trips, pair], name: `Full House (${rankLabel(trips)} over ${rankLabel(pair)})` };
  }

  // Flush
  if (isFlush){
    return { score: [5, ...ranks], name: `Flush` };
  }

  // Straight
  if (isStraight){
    return { score: [4, straightHigh], name: `Straight (${straightName(straightHigh)})` };
  }

  // Three of a kind
  if (groups[0].c === 3){
    const trips = groups[0].r;
    const kickers = groups.filter(g=>g.c===1).map(g=>g.r).sort((a,b)=>b-a);
    return { score: [3, trips, ...kickers], name: `Three of a Kind (${rankLabel(trips)}s)` };
  }

  // Two pair
  if (groups[0].c === 2 && groups[1].c === 2){
    const highPair = Math.max(groups[0].r, groups[1].r);
    const lowPair = Math.min(groups[0].r, groups[1].r);
    const kicker = groups.find(g=>g.c===1).r;
    return { score: [2, highPair, lowPair, kicker], name: `Two Pair (${rankLabel(highPair)} & ${rankLabel(lowPair)})` };
  }

  // One pair
  if (groups[0].c === 2){
    const pair = groups[0].r;
    const kickers = groups.filter(g=>g.c===1).map(g=>g.r).sort((a,b)=>b-a);
    return { score: [1, pair, ...kickers], name: `One Pair (${rankLabel(pair)}s)` };
  }

  // High card
  return { score: [0, ...ranks], name: `High Card (${rankLabel(ranks[0])})` };
}

function straightHighCard(descRanks){
  // descRanks length 5; handle wheel A-5
  const uniq = [...new Set(descRanks)];
  if (uniq.length !== 5) return null;
  // A-5: ranks like [14,5,4,3,2]
  const wheel = [14,5,4,3,2];
  if (wheel.every((v,i)=>uniq[i]===v)) return 5;

  // Normal
  for (let i=0;i<4;i++){
    if (uniq[i] - 1 !== uniq[i+1]) return null;
  }
  return uniq[0];
}

function straightName(high){
  // high is 5 for A-5 wheel, else high card
  if (high === 5) return "A-5";
  const low = high - 4;
  return `${rankLabel(low)}-${rankLabel(high)}`;
}

// ---------- Wiring ----------
ui.newHandBtn.addEventListener("click", () => startHand());

ui.checkCallBtn.addEventListener("click", () => playerCheckCall());

ui.foldBtn.addEventListener("click", () => playerFold());

ui.raiseBtn.addEventListener("click", () => {
  if (!state.inHand || state.handOver) return;
  updateRaiseControls();
  showRaiseBox();
});

ui.raiseSlider.addEventListener("input", () => {
  ui.raiseAmt.textContent = ui.raiseSlider.value;
});

ui.confirmRaiseBtn.addEventListener("click", () => {
  const amt = Number(ui.raiseSlider.value);
  playerRaise(amt);
});

ui.cancelRaiseBtn.addEventListener("click", () => hideRaiseBox());

// Initialize
updateUI();
