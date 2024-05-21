// Card and Deck setup
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const valueOrder = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 };

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Game setup
let deck = [];
let player1Hand = [];
let player2Hand = [];
let communityCards = [];
let player1Money = 1000;
let player2Money = 1000;
let currentTurn = 0;
let pot = 0;
let hasRaised = false;

document.addEventListener('DOMContentLoaded', () => {
    const player1MoneyDisplay = document.getElementById('player1-money');
    const player2MoneyDisplay = document.getElementById('player2-money');
    const potDisplay = document.getElementById('pot');
    const raiseAmountInput = document.getElementById('raise-amount');

    document.getElementById('deal-button').addEventListener('click', () => {
        startNewGame();
    });

    document.getElementById('check-button').addEventListener('click', () => {
        if (hasRaised) {
            setMessage('You cannot check after raising.');
        } else {
            nextTurn();
        }
    });

    document.getElementById('fold-button').addEventListener('click', () => {
        player2Money += pot;
        pot = 0;
        updateDisplay();
        endGame('You folded. CPU wins the pot.');
    });

    document.getElementById('raise-button').addEventListener('click', () => {
        if (hasRaised) {
            setMessage('You can only raise once per turn.');
        } else {
            showRaiseOptions(true);
        }
    });

    document.getElementById('confirm-raise-button').addEventListener('click', () => {
        const raiseAmount = parseInt(raiseAmountInput.value);
        if (player1Money >= raiseAmount && player2Money >= raiseAmount) {
            player1Money -= raiseAmount;
            player2Money -= raiseAmount;
            pot += raiseAmount * 2;
            updateDisplay();
            setMessage(`You raised $${raiseAmount}. Both players put $${raiseAmount} into the pot.`);
            hasRaised = true;
            showRaiseOptions(false);
            nextTurn();
        } else {
            setMessage('Insufficient funds to raise.');
        }
    });

    document.getElementById('cancel-raise-button').addEventListener('click', () => {
        showRaiseOptions(false);
    });

    function startNewGame() {
        deck = shuffleDeck(createDeck());
        player1Hand = [deck.pop(), deck.pop()];
        player2Hand = [deck.pop(), deck.pop()];
        communityCards = [];
        currentTurn = 0;
        pot = 0;
        hasRaised = false;
        updateDisplay();
        renderHands();
        renderCommunityCards();
        setMessage('Hands have been dealt. Make your move!');
        toggleButtons(['deal-button'], false);
        toggleButtons(['check-button', 'fold-button', 'raise-button'], true);
    }

    function nextTurn() {
        if (currentTurn === 0) {
            // The flop: reveal 3 cards
            communityCards.push(deck.pop(), deck.pop(), deck.pop());
        } else if (currentTurn === 1 || currentTurn === 2) {
            // The turn and the river: reveal 1 card each
            communityCards.push(deck.pop());
        }
        renderCommunityCards();
        currentTurn++;
        hasRaised = false;
        if (currentTurn > 2) {
            determineWinner();
        } else {
            setMessage(`Turn ${currentTurn}: New community cards have been revealed.`);
        }
    }

    function determineWinner() {
        const player1BestHand = evaluateBestHand(player1Hand.concat(communityCards));
        const player2BestHand = evaluateBestHand(player2Hand.concat(communityCards));
        const player1BestHandType = getHandType(player1BestHand);
        const player2BestHandType = getHandType(player2BestHand);
        const winner = compareHands(player1BestHand, player2BestHand);

        let resultMessage = `Player 1's best hand: ${player1BestHandType}. Player 2's best hand: ${player2BestHandType}.`;

        if (winner === 1) {
            player1Money += pot;
            resultMessage += ' Player 1 wins the pot!';
        } else if (winner === -1) {
            player2Money += pot;
            resultMessage += ' Player 2 (CPU) wins the pot!';
        } else {
            player1Money += pot / 2;
            player2Money += pot / 2;
            resultMessage += ' It\'s a tie! The pot is split.';
        }

        pot = 0;
        updateDisplay();
        setMessage(resultMessage);

        toggleButtons(['check-button', 'fold-button', 'raise-button'], false);
        toggleButtons(['deal-button'], true);
    }

    function evaluateBestHand(cards) {
        // Generate all possible 5-card combinations
        const combinations = getCombinations(cards, 5);
        let bestHand = combinations[0];
        for (let combination of combinations) {
            if (compareHands(combination, bestHand) === 1) {
                bestHand = combination;
            }
        }
        return bestHand;
    }

    function getCombinations(arr, k) {
        const combinations = [];
        const indexes = [...Array(k).keys()];
        while (indexes[0] < arr.length - k + 1) {
            combinations.push(indexes.map(i => arr[i]));
            let t = k - 1;
            while (t !== 0 && indexes[t] === arr.length - k + t) {
                t--;
            }
            indexes[t]++;
            for (let i = t + 1; i < k; i++) {
                indexes[i] = indexes[i - 1] + 1;
            }
        }
        return combinations;
    }

    function compareHands(hand1, hand2) {
        const hand1Rank = rankHand(hand1);
        const hand2Rank = rankHand(hand2);

        for (let i = 0; i < hand1Rank.length; i++) {
            if (hand1Rank[i] > hand2Rank[i]) return 1;
            if (hand1Rank[i] < hand2Rank[i]) return -1;
        }
        return 0;
    }

    function rankHand(hand) {
        const ranks = values.reduce((obj, value, index) => {
            obj[value] = index;
            return obj;
        }, {});

        const counts = hand.reduce((acc, card) => {
            acc[card.value] = (acc[card.value] || 0) + 1;
            return acc;
        }, {});

        const pairs = [];
        const threes = [];
        const fours = [];
        const sortedValues = Object.keys(counts).sort((a, b) => ranks[b] - ranks[a]);

        for (let value of sortedValues) {
            if (counts[value] === 4) {
                fours.push(value);
            } else if (counts[value] === 3) {
                threes.push(value);
            } else if (counts[value] === 2) {
                pairs.push(value);
            }
        }

        const isFlush = hand.every(card => card.suit === hand[0].suit);
        const sortedHand = hand.map(card => ranks[card.value]).sort((a, b) => b - a);
        const isStraight = sortedHand.slice(1).every((val, i) => val === sortedHand[i] - 1);

        if (isFlush && isStraight && sortedHand[0] === ranks['A']) return [9]; // Royal flush
        if (isFlush && isStraight) return [8, sortedHand[0]]; // Straight flush
        if (fours.length) return [7, ranks[fours[0]]]; // Four of a kind
        if (threes.length && pairs.length) return [6, ranks[threes[0]], ranks[pairs[0]]]; // Full house
        if (isFlush) return [5, ...sortedHand]; // Flush
        if (isStraight) return [4, sortedHand[0]]; // Straight
        if (threes.length) return [3, ranks[threes[0]], ...sortedHand.filter(v => v !== ranks[threes[0]])]; // Three of a kind
        if (pairs.length === 2) return [2, ranks[pairs[0]], ranks[pairs[1]], ...sortedHand.filter(v => v !== ranks[pairs[0]] && v !== ranks[pairs[1]])]; // Two pairs
        if (pairs.length) return [1, ranks[pairs[0]], ...sortedHand.filter(v => v !== ranks[pairs[0]])]; // One pair
        return [0, ...sortedHand]; // High card
    }

    function getHandType(hand) {
        const handRank = rankHand(hand);
        switch (handRank[0]) {
            case 9: return 'Royal Flush';
            case 8: return 'Straight Flush';
            case 7: return 'Four of a Kind';
            case 6: return 'Full House';
            case 5: return 'Flush';
            case 4: return 'Straight';
            case 3: return 'Three of a Kind';
            case 2: return 'Two Pair';
            case 1: return 'One Pair';
            default: return 'High Card';
        }
    }

    function updateDisplay() {
        player1MoneyDisplay.textContent = player1Money;
        player2MoneyDisplay.textContent = player2Money;
        potDisplay.textContent = `Pot: $${pot}`;
    }

    function endGame(message) {
        player1Hand = [];
        player2Hand = [];
        renderHands();
        renderCommunityCards();
        setMessage(message);
        toggleButtons(['check-button', 'fold-button', 'raise-button'], false);
        toggleButtons(['deal-button'], true);
    }

    function renderHands() {
        const player1HandDiv = document.getElementById('player1-hand');
        const player2HandDiv = document.getElementById('player2-hand');
        player1HandDiv.innerHTML = '';
        player2HandDiv.innerHTML = '';
        for (let card of player1Hand) {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card');
            const cardImg = document.createElement('img');
            cardImg.src = `textures/${getCardFilename(card)}.png`;
            cardDiv.appendChild(cardImg);
            player1HandDiv.appendChild(cardDiv);
        }
        for (let card of player2Hand) {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card');
            const cardImg = document.createElement('img');
            cardImg.src = `textures/${getCardFilename(card)}.png`;
            cardDiv.appendChild(cardImg);
            player2HandDiv.appendChild(cardDiv);
        }
    }

    function renderCommunityCards() {
        const communityCardsDiv = document.getElementById('community-cards');
        communityCardsDiv.innerHTML = '';
        for (let card of communityCards) {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card');
            const cardImg = document.createElement('img');
            cardImg.src = `textures/${getCardFilename(card)}.png`;
            cardDiv.appendChild(cardImg);
            communityCardsDiv.appendChild(cardDiv);
        }
    }

    function getCardFilename(card) {
        let value = card.value.toLowerCase();
        switch (value) {
            case 'j': value = 'jack'; break;
            case 'q': value = 'queen'; break;
            case 'k': value = 'king'; break;
			case 'a': value = 'ace'; break;
        }
        return `${value}_of_${card.suit.toLowerCase()}`;
    }

    function setMessage(message) {
        document.getElementById('message').textContent = message;
    }

    function showRaiseOptions(show) {
        document.getElementById('raise-options').style.display = show ? 'inline-block' : 'none';
        toggleButtons(['check-button', 'fold-button', 'raise-button'], !show);
    }

    function toggleButtons(buttonIds, show) {
        buttonIds.forEach(id => {
            document.getElementById(id).style.display = show ? 'inline-block' : 'none';
        });
    }
});
